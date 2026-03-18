import cron from 'node-cron';
import Vm from '../models/vm.model.js';
import DatabaseService from './db.services.js';
import { cmdService } from './cli.services.js';


class CronServices {
    startPolling = () => {
        cron.schedule('*/30 * * * * *', async () => {
            try {
                console.log('polling now')
                const res = await cmdService('govc', [
                    'find', '/',
                    '-type', 'm',
                    '-runtime.powerState', 'poweredOn'
                ], { silent: true });

                const runningPaths = res.stdout.split('\n').filter(p => p.trim() !== '');
                const runningVms = new Set(runningPaths.map(path => path.split('/').pop()));

                const vms = await DatabaseService.findMany(Vm, {
                    status: { $nin: ['creating', 'pending'] }
                });
                for (const dbVm of vms) {
                    const status = runningVms.has(dbVm.vm_name) ? 'running' : 'stopped';

                    if (dbVm.status !== status || (status === 'running' && !dbVm.ip_address)) {
                        const info = (await cmdService('govc', ['vm.info', dbVm.vm_name], { silent: true })).stdout;

                        const powerMatch = info.match(/Power state:[ \t]*(.*)/i);
                        const ipMatch = info.match(/IP address:[ \t]*(.*)/i);

                        const realPower = powerMatch ? powerMatch[1].trim() : '';
                        const realIp = ipMatch ? ipMatch[1].trim() : '';

                        const status2 = realPower === 'poweredOn' ? 'running' : 'stopped';
                        const newIp = realIp === '' ? null : realIp;

                        if (dbVm.status !== status2 || dbVm.ip_address !== newIp) {
                            await DatabaseService.updateById(Vm, dbVm._id, {
                                ip_address: newIp,
                                status: status2
                            });
                            console.log(`[ĐỒNG BỘ] Cập nhật ${dbVm.vm_name} -> Trạng thái: ${status2}, IP: ${newIp || 'null'}`);
                        }
                    }
                }
            } catch (error) {
                console.error("Lỗi Cronjob Polling:", error);
            }
        });
        console.log("🕒 Hệ thống Polling giám sát (Bản Siêu Nhẹ) đã khởi động!");
    }
}

export default new CronServices();