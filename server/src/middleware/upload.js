import path from 'path';
import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.txt', '.rtf', '.odt',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.zip',
]);

export const MAX_FILE_MB = 10;
export const MAX_FILES = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new ApiError(400, `File type "${ext || 'unknown'}" is not allowed`));
    }
    cb(null, true);
  },
});

export const uploadFiles = upload.array('files', MAX_FILES);
