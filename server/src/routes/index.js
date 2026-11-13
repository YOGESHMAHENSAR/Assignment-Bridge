import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import { protect, authorize } from '../middleware/auth.js';
import { uploadFiles, MAX_FILE_MB, MAX_FILES } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as tasks from '../controllers/taskController.js';
import * as wallet from '../controllers/walletController.js';
import * as admin from '../controllers/adminController.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes' },
});

/* Public ------------------------------------------------------------ */
router.get('/health', (_req, res) => res.json({ ok: true }));

router.get('/config', (_req, res) => {
  res.json({
    price: env.taskPrice,
    currency: 'INR',
    maxFiles: MAX_FILES,
    maxFileMb: MAX_FILE_MB,
    maxRevisions: env.maxRevisions,
    mockPayments: env.mockPayments,
    mockStorage: !env.cloudinaryEnabled,
  });
});

/* Auth -------------------------------------------------------------- */
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/profile', protect, auth.updateProfile);

/* Tasks ------------------------------------------------------------- */
const taskers = [protect, authorize('tasker')];
const workers = [protect, authorize('worker')];

router.post('/tasks', ...taskers, uploadFiles, tasks.createTask);
router.get('/tasks/mine', ...taskers, tasks.myTasks);
router.get('/tasks/available', ...workers, tasks.availableTasks);
router.get('/tasks/assigned', ...workers, tasks.assignedTasks);

router.get('/tasks/:id', protect, tasks.getTask); // role-aware inside

// tasker
router.post('/tasks/:id/order', ...taskers, tasks.retryPayment);
router.post('/tasks/:id/verify-payment', ...taskers, tasks.verifyTaskPayment);
router.post('/tasks/:id/cancel', ...taskers, tasks.cancelTask);
router.post('/tasks/:id/approve', ...taskers, tasks.approveTask);
router.post('/tasks/:id/revision', ...taskers, tasks.requestRevision);

// worker
router.post('/tasks/:id/accept', ...workers, tasks.acceptTask);
router.post('/tasks/:id/ignore', ...workers, tasks.ignoreTask);
router.post('/tasks/:id/release', ...workers, tasks.releaseTask);
router.post('/tasks/:id/submit', ...workers, uploadFiles, tasks.submitWork);

/* Worker wallet ----------------------------------------------------- */
router.get('/wallet', ...workers, wallet.getWallet);
router.post('/wallet/payouts', ...workers, wallet.requestPayout);

/* Admin ------------------------------------------------------------- */
const admins = [protect, authorize('admin')];
router.get('/admin/stats', ...admins, admin.stats);
router.get('/admin/users', ...admins, admin.listUsers);
router.patch('/admin/users/:id/block', ...admins, admin.setBlocked);
router.get('/admin/tasks', ...admins, admin.listTasks);
router.post('/admin/tasks/:id/cancel', ...admins, admin.adminCancelTask);
router.get('/admin/payouts', ...admins, admin.listPayouts);
router.patch('/admin/payouts/:id', ...admins, admin.processPayout);

export default router;
