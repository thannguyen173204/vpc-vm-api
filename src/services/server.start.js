import dotenv from 'dotenv';
import { databaseConfig } from '../configs/database.config.js';
import cronService from './cron.services.js';
import dayjs from 'dayjs';
dotenv.config();

const port = process.env.VM_PORT;
const originalLog = console.log;
const originalError = console.error;

export const serverStart = async (app) => {
    console.log = (...args) => {
        originalLog(`[${dayjs().format('DD-MM-YY HH:mm:ss')}] [INFO]`, ...args);
    };

    console.error = (...args) => {
        originalError(`[${dayjs().format('YY-MM-DD HH:mm:ss')}] [ERROR]`, ...args);
    };
    cronService.startPolling();
    await databaseConfig();
    app.listen(port, () => console.log('Server is running'));

}
