import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import env from '../config/env.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

let io;

const userRoom = (userId) => `user:${userId}`;
const taskRoom = (taskId) => `task:${taskId}`;
const sameId = (left, right) => left && right && String(left._id || left) === String(right._id || right);

export function configureRealtime(server) {
  io = new Server(server, {
    cors: { origin: env.clientUrls, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next(new Error('Authentication required'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.id).select('_id role isBlocked');
      if (!user || user.isBlocked) return next(new Error('Account is unavailable'));
      socket.data.user = { id: String(user._id), role: user.role };
      next();
    } catch {
      next(new Error('Session expired, please log in again'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.data.user.id));

    socket.on('task:join', async (taskId, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      if (!mongoose.isValidObjectId(taskId)) return reply({ ok: false, message: 'Invalid task id' });

      try {
        const task = await Task.findById(taskId).select('tasker worker acceptedAt status');
        const user = socket.data.user;
        const isTasker = user.role === 'tasker' && sameId(task?.tasker, user.id);
        const isWorker = user.role === 'worker' && sameId(task?.worker, user.id);
        if (!task || !task.worker || !task.acceptedAt ||
          !['accepted', 'submitted', 'revision'].includes(task.status) ||
          (!isTasker && !isWorker)) {
          return reply({ ok: false, message: 'You cannot join this task chat' });
        }

        await socket.join(taskRoom(taskId));
        reply({ ok: true });
      } catch (error) {
        console.error('Could not validate task chat room membership', error.message);
        reply({ ok: false, message: 'Could not join this task chat' });
      }
    });

    socket.on('task:leave', (taskId) => {
      if (mongoose.isValidObjectId(taskId)) socket.leave(taskRoom(taskId));
    });
  });

  return io;
}

export const emitToUser = (userId, event, payload) => {
  if (io && userId) io.to(userRoom(userId)).emit(event, payload);
};

export const emitToTaskRoom = (taskId, event, payload) => {
  if (io && taskId) io.to(taskRoom(taskId)).emit(event, payload);
};
