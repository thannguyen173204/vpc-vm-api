import DatabaseService from "./db.services.js";
import { cmdService } from "./cli.services.js";
import Vm from "../models/vm.model.js";

class VmServices {
    create = async (vmName, vmUsername, vmPassword, cpu, ram, disk, userName, userId, osName) => {
        let vm = null;
        const fullVmName = `${userName}-${vmName}`;

        try {
            vm = await DatabaseService.create(Vm, {
                vm_name: fullVmName,
                vm_username: vmUsername,
                cpu: cpu,
                ram: ram,
                disk: disk,
                user_id: userId,
                status: 'pending'
            });

            await this.clone(fullVmName, osName);

            await this.configHardware(fullVmName, userId, cpu, ram, disk, vmPassword);
            await cmdService('govc', ['vm.power', '-on', fullVmName]);
            const ip = await cmdService('govc', ['vm.ip', '-wait=3m', fullVmName], { silent: true });
            await this.config(fullVmName, vmUsername, vmPassword);

            return await DatabaseService.updateById(Vm, vm._id, { ip_address: ip.stdout, status: 'running' });
        } catch (error) {
            if (vm && vm._id) {
                await DatabaseService.deleteById(Vm, vm._id);
                await cmdService('govc', ['vm.power', '-off', fullVmName]).catch(() => { });
                await cmdService('govc', ['vm.destroy', fullVmName]).catch(() => { });
            }
            if (vm && vm._id) {
                await DatabaseService.deleteById(Vm, vm._id);
            }
            console.error(`Lỗi Vm services ${fullVmName}:`, error);
            throw new Error(`Lỗi khởi tạo VM: ${error.message}`);
        }
    }

    configHardware = async (vmName, userId, cpu, ram, disk) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác");

        if (vm.status === 'running') throw new Error("Yêu cầu tắt Vm trước khi cấu hình");

        await cmdService('govc', ['vm.change', '-vm', vmName, '-c', cpu.toString(), '-m', ram.toString()]);
        if (disk > 10) {
            await cmdService('govc', ['vm.disk.change', '-vm', vmName, '-size', `${disk}G`]);
        }
        await DatabaseService.updateById(Vm, vm._id, { cpu, ram, disk });
    }
    clone = async (fullVmName, osName) => {
        const scriptPath = process.env.CLONE_VM_SCRIPT;
        await cmdService('bash', [scriptPath], {
            env: { ...process.env, VM_NAME: fullVmName, OS_NAME: osName }
        });
    }

    config = async (fullVmName, vmUsername, vmPassword) => {
        const scriptPath = process.env.CONFIG_VM_SCRIPT;
        await cmdService('bash', [scriptPath], {
            env: { ...process.env, VM_NAME: fullVmName, VM_USER_NAME: vmUsername, VM_USER_PASSWORD: vmPassword }
        });
    }

    start = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");

        await cmdService('govc', ['vm.power', '-on', vmName]);
        await DatabaseService.updateById(Vm, vm._id, { status: 'pending' });
        const ip = await cmdService('govc', ['vm.ip', '-wait=3m', vmName], { silent: true });
        await DatabaseService.updateById(Vm, vm._id, { ip_address: ip.stdout, status: 'running' });
    }

    stop = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");

        await cmdService('govc', ['vm.power', '-off', vmName]);
        await DatabaseService.updateById(Vm, vm._id, { ip_address: null, status: 'stopped' });
    }

    restart = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");

        await cmdService('govc', ['vm.power', '-reset', vmName]);
        await DatabaseService.updateById(Vm, vm._id, { status: 'pending' });
        const ip = await cmdService('govc', ['vm.ip', '-wait=3m', vmName], { silent: true });
        await DatabaseService.updateById(Vm, vm._id, { ip_address: ip.stdout, status: 'running' });
    }

    delete = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");
        await cmdService('govc', ['vm.destroy', vmName]);
        await DatabaseService.deleteById(Vm, vm._id);
    }

    findManyByUser = async (userId) => {
        return await DatabaseService.findMany(Vm, { user_id: userId });
    }
    systemStat = async () => {
        try {
            // Lọc CPU và RAM trực tiếp bằng jq
            // Chúng ta lấy các key camelCase như đã test: cpuMhz, numCpuCores, memorySize, overallCpuUsage, overallMemoryUsage
            const hostCmd = `govc host.info -json | jq '.hostSystems[0].summary | {
                cpuMhz: .hardware.cpuMhz,
                cpuCores: .hardware.numCpuCores,
                cpuUsed: .quickStats.overallCpuUsage,
                ramTotal: .hardware.memorySize,
                ramUsedMB: .quickStats.overallMemoryUsage
            }'`;

            // Lọc Disk trực tiếp từ datastore "data"
            const diskCmd = `govc datastore.info -json data | jq '.datastores[0].summary | {
                capacity: .capacity,
                free: .freeSpace
            }'`;

            // Thực thi song song để tối ưu thời gian phản hồi
            const [hostRes, diskRes] = await Promise.all([
                cmdService('sh', ['-c', hostCmd], { silent: true }),
                cmdService('sh', ['-c', diskCmd], { silent: true })
            ]);

            const host = JSON.parse(hostRes.stdout);
            const disk = JSON.parse(diskRes.stdout);

            // Tính toán các chỉ số phần trăm
            const totalCpuMhz = host.cpuMhz * host.cpuCores;
            const cpuPercent = ((host.cpuUsed / totalCpuMhz) * 100).toFixed(1);

            const ramTotalGB = host.ramTotal / (1024 ** 3);
            const ramUsedGB = host.ramUsedMB / 1024;
            const ramPercent = ((ramUsedGB / ramTotalGB) * 100).toFixed(1);

            const diskTotalGB = disk.capacity / (1024 ** 3);
            const diskFreeGB = disk.free / (1024 ** 3);
            const diskUsedGB = diskTotalGB - diskFreeGB;
            const diskPercent = ((diskUsedGB / diskTotalGB) * 100).toFixed(1);

            return {
                cpu: {
                    percent: parseFloat(cpuPercent),
                    detail: `${host.cpuUsed} / ${totalCpuMhz} MHz`
                },
                ram: {
                    percent: parseFloat(ramPercent),
                    detail: `${ramUsedGB.toFixed(1)} / ${ramTotalGB.toFixed(1)} GB`
                },
                disk: {
                    percent: parseFloat(diskPercent),
                    detail: `${diskUsedGB.toFixed(1)} / ${diskTotalGB.toFixed(1)} GB`
                }
            };
        } catch (error) {
            console.error("Lỗi lấy thông số hệ thống ESXi:", error);
            throw new Error("Không thể kết nối đến máy chủ ESXi để lấy thông số.");
        }
    }
}

export default new VmServices();