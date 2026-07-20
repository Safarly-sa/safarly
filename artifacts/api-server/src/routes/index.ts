import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import visionRouter from "./agents/vision";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(visionRouter);

export default router;
