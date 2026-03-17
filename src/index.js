import express from 'express';
import {serverStart} from './services/server.start.js';
import {serverConfig} from './configs/server.config.js';
import {serverRoute} from './routes/server.route.js';

const app = express();
serverConfig(app);
serverRoute(app);

serverStart(app);