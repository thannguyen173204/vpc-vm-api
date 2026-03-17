import { errorHandler } from "../middlewares/error.middleware.js";
import { verifyToken } from "../middlewares/verify.middleware.js";
import { vmRoute } from "./vm.route.js";

export const serverRoute = (app) => {
    app.use('/', verifyToken, vmRoute);
    app.use(errorHandler);
}
