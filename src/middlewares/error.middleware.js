// Một class Error tùy chỉnh để tạo ra các lỗi có cấu trúc, bao gồm cả statusCode
class ErrorResponse extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

/**
 * Middleware xử lý lỗi tập trung.
 * Nó phải được đặt SAU tất cả các routes và middleware khác trong file server chính của bạn.
 * Express sẽ tự động chuyển lỗi đến đây khi bạn gọi next(error).
 * @param {Error} err - Đối tượng lỗi được truyền vào
 * @param {import('express').Request} req - Đối tượng request
 * @param {import('express').Response} res - Đối tượng response
 * @param {import('express').NextFunction} next - Hàm next
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Ghi lại lỗi ra console để dev có thể debug
    // Trong môi trường production, bạn nên dùng một logger chuyên dụng (ví dụ: Winston)
    console.error('[ERROR HANDLER]', err);

    // Xử lý các loại lỗi cụ thể hoặc lỗi từ Mongoose ở đây nếu cần

    // Nếu lỗi là một instance của ErrorResponse tùy chỉnh, hãy dùng thông tin từ nó
    // Ngược lại, đây là một lỗi không mong muốn từ server (500 Internal Server Error)
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Lỗi từ hệ thống';

    // Trả về response lỗi với cấu trúc nhất quán
    res.status(statusCode).json({
        success: false,
        error: {
            message: message
        }
    });
};

export { errorHandler, ErrorResponse };
