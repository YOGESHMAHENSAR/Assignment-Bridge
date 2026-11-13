import Task from '../models/Task.js';
import Message from '../models/Message.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/helpers.js';
import { isChatOpen, normalizeMessage } from '../utils/chat.js';
import { emitToTaskRoom } from '../services/realtime.js';
import { notifyUser } from '../services/notifications.js';

const sameId = (left, right) => left && right && String(left._id || left) === String(right._id || right);

const getConversationTask = async (taskId, user) => {
  assertObjectId(taskId);
  const task = await Task.findById(taskId).select('tasker worker acceptedAt status title');
  if (!task) throw new ApiError(404, 'Task not found');

  const isTasker = user.role === 'tasker' && sameId(task.tasker, user._id);
  const isAssignedWorker = user.role === 'worker' && sameId(task.worker, user._id);
  if (!task.acceptedAt || !task.worker || (!isTasker && !isAssignedWorker)) {
    throw new ApiError(403, 'Chat is available only to the tasker and the worker assigned to this task');
  }
  return task;
};

export const listMessages = asyncHandler(async (req, res) => {
  const task = await getConversationTask(req.params.id, req.user);
  const messages = await Message.find({ task: task._id, worker: task.worker })
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .populate('sender', 'name role');

  res.json({
    messages: messages.reverse(),
    chatOpen: isChatOpen(task.status),
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const task = await getConversationTask(req.params.id, req.user);
  if (!isChatOpen(task.status)) throw new ApiError(409, 'Chat is closed because this task is no longer active');

  const content = normalizeMessage(req.body.content);
  const stillOpen = await Task.exists({
    _id: task._id,
    worker: task.worker,
    status: { $in: ['accepted', 'submitted', 'revision'] },
  });
  if (!stillOpen) throw new ApiError(409, 'Chat is closed because this task is no longer active');

  const message = await Message.create({
    task: task._id,
    worker: task.worker,
    sender: req.user._id,
    content,
  });
  const remainsOpen = await Task.exists({
    _id: task._id,
    worker: task.worker,
    status: { $in: ['accepted', 'submitted', 'revision'] },
  });
  if (!remainsOpen) {
    await Message.deleteOne({ _id: message._id });
    throw new ApiError(409, 'Chat is closed because this task is no longer active');
  }

  await message.populate('sender', 'name role');
  const messagePayload = {
    _id: String(message._id),
    task: String(task._id),
    sender: { _id: String(req.user._id), name: req.user.name, role: req.user.role },
    content: message.content,
    createdAt: message.createdAt,
  };
  emitToTaskRoom(task._id, 'chat:new-message', { taskId: String(task._id), message: messagePayload });

  const recipientId = sameId(task.tasker, req.user._id) ? task.worker : task.tasker;
  notifyUser(recipientId, {
    type: 'chat_message',
    title: `New message from ${req.user.name}`,
    body: `New message about "${task.title}"`,
    url: `/tasks/${task._id}`,
    tag: `task-chat-${task._id}`,
  }).catch((error) => console.error('Could not send message notification', error.message));

  res.status(201).json({ message, chatOpen: true });
});
