import mongoose from 'mongoose';
import ApiError from './ApiError.js';

export const assertObjectId = (id, label = 'id') => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`);
};

export const parsePaging = (query, defaultLimit = 12) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const pagedResponse = (items, total, { page, limit }) => ({
  items,
  total,
  page,
  pages: Math.max(Math.ceil(total / limit), 1),
});

export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const cleanString = (v, max = 5000) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
