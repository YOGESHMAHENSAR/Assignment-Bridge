import User from '../models/User.js';
import Task from '../models/Task.js';
import Payout from '../models/Payout.js';
import Transaction from '../models/Transaction.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { assertObjectId, cleanString, escapeRegex, pagedResponse, parsePaging } from '../utils/helpers.js';
import { cancelTaskWithRefund } from '../services/taskCancel.js';

const sum = (rows, key = 'total') => rows[0]?.[key] || 0;
const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

export const stats = asyncHandler(async (_req, res) => {
  const [users, tasks, money, payouts, balances] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([
      {
        $facet: {
          collected: [{ $match: { 'payment.status': 'paid' } }, { $group: { _id: null, total: { $sum: '$price' } } }],
          inEscrow: [
            { $match: { 'payment.status': 'paid', status: { $in: ['open', 'accepted', 'submitted', 'revision'] } } },
            { $group: { _id: null, total: { $sum: '$price' } } },
          ],
          completed: [
            { $match: { status: 'approved' } },
            { $group: { _id: null, platform: { $sum: '$platformFee' }, worker: { $sum: '$workerEarning' }, gross: { $sum: '$price' } } },
          ],
          refunded: [{ $match: { 'payment.status': 'refunded' } }, { $group: { _id: null, total: { $sum: '$price' } } }],
        },
      },
    ]),
    Payout.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }]),
    User.aggregate([{ $match: { role: 'worker' } }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
  ]);

  const m = money[0];
  const payoutBy = Object.fromEntries(payouts.map((p) => [p._id, p]));

  res.json({
    users: toMap(users),
    tasks: toMap(tasks),
    money: {
      collected: sum(m.collected), // all money received from taskers (not refunded)
      inEscrow: sum(m.inEscrow), // paid but task not finished yet
      completedRevenue: sum(m.completed, 'gross'),
      platformEarnings: sum(m.completed, 'platform'), // platform's cut on approved tasks
      workerEarned: sum(m.completed, 'worker'),
      refunded: sum(m.refunded),
      workerBalances: sum(balances), // owed to workers, not yet requested
      payoutsPending: payoutBy.requested?.total || 0,
      payoutsPaid: payoutBy.paid?.total || 0,
    },
    pendingPayoutCount: payoutBy.requested?.count || 0,
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query, 20);
  const filter = {};
  if (['admin', 'tasker', 'worker'].includes(req.query.role)) filter.role = req.query.role;
  const search = cleanString(req.query.search, 60);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
    User.countDocuments(filter),
  ]);
  res.json(pagedResponse(items, total, paging));
});

export const setBlocked = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role === 'admin') throw new ApiError(400, 'Admin accounts cannot be blocked');
  user.isBlocked = Boolean(req.body.blocked);
  await user.save();
  res.json({ user });
});

export const listTasks = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query, 20);
  const filter = {};
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  const search = cleanString(req.query.search, 60);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: rx }, { subject: rx }];
  }
  const [items, total] = await Promise.all([
    Task.find(filter)
      .select('-ignoredBy')
      .populate('tasker', 'name email')
      .populate('worker', 'name email')
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Task.countDocuments(filter),
  ]);
  res.json(pagedResponse(items, total, paging));
});

export const adminCancelTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const task = await cancelTaskWithRefund(req.params.id);
  res.json({ task });
});

export const listPayouts = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query, 20);
  const filter = {};
  if (['requested', 'paid', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Payout.find(filter)
      .populate('worker', 'name email')
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Payout.countDocuments(filter),
  ]);
  res.json(pagedResponse(items, total, paging));
});

/** Admin pays the worker (outside the app, e.g. via UPI) then marks it paid, or rejects and releases the hold. */
export const processPayout = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const { status } = req.body;
  if (!['paid', 'rejected'].includes(status)) throw new ApiError(400, 'Status must be "paid" or "rejected"');
  const reference = cleanString(req.body.reference, 120);
  const adminNote = cleanString(req.body.note, 500);
  if (status === 'rejected' && !adminNote) throw new ApiError(400, 'Add a note explaining why it was rejected');

  const payout = await Payout.findOneAndUpdate(
    { _id: req.params.id, status: 'requested' },
    { status, reference, adminNote, processedAt: new Date() },
    { new: true }
  );
  if (!payout) throw new ApiError(409, 'This payout request was already processed');

  if (status === 'rejected') {
    await User.updateOne({ _id: payout.worker }, { $inc: { balance: payout.amount } });
  } else {
    await Transaction.create({ type: 'payout', user: payout.worker, amount: payout.amount, reference });
  }

  await payout.populate('worker', 'name email');
  res.json({ payout });
});
