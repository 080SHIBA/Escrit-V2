import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { createUploadSignature } from '../services/cloudinary.js';

export const uploadsRouter = Router();

uploadsRouter.post('/', requireAuth, uploadLimiter, asyncHandler(async (_req, res) => {
  res.json(createUploadSignature());
}));
