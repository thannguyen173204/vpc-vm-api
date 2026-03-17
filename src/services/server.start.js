import dotenv from 'dotenv';
import {databaseConfig} from '../configs/database.config.js';

dotenv.config();

const port = process.env.PORT;

export const serverStart = async (app) => {
    await databaseConfig();
    app.listen(port, () => console.log('Server is running'));

}
