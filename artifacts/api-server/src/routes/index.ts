import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import visionRouter from "./agents/vision";
import tripGenerateRouter from "./trip/generate";
import conciergeChatRouter from "./concierge/chat";
import dialectRouter from "./dialect";
import postsRouter from "./posts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(visionRouter);
router.use(tripGenerateRouter);
router.use(conciergeChatRouter);
router.use(dialectRouter);
router.use(postsRouter);

export default router;
