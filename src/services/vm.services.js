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

            await this.changeHardware(fullVmName, cpu, ram, disk);

            await this.config(fullVmName, vmUsername, vmPassword);

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

    configHardware = async (vmName, userId, cpu, ram, disk, vmPassword) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác");

        console.log(`[Config] Bắt đầu cấu hình lại ${vmName}: CPU=${cpu}, RAM=${ram}, Disk=${disk}`);

        if (vm.status === 'running') {
            await cmdService('govc', ['vm.power', '-off', vmName]);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        await cmdService('govc', ['vm.change', '-vm', vmName, '-c', cpu.toString(), '-m', ram.toString()]);
        if (disk > 10) {
            await cmdService('govc', ['vm.disk.change', '-vm', vmName, '-size', `${disk}G`]);
        }

        await DatabaseService.updateById(Vm, vm._id, { cpu, ram, disk, status: 'pending' });

        await cmdService('govc', ['vm.power', '-on', vmName]);

        if (disk > 10) {
            this.waitIpAndExtendOSDisk(vmName, vm._id, vm.vm_username, vmPassword).catch(console.error);
        } else {
            this.waitIpAndUpdate(vmName, vm._id).catch(console.error);
        }

        return await DatabaseService.find(Vm, { _id: vm._id });
    }

    waitIpAndExtendOSDisk = async (vmName, vmId, vmUsername, vmPassword) => {
        try {
            console.log(`[Wait IP] Chờ IP để extend disk cho ${vmName}...`);
            const ip = await cmdService('govc', ['vm.ip', '-wait=5m', vmName], { silent: true });

            await new Promise(resolve => setTimeout(resolve, 15000));

            const script = "sudo growpart /dev/sda 3 && sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv && sudo resize2fs /dev/ubuntu-vg/ubuntu-lv";

            console.log(`[Disk] Đang ép OS nhận dung lượng mới...`);
            await cmdService('govc', [
                'guest.run', '-vm', vmName,
                '-auth', `${vmUsername}:${vmPassword}`,
                '/bin/bash', '-c', script
            ]);

            await DatabaseService.updateById(Vm, vmId, { ip_address: ip.stdout, status: 'running' });
            console.log(`[Success] VM ${vmName} đã cấu hình xong toàn bộ!`);
        } catch (error) {
            await DatabaseService.updateById(Vm, vmId, { status: 'failed', error: 'Lỗi khi extend OS disk' });
            console.error(`[Error] Lỗi extend disk cho ${vmName}:`, error);
        }
    }

    waitIpAndUpdate = async (vmName, vmId) => {
        try {
            console.log(`[Wait IP] Đang chờ cấp phát IP cho ${vmName}...`);
            const ip = await cmdService('govc', ['vm.ip', '-wait=5m', vmName], { silent: true });
            await DatabaseService.updateById(Vm, vmId, { ip_address: ip.stdout, status: 'running' });
            console.log(`[Success] VM ${vmName} đã nhận IP: ${ip.stdout}`);
        } catch (error) {
            await DatabaseService.updateById(Vm, vmId, { status: 'failed', error: 'Không lấy được IP' });
            console.error(`[Error] Lỗi lấy IP cho ${vmName}:`, error);
        }
    }

    clone = async (fullVmName, osName) => {
        const scriptPath = process.env.CLONE_VM_SCRIPT || '/app/src/scripts/cloneVm.sh';
        await cmdService('bash', [scriptPath], {
            env: {
                ...process.env,
                VM_NAME: fullVmName,
                OS_NAME: osName
            }
        });
    }

    config = async (fullVmName, vmUsername, vmPassword) => {
        const scriptPath = process.env.CONFIG_VM_SCRIPT || '/app/src/scripts/configVm.sh';
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
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");

        await cmdService('govc', ['vm.power', '-on', vmName]);
        await DatabaseService.updateById(Vm, vm._id, { status: 'pending' });

        this.waitIpAndUpdate(vmName, vm._id).catch(console.error);
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

        this.waitIpAndUpdate(vmName, vm._id).catch(console.error);
    }

    delete = async (vmName, userId) => {
        const vm = await DatabaseService.find(Vm, { vm_name: vmName, user_id: userId });
        if (!vm) throw new Error("Không tìm thấy VM hoặc bạn không có quyền thao tác trên VM này");

        await cmdService('govc', ['vm.power', '-off', vmName]).catch(() => { });
        await cmdService('govc', ['vm.destroy', vmName]);
        await DatabaseService.deleteById(Vm, vm._id);
    }

    findManyByUser = async (userId) => {
        return await DatabaseService.findMany(Vm, { user_id: userId });
    }
}

export default new VmServices();