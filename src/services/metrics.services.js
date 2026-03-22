import axios from 'axios';

const PROMETHEUS_API = 'http://minicloud-prometheus:9090/api/v1';

class MetricsServices {
    async getHistoryData(hostConfig, timeRange = '1h') {
        const end = new Date();
        let start = new Date();
        let step = '1m';
        let timeFormatOptions = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit' };

        // 1. Logic tính khoảng thời gian (start) và bước nhảy (step)
        if (timeRange === '24h') {
            start.setHours(end.getHours() - 24);
            step = '15m'; // Lấy mẫu mỗi 15 phút
            // Xem 24h thì nên hiện cả ngày/tháng để dễ nhìn
            timeFormatOptions = { ...timeFormatOptions, day: '2-digit', month: '2-digit' };
        } else if (timeRange === '8h') {
            start.setHours(end.getHours() - 8);
            step = '5m';  // Lấy mẫu mỗi 5 phút
        } else {
            // Mặc định 1h
            start.setHours(end.getHours() - 1);
            step = '1m';  // Lấy mẫu mỗi 1 phút
        }

        try {
            const [promCpu, promRam] = await Promise.all([
                axios.get(`${PROMETHEUS_API}/query_range`, { 
                    params: { query: 'vmware_host_cpu_usage_average', start: start.toISOString(), end: end.toISOString(), step } 
                }),
                axios.get(`${PROMETHEUS_API}/query_range`, { 
                    params: { query: 'vmware_host_memory_usage', start: start.toISOString(), end: end.toISOString(), step } 
                })
            ]);

            const formatData = (promData) => {
                if (!promData.data?.data?.result || promData.data.data.result.length === 0) return [];
                return promData.data.data.result[0].values.map(item => {
                    const dateObj = new Date(item[0] * 1000);
                    // 2. Format thời gian hiển thị: Nếu là 24h thì hiện thêm Ngày/Tháng
                    let timeStr = dateObj.toLocaleTimeString('en-GB', timeFormatOptions);
                    if (timeRange === '24h') {
                        timeStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1} ${timeStr}`;
                    }
                    
                    return {
                        time: timeStr,
                        value: parseFloat(item[1])
                    };
                });
            };

            const cpuRaw = formatData(promCpu);
            const ramRaw = formatData(promRam);

            return cpuRaw.map((item, index) => {
                const totalCpuMhz = hostConfig.cpuMhz * hostConfig.cpuCores;
                const cpuInPercent = (item.value / totalCpuMhz) * 100;
                let ramVal = ramRaw[index] ? ramRaw[index].value : 0;
                if (ramVal > 100) ramVal = (ramVal / (hostConfig.ramTotal / (1024 * 1024))) * 100;

                return {
                    time: item.time,
                    cpu: parseFloat(cpuInPercent.toFixed(1)),
                    ram: parseFloat(ramVal.toFixed(1))
                };
            });
        } catch (error) {
            console.error("Lỗi lấy dữ liệu Prometheus:", error.message);
            return [];
        }
    }
}

export default new MetricsServices();