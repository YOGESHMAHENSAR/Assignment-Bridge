import User from '../models/User.js';
import Payout from '../models/Payout.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { cleanString } from '../utils/helpers.js';

const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

export const getWallet = asyncHandler(async (req, res) => {
  const payouts = await Payout.find({ worker: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const u = req.user;
  res.json({
    balance: u.balance,
    totalEarned: u.totalEarned,
    completedCount: u.completedCount,
    rating: u.rating,
    ratingCount: u.ratingCount,
    upiId: u.upiId || '',
    minPayout: env.minPayout,
    payouts,
  });
});

export const requestPayout = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  const upiId = cleanString(req.body.upiId, 80) || req.user.upiId;

  if (!Number.isInteger(amount) || amount <= 0) throw new ApiError(400, 'Enter a whole rupee amount');
  if (amount < env.minPayout) throw new ApiError(400, `Minimum withdrawal is ₹${env.minPayout}`);
  if (!upiId || !UPI_RE.test(upiId)) throw new ApiError(400, 'Enter a valid UPI ID (for example name@bank)');

  // Atomic hold: only succeeds if the balance really covers the amount.
  const held = await User.findOneAndUpdate(
    { _id: req.user._id, balance: { $gte: amount } },
    { $inc: { balance: -amount }, upiId },
    { new: true }
  );
  if (!held) throw new ApiError(400, 'Amount is more than your available balance');

  const payout = await Payout.create({ worker: req.user._id, amount, upiId });
  res.status(201).json({ payout, balance: held.balance });
});
