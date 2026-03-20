import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
export const serverConfig = (app) => {
    app.use(cors({origin: process.env.CLIENT_URL, credentials: true}))
    app.use(cookieParser());
    app.use(express.static('public'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
}