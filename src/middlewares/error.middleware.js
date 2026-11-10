class ErrorResponse extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    console.error('[ERROR HANDLER]', err);

    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Lỗi từ hệ thống';

    res.status(statusCode).json({
        success: false,
        error: {
            message: message
        }
    });
};

export { errorHandler, ErrorResponse };
