import multer from 'multer';
import env from '../config/env.js';
import { MAX_FILE_MB, MAX_FILES } from './upload.js';
import ApiError from '../utils/ApiError.js';

export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  const isCloudinaryError = Number.isInteger(err.http_code);
  const isPaymentProviderError = Number.isInteger(err.statusCode);

  if (isCloudinaryError) {
    status = 502;
    if (err.http_code === 401) {
      message = 'File storage authentication failed. Check the Cloudinary credentials configured on the backend.';
    } else if (err.http_code === 403) {
      message = 'File storage denied this upload. Check that the backend Cloudinary API key has create permission.';
    } else if (err.http_code === 400) {
      message = 'File storage rejected this file or upload request. Check the backend logs for details.';
    } else if (err.http_code === 413) {
      message = 'Cloudinary rejected this file because it exceeds an upload limit.';
    } else if (err.http_code === 429) {
      message = 'Cloudinary is rate limiting uploads. Please try again later.';
    } else {
      message = `Cloudinary upload failed (HTTP ${err.http_code}). Check the backend logs for details.`;
    }
  } else if (isPaymentProviderError) {
    status = 502;
    message = 'The payment service could not process the request. Please try again.';
  } else if (err instanceof multer.MulterError) {
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

  if (status >= 500) console.error(`API error ${_req.method} ${_req.path}`, err);
  res.status(status).json({
    message:
      status >= 500 &&
      env.isProd &&
      !(err instanceof ApiError || isCloudinaryError || isPaymentProviderError)
        ? 'Server error'
        : message,
  });
};
