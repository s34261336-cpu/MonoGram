import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import messengerRouter from "./messenger";
import presenceRouter from "./presence";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/messenger", messengerRouter);
router.use(presenceRouter);

export default router;
