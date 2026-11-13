import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  assertObjectId,
  cleanString,
  escapeRegex,
  pagedResponse,
  parsePaging,
} from '../utils/helpers.js';
import { storeFiles, removeFiles } from '../services/storage.js';
import { createOrder, verifyPayment } from '../services/payments.js';
import { cancelTaskWithRefund } from '../services/taskCancel.js';
import { MAX_FILES } from '../middleware/upload.js';
import { hasPdfFile, pdfFileQuery } from '../utils/taskFiles.js';
import { hasLocationPoint, isWithinTaskRadius, normalizeLocation, taskRadiusQuery } from '../utils/location.js';
import { emitToTaskRoom } from '../services/realtime.js';
import { notifyUser } from '../services/notifications.js';

/* ------------------------------------------------------------------ */
/* Role-aware field visibility                                         */
/*  - workers never see what the tasker paid or the platform's cut     */
/*  - taskers never see the worker's earning or the platform's cut     */
/* ------------------------------------------------------------------ */
const HIDDEN_FIELDS = {
  admin: '-ignoredBy',
  tasker: '-ignoredBy -workerEarning -platformFee',
  worker: '-ignoredBy -payment -price -platformFee',
};

const USER_FIELDS = 'name ratingSum ratingCount completedCount';

const withUsers = (query) =>
  query.populate('tasker', USER_FIELDS).populate('worker', USER_FIELDS);

const sameId = (a, b) => a && b && String(a._id || a) === String(b._id || b);

/* ------------------------------------------------------------------ */
/* Tasker: create request + pay                                        */
/* ------------------------------------------------------------------ */
export const createTask = asyncHandler(async (req, res) => {
  const title = cleanString(req.body.title, 120);
  const description = cleanString(req.body.description, 5000);
  const subject = cleanString(req.body.subject, 60);
  const additionalInfo = cleanString(req.body.additionalInfo, 3000);
  const pages = req.body.pages !== undefined && req.body.pages !== '' ? Number(req.body.pages) : undefined;
  const deadline = req.body.deadline ? new Date(req.body.deadline) : undefined;
  const workLocation = normalizeLocation(req.body.workLocation, 'Work location');

  if (!title) throw new ApiError(400, 'Give the assignment a title');
  if (!description) throw new ApiError(400, 'Tell the worker what needs to be done');
  if (pages !== undefined && (!Number.isFinite(pages) || pages < 0)) throw new ApiError(400, 'Pages must be a positive number');
  if (deadline && (Number.isNaN(deadline.getTime()) || deadline <= new Date())) {
    throw new ApiError(400, 'Deadline must be a valid time in the future');
  }
  if (!hasPdfFile(req.files)) throw new ApiError(400, 'Attach at least one PDF assignment file');

  const files = await storeFiles(req.files, 'requests');

  try {
    const task = new Task({
      title,
      subject,
      description,
      additionalInfo,
      pages,
      deadline,
      files,
      workLocation,
      tasker: req.user._id,
      price: env.taskPrice,
      workerEarning: env.workerEarning,
      platformFee: env.platformFee,
    });

    const order = await createOrder(task);
    task.payment.orderId = order.id;
    task.payment.orderIds = [order.id];
    task.payment.mock = order.mock;
    await task.save();

    res.status(201).json({ task: task.toObject({ versionKey: false }), order: toClientOrder(order) });
  } catch (err) {
    await removeFiles(files);
    throw err;
  }
});

export const updateTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const task = await Task.findOne({ _id: req.params.id, tasker: req.user._id });
  if (!task) throw new ApiError(404, 'Task not found');
  if (!['pending_payment', 'open'].includes(task.status) || task.worker) {
    throw new ApiError(409, 'You can only edit a request before a worker accepts it');
  }

  const title = cleanString(req.body.title, 120);
  const description = cleanString(req.body.description, 5000);
  const subject = cleanString(req.body.subject, 60);
  const additionalInfo = cleanString(req.body.additionalInfo, 3000);
  const pages = req.body.pages !== undefined && req.body.pages !== '' ? Number(req.body.pages) : undefined;
  const deadline = req.body.deadline ? new Date(req.body.deadline) : undefined;
  const workLocation = normalizeLocation(req.body.workLocation, 'Work location');

  if (!title) throw new ApiError(400, 'Give the assignment a title');
  if (!description) throw new ApiError(400, 'Tell the worker what needs to be done');
  if (pages !== undefined && (!Number.isFinite(pages) || pages < 0)) throw new ApiError(400, 'Pages must be a positive number');
  if (deadline && (Number.isNaN(deadline.getTime()) || deadline <= new Date())) {
    throw new ApiError(400, 'Deadline must be a valid time in the future');
  }

  let removeUrls = [];
  if (req.body.removeFileUrls) {
    try {
      removeUrls = JSON.parse(req.body.removeFileUrls);
    } catch {
      throw new ApiError(400, 'Invalid file removal request');
    }
    if (!Array.isArray(removeUrls) || removeUrls.some((url) => typeof url !== 'string')) {
      throw new ApiError(400, 'Invalid file removal request');
    }
  }

  const removeSet = new Set(removeUrls);
  if (
    removeSet.size !== removeUrls.length ||
    [...removeSet].some((url) => !task.files.some((file) => file.url === url))
  ) {
    throw new ApiError(400, 'One or more selected files do not belong to this request');
  }

  const removedFiles = task.files.filter((file) => removeSet.has(file.url));
  const keptFiles = task.files.filter((file) => !removeSet.has(file.url));
  const incomingFiles = req.files || [];
  if (keptFiles.length + incomingFiles.length > MAX_FILES) {
    throw new ApiError(400, `You can attach at most ${MAX_FILES} files`);
  }
  if (!hasPdfFile([...keptFiles, ...incomingFiles])) {
    throw new ApiError(400, 'Keep or upload at least one PDF assignment file');
  }

  const uploadedFiles = await storeFiles(incomingFiles, 'requests');
  const fields = { title, subject, description, additionalInfo, files: [...keptFiles, ...uploadedFiles], workLocation };
  const unset = {};
  if (pages === undefined) unset.pages = 1;
  else fields.pages = pages;
  if (!deadline) unset.deadline = 1;
  else fields.deadline = deadline;

  let updatedTask;
  try {
    updatedTask = await Task.findOneAndUpdate(
      {
        _id: task._id,
        tasker: req.user._id,
        status: { $in: ['pending_payment', 'open'] },
        worker: null,
        updatedAt: task.updatedAt,
      },
      { $set: fields, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true }
    );
  } catch (err) {
    await removeFiles(uploadedFiles);
    throw err;
  }

  if (!updatedTask) {
    await removeFiles(uploadedFiles);
    throw new ApiError(409, 'This request changed while you were editing. Reload and try again.');
  }

  await removeFiles(removedFiles);
  res.json({ task: updatedTask });
});

const toClientOrder = (order) => ({
  id: order.id,
  amount: order.amount,
  currency: order.currency,
  mock: order.mock,
  keyId: order.mock ? null : env.razorpay.keyId,
});

/** Create a fresh payment order for a task that is still unpaid (e.g. checkout was closed). */
export const retryPayment = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const task = await Task.findOne({ _id: req.params.id, tasker: req.user._id });
  if (!task) throw new ApiError(404, 'Task not found');
  if (task.status !== 'pending_payment') throw new ApiError(409, 'This task is already paid');
  if (!hasPdfFile(task.files)) throw new ApiError(409, 'Attach a PDF assignment file before continuing to payment');

  const order = await createOrder(task);
  task.payment.orderId = order.id;
  task.payment.orderIds.push(order.id);
  task.payment.mock = order.mock;
  await task.save();

  res.json({ order: toClientOrder(order) });
});

export const verifyTaskPayment = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;

  const task = await Task.findOne({ _id: req.params.id, tasker: req.user._id });
  if (!task) throw new ApiError(404, 'Task not found');

  // Idempotent: a repeated verify call for the same payment just succeeds.
  if (task.status !== 'pending_payment') {
    if (task.payment.paymentId && task.payment.paymentId === paymentId) return res.json({ task });
    throw new ApiError(409, 'This task is not awaiting payment');
  }
  if (!hasPdfFile(task.files)) throw new ApiError(409, 'Attach a PDF assignment file before continuing to payment');
  if (!task.payment.orderIds.includes(orderId)) throw new ApiError(400, 'Order does not match this task');
  if (!verifyPayment({ orderId, paymentId, signature })) {
    throw new ApiError(400, 'Payment verification failed');
  }

  const updated = await Task.findOneAndUpdate(
    { _id: task._id, status: 'pending_payment' },
    {
      status: 'open',
      'payment.status': 'paid',
      'payment.orderId': orderId,
      'payment.paymentId': paymentId,
      'payment.paidAt': new Date(),
    },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'This task is not awaiting payment');

  await Transaction.create({
    type: 'task_payment',
    task: task._id,
    user: req.user._id,
    amount: task.price,
    reference: paymentId,
  });

  res.json({ task: updated });
});

export const cancelTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const task = await cancelTaskWithRefund(req.params.id, { taskerId: req.user._id });
  res.json({ task });
});

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */
export const myTasks = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = { tasker: req.user._id };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };

  const [items, total, counts] = await Promise.all([
    withUsers(Task.find(filter).select(HIDDEN_FIELDS.tasker).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit)),
    Task.countDocuments(filter),
    Task.aggregate([{ $match: { tasker: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  res.json({
    ...pagedResponse(items, total, paging),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
  });
});

export const availableTasks = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = {
    status: 'open',
    tasker: { $ne: req.user._id },
    ignoredBy: { $ne: req.user._id },
    ...pdfFileQuery(),
    ...taskRadiusQuery(req.user.location),
  };
  const search = cleanString(req.query.search, 60);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: rx }, { subject: rx }, { description: rx }];
  }

  const [items, total] = await Promise.all([
    withUsers(Task.find(filter).select(HIDDEN_FIELDS.worker).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit)),
    Task.countDocuments(filter),
  ]);
  res.json(pagedResponse(items, total, paging));
});

export const assignedTasks = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = { worker: req.user._id };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };

  const [items, total, counts] = await Promise.all([
    withUsers(Task.find(filter).select(HIDDEN_FIELDS.worker).sort({ updatedAt: -1 }).skip(paging.skip).limit(paging.limit)),
    Task.countDocuments(filter),
    Task.aggregate([{ $match: { worker: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  res.json({
    ...pagedResponse(items, total, paging),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
  });
});

export const getTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const { user } = req;
  const task = await withUsers(Task.findById(req.params.id).select(HIDDEN_FIELDS[user.role]));
  if (!task) throw new ApiError(404, 'Task not found');

  if (user.role === 'tasker' && !sameId(task.tasker, user._id)) throw new ApiError(403, 'This is not your task');
  if (user.role === 'worker') {
    const mine = sameId(task.worker, user._id);
    if (!mine && task.status !== 'open') throw new ApiError(403, 'This task is no longer available');
    if (!mine && sameId(task.tasker, user._id)) throw new ApiError(403, 'You cannot work on your own task');
    if (!mine && !isWithinTaskRadius(user.location, task.workLocation)) {
      throw new ApiError(403, 'This request is outside your 2 km campus work radius');
    }
  }

  res.json({ task });
});

/* ------------------------------------------------------------------ */
/* Worker actions                                                      */
/* ------------------------------------------------------------------ */
export const acceptTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  if (!hasLocationPoint(req.user.location)) {
    throw new ApiError(400, 'Add your campus location in your profile before accepting nearby requests');
  }
  const active = await Task.countDocuments({
    worker: req.user._id,
    status: { $in: ['accepted', 'revision'] },
  });
  if (active >= env.maxActiveTasksPerWorker) {
    throw new ApiError(409, `You can work on at most ${env.maxActiveTasksPerWorker} tasks at a time. Submit one first.`);
  }

  const candidate = await Task.findOne({
    _id: req.params.id,
    status: 'open',
    tasker: { $ne: req.user._id },
    ...pdfFileQuery(),
  });
  if (!candidate) throw new ApiError(409, 'Sorry, this task is no longer available');
  if (!isWithinTaskRadius(req.user.location, candidate.workLocation)) {
    throw new ApiError(403, 'This request is outside your 2 km campus work radius');
  }

  // Atomic: only one worker can win the task.
  const task = await Task.findOneAndUpdate(
    {
      _id: req.params.id,
      status: 'open',
      tasker: { $ne: req.user._id },
      ...pdfFileQuery(),
      ...taskRadiusQuery(req.user.location),
    },
    { status: 'accepted', worker: req.user._id, acceptedAt: new Date() },
    { new: true }
  );
  if (!task) throw new ApiError(409, 'Sorry, this task is no longer available');

  const full = await withUsers(Task.findById(task._id).select(HIDDEN_FIELDS.worker));
  notifyUser(full.tasker._id, {
    type: 'task_accepted',
    title: 'Your request was accepted',
    body: `${full.worker.name} accepted "${full.title}"`,
    url: `/tasks/${full._id}`,
    tag: `task-accepted-${full._id}`,
  }).catch((error) => console.error('Could not send task acceptance notification', error.message));
  res.json({ task: full });
});

export const ignoreTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  await Task.updateOne(
    { _id: req.params.id, status: 'open' },
    { $addToSet: { ignoredBy: req.user._id } }
  );
  res.json({ ok: true });
});

/** Worker gives an accepted task back before submitting anything. */
export const releaseTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, worker: req.user._id, status: 'accepted' },
    {
      status: 'open',
      $unset: { worker: 1, acceptedAt: 1 },
      $addToSet: { ignoredBy: req.user._id },
    },
    { new: true }
  );
  if (!task) throw new ApiError(409, 'You can only release a task you accepted and have not submitted');
  emitToTaskRoom(task._id, 'task:chat-closed', { taskId: String(task._id), reason: 'Worker released the task' });
  res.json({ ok: true });
});

export const submitWork = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  if (!req.files?.length) throw new ApiError(400, 'Upload at least one file of the completed work');
  const note = cleanString(req.body.note, 2000);

  // Check ownership/status before spending bandwidth on storage.
  const current = await Task.findOne({ _id: req.params.id, worker: req.user._id, status: { $in: ['accepted', 'revision'] } }).select('_id');
  if (!current) throw new ApiError(409, 'This task is not waiting for your submission');

  const files = await storeFiles(req.files, 'submissions');
  const now = new Date();
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, worker: req.user._id, status: { $in: ['accepted', 'revision'] } },
    { status: 'submitted', submittedAt: now, $push: { submissions: { files, note, submittedAt: now } } },
    { new: true }
  );
  if (!task) {
    await removeFiles(files);
    throw new ApiError(409, 'This task is not waiting for your submission');
  }

  const full = await withUsers(Task.findById(task._id).select(HIDDEN_FIELDS.worker));
  res.json({ task: full });
});

/* ------------------------------------------------------------------ */
/* Tasker review                                                       */
/* ------------------------------------------------------------------ */
export const approveTask = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const rating = req.body.rating !== undefined && req.body.rating !== '' ? Number(req.body.rating) : undefined;
  const comment = cleanString(req.body.comment, 1000);
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new ApiError(400, 'Rating must be a whole number from 1 to 5');
  }

  const review = {};
  if (rating) review.rating = rating;
  if (comment) review.comment = comment;

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, tasker: req.user._id, status: 'submitted' },
    { status: 'approved', completedAt: new Date(), review },
    { new: true }
  );
  if (!task) throw new ApiError(409, 'There is no submitted work to approve on this task');
  emitToTaskRoom(task._id, 'task:chat-closed', { taskId: String(task._id), reason: 'Task completed' });

  // Split the payment: worker earning goes to the worker's wallet, the rest stays with the platform.
  const workerUpdate = { $inc: { balance: task.workerEarning, totalEarned: task.workerEarning, completedCount: 1 } };
  if (rating) {
    workerUpdate.$inc.ratingSum = rating;
    workerUpdate.$inc.ratingCount = 1;
  }
  await User.findByIdAndUpdate(task.worker, workerUpdate);
  await Task.updateOne({ _id: task._id }, { workerPaid: true });
  await Transaction.insertMany([
    { type: 'worker_earning', task: task._id, user: task.worker, amount: task.workerEarning },
    { type: 'platform_fee', task: task._id, amount: task.platformFee },
  ]);

  const full = await withUsers(Task.findById(task._id).select(HIDDEN_FIELDS.tasker));
  res.json({ task: full });
});

export const requestRevision = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const note = cleanString(req.body.note, 2000);
  if (!note) throw new ApiError(400, 'Explain what needs to be changed');

  const existing = await Task.findOne({ _id: req.params.id, tasker: req.user._id, status: 'submitted' }).select('revisionCount');
  if (!existing) throw new ApiError(409, 'There is no submitted work to review on this task');
  if (existing.revisionCount >= env.maxRevisions) {
    throw new ApiError(409, `The limit of ${env.maxRevisions} revisions has been reached. Please approve the work or contact support.`);
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, tasker: req.user._id, status: 'submitted' },
    { status: 'revision', revisionNote: note, $inc: { revisionCount: 1 } },
    { new: true }
  );
  if (!task) throw new ApiError(409, 'There is no submitted work to review on this task');

  const full = await withUsers(Task.findById(task._id).select(HIDDEN_FIELDS.tasker));
  res.json({ task: full });
});
