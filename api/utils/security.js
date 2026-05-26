import { LIMITS } from '../config/constants.js';

export function isBannedExtension(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return LIMITS.BANNED_EXTENSIONS.has(ext);
}

export function hasPathTraversal(entryName) {
  const normalized = entryName.replace(/\\/g, '/');
  const parts = normalized.split('/');
  let depth = 0;
  for (const part of parts) {
    if (part === '..') depth--;
    else if (part !== '.' && part !== '') depth++;
    if (depth < 0) return true;
  }
  return normalized.startsWith('/') || normalized.includes('..');
}

export function hasHiddenFile(entryName) {
  const parts = entryName.replace(/\\/g, '/').split('/');
  return parts.some(p => p.startsWith('.') && p !== '.' && p !== '..');
}

export async function detectZipBomb(entry, getSize, getCompressedSize) {
  const compressed = getCompressedSize(entry);
  const uncompressed = getSize(entry);
  if (compressed > 0 && uncompressed / compressed > LIMITS.MAX_ZIP_COMPRESSION_RATIO) {
    const entryName = entry.entryName || entry.name || 'unknown';
    throw new Error(`Zip bomb detected: ${entryName} has compression ratio ${(uncompressed / compressed).toFixed(1)}x (max ${LIMITS.MAX_ZIP_COMPRESSION_RATIO}x)`);
  }
}

export function validateFileCount(count) {
  if (count > LIMITS.MAX_FILES_IN_ZIP) {
    throw new Error(`Too many files in ZIP: ${count} (max ${LIMITS.MAX_FILES_IN_ZIP})`);
  }
}

export function validateFilenameLength(name) {
  if (name.length > LIMITS.MAX_FILENAME_LENGTH) {
    throw new Error(`Filename too long: ${name.length} chars (max ${LIMITS.MAX_FILENAME_LENGTH})`);
  }
}

export function validateExtractedSize(totalSize) {
  if (totalSize > LIMITS.MAX_EXTRACTED_SIZE) {
    throw new Error(`Extracted size exceeds limit: ${(totalSize / 1024 / 1024).toFixed(1)}MB (max ${LIMITS.MAX_EXTRACTED_SIZE / 1024 / 1024}MB)`);
  }
}

export function sanitizeEntryName(entryName) {
  return entryName.replace(/\\/g, '/').replace(/^\/+/, '');
}
