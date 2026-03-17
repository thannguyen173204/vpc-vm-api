import { errorHandler } from "../middlewares/error.middleware.js";
import { verifyToken } from "../middlewares/verify.middleware.js";
import { vmRoute } from "./vm.route.js";

export const serverRoute = (app) => {
    // Thêm middleware này lên đầu để log MỌI request bay vào container
    app.use((req, res, next) => {
        console.log(`[DEBUG VM-API] Đã nhận request: ${req.method} ${req.originalUrl}`);
        next();
    });

    // Route chính thức
    app.use('/vm', verifyToken, vmRoute);

    app.use(errorHandler);
}
