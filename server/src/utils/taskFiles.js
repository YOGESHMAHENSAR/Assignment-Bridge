export const isPdfFile = (file) =>
  /\.pdf$/i.test(file?.originalname || file?.name || '') ||
  file?.mimetype === 'application/pdf' ||
  file?.mimeType === 'application/pdf';

export const hasPdfFile = (files = []) => files.some(isPdfFile);

export const pdfFileQuery = () => ({
  files: {
    $elemMatch: {
      $or: [{ name: /\.pdf$/i }, { mimeType: 'application/pdf' }],
    },
  },
});
