import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './services/storage.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (env.clientUrls.includes(origin.toLowerCase())) return cb(null, true);
      console.warn(`CORS blocked origin "${origin}". Allowed: ${env.clientUrls.join(', ')}`);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
if (!env.isProd) app.use(morgan('dev'));

// Only used when Cloudinary is not configured (local development).
if (!env.cloudinaryEnabled) {
  app.use('/uploads', express.static(UPLOAD_DIR, { setHeaders: (res) => res.setHeader('Content-Disposition', 'attachment') }));
}

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;
