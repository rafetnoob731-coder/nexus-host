import rateLimit from 'express-rate-limit';

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads', message: 'Max 20 uploads per hour' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded', message: 'Max 100 requests per minute' },
  standardHeaders: true,
  legacyHeaders: false,
});
