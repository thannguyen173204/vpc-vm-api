import express from 'express';
import cookieParser from 'cookie-parser';
export const serverConfig = (app) => {
    app.use(cookieParser());
    app.use(express.static('public'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
}