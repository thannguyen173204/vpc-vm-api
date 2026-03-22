import { databaseConfig } from '../configs/database.config.js';
import cronService from './cron.services.js';
import dayjs from 'dayjs';

const port = process.env.VM_PORT;
const originalLog = console.log;
const originalError = console.error;

export const serverStart = async (app) => {
    console.log = (...args) => {
        originalLog(`[${dayjs().format('DD-MM-YY HH:mm:ss')}] [INFO]`, ...args);
    };

    console.error = (...args) => {
        originalError(`[${dayjs().format('DD/MM/YYYY HH:mm:ss')}] [ERROR]`, ...args);
    };
    cronService.startPolling();
    cronService.autoDelete();
    await databaseConfig();
    app.listen(port, () => console.log('Server is running'));

}
