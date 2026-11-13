import dotenv from 'dotenv';

dotenv.config();

const num = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const port = num(process.env.PORT, 5000);
const nodeEnv = process.env.NODE_ENV || 'development';
const taskPrice = num(process.env.TASK_PRICE, 100);
const workerEarning = num(process.env.WORKER_EARNING, 50);
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (Boolean(vapidPublicKey) !== Boolean(vapidPrivateKey)) {
  throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must both be set for web push');
}

if (workerEarning > taskPrice) {
  throw new Error('WORKER_EARNING cannot be greater than TASK_PRICE');
}

if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assignment_bridge',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
    clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean),
  serverUrl: (process.env.SERVER_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  vapid: {
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  },

  taskPrice,
  workerEarning,
  platformFee: taskPrice - workerEarning,
  maxActiveTasksPerWorker: num(process.env.MAX_ACTIVE_TASKS_PER_WORKER, 5),
  maxRevisions: num(process.env.MAX_REVISIONS, 3),
  minPayout: num(process.env.MIN_PAYOUT, 50),

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  admin: {
    name: process.env.ADMIN_NAME || 'Platform Admin',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  },
};

env.razorpayEnabled = Boolean(env.razorpay.keyId && env.razorpay.keySecret);
env.cloudinaryEnabled = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);
// Demo payments are only ever allowed outside production.
env.mockPayments = !env.razorpayEnabled && !env.isProd;
env.webPushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);

export default env;
