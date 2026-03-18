import cron from 'node-cron';
import Vm from '../models/vm.model.js';
import DatabaseService from './db.services.js';
import { cmdService } from './cli.services.js';

class CronServices {
    startPolling = () => {
        cron.schedule('* * * * *', async () => {
            try {
                // 1. Hỏi ESXi danh sách các máy ĐANG BẬT (Tốn cực kỳ ít tài nguyên)
                const res = await cmdService('govc', [
                    'find', '/', 
                    '-type', 'm', 
                    '-runtime.powerState', 'poweredOn'
                ], { silent: true });

                // 2. Xử lý chuỗi text: Cắt lấy tên máy ảo ở cuối dòng
                // (VD: "/ha-datacenter/vm/vm1" -> lấy "vm1")
                const runningPaths = res.stdout.split('\n').filter(p => p.trim() !== '');
                const runningVms = new Set(runningPaths.map(path => path.split('/').pop()));

                // 3. Lấy VM từ Database (Chỉ quan tâm máy đã tạo xong)
                const vms = await DatabaseService.findMany(Vm, { 
                    status: { $nin: ['creating', 'pending'] } 
                });

                // 4. Đối chiếu siêu tốc bằng RAM
                for (const dbVm of vms) {
                    // Nếu tên máy ảo có trong Set runningVms -> ESXi báo nó đang bật
                    const realStatus = runningVms.has(dbVm.vm_name) ? 'running' : 'stopped';

                    // Nếu DB bị lệch pha với ESXi -> Cập nhật DB
                    if (dbVm.status !== realStatus) {
                        console.log(`[ĐỒNG BỘ] Cập nhật ${dbVm.vm_name}: DB(${dbVm.status}) -> ESXi(${realStatus})`);
                        await DatabaseService.updateById(Vm, dbVm._id, { status: realStatus });
                        
                        // Chỗ này sau này chèn thêm: io.emit('vm_status_changed', ...);
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