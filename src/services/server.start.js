import dotenv from 'dotenv';
import { databaseConfig } from '../configs/database.config.js';
import cronService from './cron.service.js';

dotenv.config();

const port = process.env.VM_PORT;
const originalLog = console.log;
const originalError = console.error;
const getFormattedTime = () => {
    return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

export const serverStart = async (app) => {
    console.log = (...args) => {
        originalLog(`[${getFormattedTime()}] [INFO]`, ...args);
    };

    console.error = (...args) => {
        originalError(`[${getFormattedTime()}] [ERROR]`, ...args);
    };
    cronService.startPolling();
    await databaseConfig();
    app.listen(port, () => console.log('Server is running'));

}
