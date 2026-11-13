import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpires });

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Please log in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new ApiError(401, 'Session expired, please log in again');
  }

  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'Account no longer exists');
  if (user.isBlocked) throw new ApiError(403, 'Your account has been blocked. Contact support.');

  req.user = user;
  next();
});

/** Role-based access: authorize('tasker'), authorize('admin', 'worker') ... */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to do this'));
    }
    next();
  };
