import ApiError from './ApiError.js';

export const CHAT_OPEN_STATUSES = ['accepted', 'submitted', 'revision'];

export const isChatOpen = (status) => CHAT_OPEN_STATUSES.includes(status);

export const normalizeMessage = (value) => {
  if (typeof value !== 'string') throw new ApiError(400, 'Message is required');
  const content = value.trim();
  if (!content) throw new ApiError(400, 'Message cannot be empty');
  if (content.length > 2000) throw new ApiError(400, 'Message must be 2000 characters or fewer');
  return content;
};
