import { cmdService } from "./cli.services.js";

class EsxiServices {
    async clone(vmName, osName) {
        const scriptPath = process.env.CLONE_VM_SCRIPT;
        return cmdService('bash', [scriptPath], {
            env: { ...process.env, VM_NAME: vmName, OS_NAME: osName }
        });
    }

    async configNetworkAndUser(vmName, vmUsername, vmPassword) {
        const scriptPath = process.env.CONFIG_VM_SCRIPT;
        return cmdService('bash', [scriptPath], {
            env: { ...process.env, VM_NAME: vmName, VM_USER_NAME: vmUsername, VM_USER_PASSWORD: vmPassword }
        });
    }

    async powerOn(vmName) {
        return cmdService('govc', ['vm.power', '-on', vmName]);
    }

    // Thêm catch() để lỡ VM đang tắt rồi thì lệnh off không làm sập app
    async powerOff(vmName) {
        return cmdService('govc', ['vm.power', '-off', vmName]).catch(() => {});
    }

    async reset(vmName) {
        return cmdService('govc', ['vm.power', '-reset', vmName]);
    }

    async destroy(vmName) {
        return cmdService('govc', ['vm.destroy', vmName]).catch(() => {});
    }

    async getIp(vmName) {
        const ip = await cmdService('govc', ['vm.ip', '-wait=3m', vmName], { silent: true });
        return ip.stdout;
    }

    async changeHardware(vmName, cpu, ram, disk) {
        await cmdService('govc', ['vm.change', '-vm', vmName, '-c', cpu.toString(), '-m', ram.toString()]);
        if (disk > 10) {
            await cmdService('govc', ['vm.disk.change', '-vm', vmName, '-size', `${disk}G`]);
        }
    }

    async checkAvailableResources(reqRamMB, reqDiskGB) {
        const hostCmd = `govc host.info -json | jq '.hostSystems[0].summary | { ramTotal: .hardware.memorySize, ramUsedMB: .quickStats.overallMemoryUsage }'`;
        const diskCmd = `govc datastore.info -json data | jq '.datastores[0].summary | { capacity: .capacity, free: .freeSpace }'`;

        const [hostRes, diskRes] = await Promise.all([
            cmdService('sh', ['-c', hostCmd], { silent: true }),
            cmdService('sh', ['-c', diskCmd], { silent: true })
        ]);

        const host = JSON.parse(hostRes.stdout);
        const disk = JSON.parse(diskRes.stdout);

        const freeRamMB = (host.ramTotal / (1024 * 1024)) - host.ramUsedMB;
        const freeDiskGB = disk.free / (1024 ** 3);

        if (reqRamMB > freeRamMB) throw new Error(`ESXi không đủ RAM! Còn trống: ${Math.floor(freeRamMB)} MB.`);
        if (reqDiskGB > freeDiskGB) throw new Error(`ESXi không đủ ổ cứng! Còn trống: ${Math.floor(freeDiskGB)} GB.`);
        return true;
    }

    // Dành cho Cronjob
    async getRunningVms() {
        const res = await cmdService('govc', ['find', '/', '-type', 'm', '-runtime.powerState', 'poweredOn'], { silent: true });
        return res.stdout.split('\n').filter(p => p.trim() !== '').map(path => path.split('/').pop());
    }

    async getVmInfo(vmName) {
        const res = await cmdService('govc', ['vm.info', vmName], { silent: true });
        return res.stdout;
    }

    async getHostAndDiskStats() {
        const hostCmd = `govc host.info -json | jq '.hostSystems[0].summary | { cpuMhz: .hardware.cpuMhz, cpuCores: .hardware.numCpuCores, cpuUsed: .quickStats.overallCpuUsage, ramTotal: .hardware.memorySize, ramUsedMB: .quickStats.overallMemoryUsage }'`;
        const diskCmd = `govc datastore.info -json data | jq '.datastores[0].summary | { capacity: .capacity, free: .freeSpace }'`;

        const [hostRes, diskRes] = await Promise.all([
            cmdService('sh', ['-c', hostCmd], { silent: true }),
            cmdService('sh', ['-c', diskCmd], { silent: true })
        ]);

        return { host: JSON.parse(hostRes.stdout), disk: JSON.parse(diskRes.stdout) };
    }
}

export default new EsxiServices();