import multer from 'multer';
import env from '../config/env.js';
import { MAX_FILE_MB, MAX_FILES } from './upload.js';

export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = `Each file must be under ${MAX_FILE_MB} MB`;
    else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE')
      message = `You can upload at most ${MAX_FILES} files`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409;
    message = 'That value is already in use';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 && env.isProd ? 'Server error' : message,
  });
};
