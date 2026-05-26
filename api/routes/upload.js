import { Router } from 'express';
import { uploadZip, handleMulterError } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rate-limit.js';
import { processZipUpload, validateZipBuffer } from '../services/zip-pipeline.js';

const router = Router();

router.post('/zip',
  authenticate,
  uploadLimiter,
  uploadZip.single('file'),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await processZipUpload(
        req.file.buffer,
        req.file.originalname,
        req.user.uid
      );

      if (result.status === 'failed') {
        return res.status(422).json({
          error: 'ZIP processing failed',
          botId: result.botId,
          steps: result.steps,
          errors: result.errors,
          warnings: result.warnings,
        });
      }

      res.status(201).json({
        message: 'Bot uploaded and processed successfully',
        bot: {
          id: result.botId,
          language: result.language,
          entryPoint: result.entryPoint,
          version: result.version,
          fileCount: result.fileCount,
          extractedSize: result.extractedSize,
          totalBytes: result.totalBytes,
          hasDependencies: result.hasDependencies,
          dependencies: result.dependencies,
        },
        steps: result.steps,
        warnings: result.warnings,
      });
    } catch (err) {
      console.error('[UPLOAD]', err);
      res.status(500).json({
        error: 'Upload processing failed',
        message: err.message,
      });
    }
  }
);

router.post('/validate',
  authenticate,
  uploadZip.single('file'),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      validateZipBuffer(req.file.buffer);

      const preview = await processZipUpload(
        req.file.buffer,
        req.file.originalname,
        req.user.uid
      );

      const filesDir = `./bots/${preview.botId}`;
      const { deleteBotFiles } = await import('../services/storage.js');
      await deleteBotFiles(preview.botId);

      res.json({
        valid: preview.status !== 'failed',
        language: preview.language,
        entryPoint: preview.entryPoint,
        version: preview.version,
        fileCount: preview.fileCount,
        errors: preview.errors,
        warnings: preview.warnings,
        steps: preview.steps,
      });
    } catch (err) {
      res.status(422).json({ valid: false, error: err.message });
    }
  }
);

export default router;
