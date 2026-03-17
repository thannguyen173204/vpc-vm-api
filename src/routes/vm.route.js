import express from 'express';
import { createVm, deleteVm, restartVm, startVm, stopVm, getVm } from '../controllers/vm.controller.js';
export const vmRoute = express.Router();
vmRoute.post('/create', createVm);
vmRoute.post('/start', startVm);
vmRoute.post('/stop', stopVm);
vmRoute.post('/restart', restartVm);
vmRoute.post('/delete', deleteVm);
vmRoute.get('/get', getVm);