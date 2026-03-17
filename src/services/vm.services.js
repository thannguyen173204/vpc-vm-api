import DatabaseService from "./db.service.js";
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
                status: 'creating'
            });

            await this.clone(fullVmName, osName);
            await this.config(fullVmName, vmUsername, vmPassword);

            const ip = await cmdService('govc', ['vm.ip', '-wait=5m', fullVmName], { silent: true });
            await DatabaseService.updateById(Vm, vm._id, { ip_address: ip.stdout, status: 'running' });
            this.waitIpAndUpdate(fullVmName, vm._id).catch(console.error);
            return vm;
        } catch (error) {
            if (vm && vm._id) {
                await DatabaseService.deleteById(Vm, vm._id);
            }
            console.error(`Lỗi Vm services ${fullVmName}:`, error);
            throw new Error(`Lỗi khởi tạo VM: ${error.message}`);
        }
    }
    waitIpAndUpdate = async (vmName, vmId) => {
        try {
            const ip = await cmdService('govc', ['vm.ip', '-wait=5m', vmName], { silent: true });
            await DatabaseService.updateById(Vm, vmId, { ip_address: ip.stdout, status: 'running' });
            console.log(`[Success] VM ${vmName} đã nhận IP: ${ip.stdout}`);
        } catch (error) {
            await DatabaseService.updateById(Vm, vmId, { status: 'failed', error: 'Không lấy được IP' });
            console.error(`[Error] Lỗi lấy IP cho ${vmName}:`, error);
        }
    }

    clone = async (fullVmName, osName) => {
        const scriptPath = process.env.CLONE_VM_SCRIPT || 'src/scripts/cloneVm.sh';
        await cmdService('bash', [scriptPath], {
            env: {
                ...process.env,
                VM_NAME: fullVmName,
                OS_NAME: osName
            }
        });
    }

    config = async (fullVmName, vmUsername, vmPassword) => {
        const scriptPath = process.env.CONFIG_VM_SCRIPT || 'src/scripts/configVm.sh';
        await cmdService('bash', [scriptPath], {
            env: {
                ...process.env,
                VM_NAME: fullVmName,
                VM_USER_NAME: vmUsername,
                VM_USER_PASSWORD: vmPassword
            }
        });
    }

    start = async (vmName, userId) => {
        // Query cả vm_name và user_id
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");

        await cmdService('govc', ['vm.power', '-on', vmName]);
        await DatabaseService.updateById(Vm, vm._id, { status: 'pending' });

        // Có thể đẩy việc chờ IP xuống background như đã làm ở create để tránh time-out API
        cmdService('govc', ['vm.ip', '-wait=5m', vmName], { silent: true })
            .then(ip => DatabaseService.updateById(Vm, vm._id, { ip_address: ip.stdout, status: 'running' }))
            .catch(err => console.error(`Lỗi lấy IP cho ${vmName} khi start:`, err));
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

        cmdService('govc', ['vm.ip', '-wait=5m', vmName], { silent: true })
            .then(ip => DatabaseService.updateById(Vm, vm._id, { ip_address: ip.stdout, status: 'running' }))
            .catch(err => console.error(`Lỗi lấy IP cho ${vmName} khi restart:`, err));
    }

    delete = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");

        await cmdService('govc', ['vm.destroy', vmName]);
        await DatabaseService.delete(Vm, { _id: vm._id }); // Nên xóa bằng _id cho chính xác tuyệt đối
    }

    findManyByUser = async (userId) => {
        return await DatabaseService.findMany(Vm, { user_id: userId });
    }
}

export default new VmServices();
