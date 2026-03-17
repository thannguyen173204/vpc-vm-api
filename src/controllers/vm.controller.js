import asyncHandler from 'express-async-handler';
import { ErrorResponse } from '../middlewares/error.middleware.js';
import VmServices from '../services/vm.services.js';

export const createVm = asyncHandler(async (req, res) => {
    const { vmName, vmUsername, vmPassword, cpu, ram, disk, osName } = req.body;
    const userId = req.user._id;
    const userName = req.user.user_name;

    if (!vmName || !vmUsername || !vmPassword || !cpu || !ram || !disk || !osName) {
        throw new ErrorResponse("Vui lòng điền đủ nội dung", 400);
    }
    
    const vm = await VmServices.create(vmName, vmUsername, vmPassword, cpu, ram, disk, userName, userId, osName);
    return res.status(201).json({ message: 'Tạo VM thành công', vm });
});

export const startVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id; // Lấy userId từ token
    if (!vmName) throw new ErrorResponse("Vui lòng điền đủ nội dung", 400);
    const vm = await VmServices.start(vmName, userId); // Truyền userId xuống service
    return res.status(200).json({ message: 'Bắt đầu VM thành công', vm });
});

export const stopVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id;
    if (!vmName) throw new ErrorResponse("Vui lòng điền đủ nội dung", 400);
    const vm = await VmServices.stop(vmName, userId);
    return res.status(200).json({ message: 'Dừng VM thành công', vm });
});

export const restartVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id;
    if (!vmName) throw new ErrorResponse("Vui lòng điền đủ nội dung", 400);
    const vm = await VmServices.restart(vmName, userId);
    return res.status(200).json({ message: 'Restart VM thành công', vm });
});

export const deleteVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id;
    if (!vmName) throw new ErrorResponse("Vui lòng điền đủ nội dung", 400);
    const vm = await VmServices.delete(vmName, userId);
    return res.status(200).json({ message: 'Xóa VM thành công', vm });
});

export const getVm = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const vms = await VmServices.findManyByUser(userId);
    return res.status(200).json({ message: 'Lấy danh sách VM thành công', vms });
});