export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const dateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

export const dateOnly = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const STATUS = {
  pending_payment: { label: 'Awaiting payment', tone: 'amber' },
  open: { label: 'Open', tone: 'blue' },
  accepted: { label: 'In progress', tone: 'violet' },
  submitted: { label: 'Under review', tone: 'teal' },
  revision: { label: 'Revision requested', tone: 'orange' },
  approved: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

export const deadlineInfo = (deadline) => {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = ms / 36e5;
  if (ms <= 0) return { text: 'Past deadline', urgent: true };
  if (hours < 24) return { text: `${Math.max(1, Math.round(hours))}h left`, urgent: true };
  return { text: `${Math.round(hours / 24)}d left`, urgent: false };
};

export const toDatetimeLocal = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
