import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import {
  getProfile,
  updateProfile,
  deleteProfile,
  getUsers,
} from "../controllers/userController";
const router = Router();
router.use(authenticate);
router.get("/users", getUsers);
router.get("/users/me", getProfile);
router.patch("/users/me", updateProfile);
router.delete("/users/me", deleteProfile);
export default router;
