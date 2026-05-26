import multer from 'multer';
import { LIMITS } from '../config/constants.js';

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowedMimes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-tar',
    'application/gzip',
  ];
  const allowedExts = ['.zip', '.tar.gz', '.tgz'];

  const ext = '.' + file.originalname.split('.').pop().toLowerCase();
  const isAllowedMime = allowedMimes.includes(file.mimetype);
  const isAllowedExt = allowedExts.includes(ext);

  if (!isAllowedMime && !isAllowedExt) {
    cb(new Error(`Unsupported file type: ${file.mimetype} (${ext}). Only ZIP files are allowed.`), false);
    return;
  }

  cb(null, true);
}

export const uploadZip = multer({
  storage,
  limits: {
    fileSize: LIMITS.MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: `Maximum file size is ${LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }
    return res.status(400).json({ error: 'Upload error', message: err.message });
  }
  if (err) {
    return res.status(400).json({ error: 'Invalid file', message: err.message });
  }
  next();
}
