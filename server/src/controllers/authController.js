import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { cleanString } from '../utils/helpers.js';
import { signToken } from '../middleware/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authResponse = (user) => ({ token: signToken(user), user });

export const register = asyncHandler(async (req, res) => {
  const name = cleanString(req.body.name, 80);
  const email = cleanString(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role;
  const phone = cleanString(req.body.phone, 20);

  if (!name) throw new ApiError(400, 'Name is required');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Enter a valid email address');
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
  // Admin accounts can never be self-registered.
  if (!['tasker', 'worker'].includes(role)) {
    throw new ApiError(400, 'Choose a role: tasker or worker');
  }
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');

  const user = await User.create({ name, email, password, role, phone });
  res.status(201).json(authResponse(user));
});

export const login = asyncHandler(async (req, res) => {
  const email = cleanString(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (user.isBlocked) throw new ApiError(403, 'Your account has been blocked. Contact support.');

  res.json(authResponse(user));
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { user } = req;
  if (req.body.name !== undefined) {
    const name = cleanString(req.body.name, 80);
    if (!name) throw new ApiError(400, 'Name cannot be empty');
    user.name = name;
  }
  if (req.body.phone !== undefined) user.phone = cleanString(req.body.phone, 20);
  if (req.body.upiId !== undefined) user.upiId = cleanString(req.body.upiId, 80);

  if (req.body.newPassword) {
    if (req.body.newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
    const full = await User.findById(user._id).select('+password');
    if (!(await full.comparePassword(req.body.currentPassword || ''))) {
      throw new ApiError(400, 'Current password is incorrect');
    }
    full.password = req.body.newPassword;
    await full.save();
  }

  await user.save();
  res.json({ user });
});
