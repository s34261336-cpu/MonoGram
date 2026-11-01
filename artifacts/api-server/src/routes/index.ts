import { Router, type IRouter } from "express";
import chatsRouter from "./chats";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatsRouter);

export default router;
