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

    const isValidName = /^[a-zA-Z0-9-]+$/.test(vmName);
    const isValidUsername = /^[a-zA-Z0-9_]+$/.test(vmUsername);

    if (!isValidName) {
        throw new ErrorResponse("Tên VM chỉ được chứa chữ cái không dấu, số và dấu gạch ngang (-)", 400);
    }
    if (!isValidUsername) {
        throw new ErrorResponse("Username chỉ được chứa chữ cái không dấu, số và dấu gạch dưới (_)", 400);
    }

    const vm = await VmServices.create(vmName, vmUsername, vmPassword, cpu, ram, disk, userName, userId, osName);
    return res.status(201).json({ message: 'Lệnh tạo VM đã được đưa vào hàng đợi', vm });
});

export const startVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id;

    if (!vmName) throw new ErrorResponse("Vui lòng cung cấp tên VM", 400);

    await VmServices.start(vmName, userId);
    return res.status(200).json({ message: 'Đang khởi động VM...' });
});

export const stopVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id;

    if (!vmName) throw new ErrorResponse("Vui lòng cung cấp tên VM", 400);

    await VmServices.stop(vmName, userId);
    return res.status(200).json({ message: 'Đã gửi lệnh tắt VM' });
});

export const restartVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id;

    if (!vmName) throw new ErrorResponse("Vui lòng cung cấp tên VM", 400);

    await VmServices.restart(vmName, userId);
    return res.status(200).json({ message: 'Đang khởi động lại VM...' });
});

export const deleteVm = asyncHandler(async (req, res) => {
    const { vmName } = req.body;
    const userId = req.user._id;

    if (!vmName) throw new ErrorResponse("Vui lòng cung cấp tên VM", 400);

    await VmServices.delete(vmName, userId);
    return res.status(200).json({ message: 'Đã xóa VM thành công' });
});

export const getVm = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const vms = await VmServices.findManyByUser(userId);
    return res.status(200).json({ message: 'Lấy danh sách VM thành công', vms });
});
export const configVm = asyncHandler(async (req, res) => {
    const { vmName, cpu, ram, disk, vmPassword } = req.body;
    const userId = req.user._id;

    if (!vmName || !cpu || !ram || !disk || !vmPassword) {
        throw new ErrorResponse("Vui lòng điền đủ thông số CPU, RAM, Disk và Mật khẩu VM", 400);
    }
    const vm = await VmServices.configHardware(vmName, userId, cpu, ram, disk, vmPassword);
    
    return res.status(200).json({ 
        message: 'Lệnh cấu hình VM đã được thực thi. VM đang khởi động lại...', 
        vm 
    });
});