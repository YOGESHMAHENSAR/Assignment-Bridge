export const isPdfFile = (file) =>
  /\.pdf$/i.test(file?.name || '') ||
  file?.type === 'application/pdf' ||
  file?.mimeType === 'application/pdf';

export const hasPdfFile = (files = []) => files.some(isPdfFile);
