import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
export const databaseConfig = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connect to database successfully!!!');
    } catch (error) {
        console.log("Connect to database failed!!!", "\n=======================================\n", error, "\n=======================================\n");
        process.exit(1);
    }
}