import cron from 'node-cron';
import Vm from '../models/vm.model.js';
import DatabaseService from './db.services.js';
import EsxiServices from './esxi.services.js';
import VmServices from './vm.services.js'; // FIX: Đã import

class CronServices {
    startPolling = () => {
        cron.schedule('*/1 * * * * *', async () => {
            try {
                // Dùng EsxiServices cho gọn
                const runningPaths = await EsxiServices.getRunningVms();
                const runningVms = new Set(runningPaths);

                const vms = await DatabaseService.findMany(Vm, { status: { $nin: ['creating', 'pending'] } });
                
                for (const dbVm of vms) {
                    const status = runningVms.has(dbVm.vm_name) ? 'running' : 'stopped';

                    if (dbVm.status !== status || (status === 'running' && !dbVm.ip_address)) {
                        const info = await EsxiServices.getVmInfo(dbVm.vm_name);
                        
                        const powerMatch = info.match(/Power state:[ \t]*(.*)/i);
                        const ipMatch = info.match(/IP address:[ \t]*(.*)/i);

                        const realPower = powerMatch ? powerMatch[1].trim() : '';
                        const realIp = ipMatch ? ipMatch[1].trim() : '';

                        const status2 = realPower === 'poweredOn' ? 'running' : 'stopped';
                        const newIp = realIp === '' ? null : realIp;

                        if (dbVm.status !== status2 || dbVm.ip_address !== newIp) {
                            await DatabaseService.updateById(Vm, dbVm._id, { ip_address: newIp, status: status2 });
                            console.log(`[SYNC] Cập nhật ${dbVm.vm_name} -> Trạng thái: ${status2}, IP: ${newIp || 'null'}`);
                        }
                    }
                }
            } catch (error) {
                // Ignore silent errors during polling
            }
        });
    }

    autoDelete = async () => {
        cron.schedule('* * * * *', async () => {
            try {
                const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

                // FIX: Tìm các VM tạo quá 10 phút (không phân biệt status để dọn sạch rác)
                const expiredVms = await DatabaseService.findMany(Vm, {
                    createdAt: { $lte: tenMinsAgo }
                });

                for (const vm of expiredVms) {
                    console.log(`[Auto-Clean] Đang thu hồi máy ảo hết hạn: ${vm.vm_name}`);
                    // FIX: Truyền đủ vm_name và user_id
                    await VmServices.delete(vm.vm_name, vm.user_id).catch(err => {
                        console.error(`[Auto-Clean] Lỗi xóa ${vm.vm_name}:`, err.message);
                    });
                }
            } catch (error) {
                console.error("Lỗi khi chạy cron job dọn dẹp VM:", error);
            }
        });
    }
}

export default new CronServices();