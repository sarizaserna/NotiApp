// backend/src/routes/authRoutes.js
import express from 'express';
import {
  registerUser,
  loginUser,
  getProfile
} from '../controllers/authController.js';

import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', verificarToken, getProfile);

export default router;