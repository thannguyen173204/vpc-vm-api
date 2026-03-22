import axios from 'axios';

const PROMETHEUS_API = 'http://minicloud-prometheus:9090/api/v1';

class MetricsServices {
    async getHistoryData(hostConfig) {
        const end = new Date().toISOString();
        const start = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const step = '1m';

        try {
            const [promCpu, promRam] = await Promise.all([
                axios.get(`${PROMETHEUS_API}/query_range`, { params: { query: 'vmware_host_cpu_usage_average', start, end, step } }),
                axios.get(`${PROMETHEUS_API}/query_range`, { params: { query: 'vmware_host_memory_usage', start, end, step } })
            ]);

            const formatData = (promData) => {
                if (!promData.data?.data?.result || promData.data.data.result.length === 0) return [];
                return promData.data.data.result[0].values.map(item => ({
                    time: new Date(item[0] * 1000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit' }),
                    value: parseFloat(item[1])
                }));
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