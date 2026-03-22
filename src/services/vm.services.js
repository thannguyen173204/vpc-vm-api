import DatabaseService from "./db.services.js";
import EsxiServices from "./esxi.services.js";
import MetricsServices from "./metrics.services.js";
import Vm from "../models/vm.model.js";

class VmServices {
    create = async (vmName, vmUsername, vmPassword, cpu, ram, disk, userName, userId, osName) => {
        const fullVmName = `${userName}-${vmName}`;
        let vm = null;

        try {
            // Đã fix lỗi biến data.ram -> ram
            await EsxiServices.checkAvailableResources(ram, disk);

            vm = await DatabaseService.create(Vm, {
                vm_name: fullVmName, vm_username: vmUsername, cpu, ram, disk, user_id: userId, status: 'pending'
            });

            await EsxiServices.clone(fullVmName, osName);
            await EsxiServices.changeHardware(fullVmName, cpu, ram, disk);
            await EsxiServices.powerOn(fullVmName);

            const ip = await EsxiServices.getIp(fullVmName);
            await EsxiServices.configNetworkAndUser(fullVmName, vmUsername, vmPassword);

            return await DatabaseService.updateById(Vm, vm._id, { ip_address: ip, status: 'running' });
        } catch (error) {
            if (vm && vm._id) {
                await DatabaseService.deleteById(Vm, vm._id);
                await EsxiServices.powerOff(fullVmName);
                await EsxiServices.destroy(fullVmName);
            }
            console.error(`Lỗi Vm services ${fullVmName}:`, error);
            throw new Error(`Lỗi khởi tạo VM: ${error.message}`);
        }
    }

    configHardware = async (vmName, userId, cpu, ram, disk, vmPassword) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc không có quyền thao tác");
        if (vm.status === 'running') throw new Error("Yêu cầu tắt VM trước khi cấu hình");

        await EsxiServices.changeHardware(vmName, cpu, ram, disk);
        // Note: Nếu cần cập nhật pass OS thì gọi thêm configNetworkAndUser ở đây
        await DatabaseService.updateById(Vm, vm._id, { cpu, ram, disk });
        return vm;
    }

    start = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM");

        await EsxiServices.powerOn(vmName);
        await DatabaseService.updateById(Vm, vm._id, { status: 'pending' });
        const ip = await EsxiServices.getIp(vmName);
        await DatabaseService.updateById(Vm, vm._id, { ip_address: ip, status: 'running' });
    }

    stop = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM");

        await EsxiServices.powerOff(vmName);
        await DatabaseService.updateById(Vm, vm._id, { ip_address: null, status: 'stopped' });
    }

    restart = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM");

        await EsxiServices.reset(vmName);
        await DatabaseService.updateById(Vm, vm._id, { status: 'pending' });
        const ip = await EsxiServices.getIp(vmName);
        await DatabaseService.updateById(Vm, vm._id, { ip_address: ip, status: 'running' });
    }

    delete = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM");

        await EsxiServices.powerOff(vmName);
        await EsxiServices.destroy(vmName);
        await DatabaseService.deleteById(Vm, vm._id);
    }

    findManyByUser = async (userId) => {
        return await DatabaseService.findMany(Vm, { user_id: userId });
    }

    systemStat = async () => {
        try {
            const { host, disk } = await EsxiServices.getHostAndDiskStats();

            const totalCpuMhz = host.cpuMhz * host.cpuCores;
            const cpuPercent = ((host.cpuUsed / totalCpuMhz) * 100).toFixed(1);

            const ramTotalMB = host.ramTotal / (1024 * 1024);
            const ramUsedMB = host.ramUsedMB;
            const ramAvailableMB = Math.max(0, ramTotalMB - ramUsedMB);

            const diskTotalGB = disk.capacity / (1024 ** 3);
            const diskFreeGB = disk.free / (1024 ** 3);

            const historyData = await MetricsServices.getHistoryData(host);

            return {
                cpu: {
                    percent: parseFloat(cpuPercent),
                    detail: `${host.cpuUsed} / ${totalCpuMhz} MHz`,
                    totalCores: host.cpuCores // Trả về tổng core để chặn trên UI
                },
                ram: {
                    percent: ((ramUsedMB / ramTotalMB) * 100).toFixed(1),
                    detail: `${(ramUsedMB / 1024).toFixed(1)} / ${(ramTotalMB / 1024).toFixed(1)} GB`,
                    availableMB: Math.floor(ramAvailableMB) // Trả về số MB còn trống
                },
                disk: {
                    percent: (((diskTotalGB - diskFreeGB) / diskTotalGB) * 100).toFixed(1),
                    detail: `${(diskTotalGB - diskFreeGB).toFixed(1)} / ${diskTotalGB.toFixed(1)} GB`,
                    availableGB: Math.floor(diskFreeGB) // Trả về số GB còn trống
                },
                history: historyData
            };
        } catch (error) {
            console.error("Lỗi lấy thông số hệ thống ESXi:", error);
            throw new Error("Không thể kết nối đến máy chủ ESXi để lấy thông số.");
        }
    }
}

export default new VmServices();