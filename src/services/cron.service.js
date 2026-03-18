import cron from 'node-cron';
import Vm from '../models/vm.model.js';
import DatabaseService from './db.services.js';
import { cmdService } from './cli.services.js';
import dayjs from 'dayjs';


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
                for (const vm of vms) {

                }

                for (const dbVm of vms) {
                    const status = runningVms.has(dbVm.vm_name) ? 'running' : 'stopped';

                    if (dbVm.status !== status) {
                        const info = await cmdService('govc', ['vm.info', dbVm.vm_name]).stdout;
                        const status2 = info.split('Power state: ')[1].split(' ')[0].trim()==='poweredOn'?'running':'stopped';
                        const ip = info.split('IP address: ')[1].split(' ')[0].trim();
                        await DatabaseService.updateById(Vm, dbVm._id, { ip_address: ip===''?null:ip, status: status2 });
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