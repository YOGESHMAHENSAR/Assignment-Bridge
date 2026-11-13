import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPdfFile, isPdfFile, pdfFileQuery } from './taskFiles.js';

test('recognizes PDF uploads and stored PDF attachments', () => {
  assert.equal(isPdfFile({ originalname: 'assignment.PDF' }), true);
  assert.equal(isPdfFile({ name: 'assignment', mimeType: 'application/pdf' }), true);
  assert.equal(isPdfFile({ name: 'notes.txt', mimeType: 'text/plain' }), false);
  assert.equal(hasPdfFile([{ name: 'notes.txt' }, { name: 'assignment.pdf' }]), true);
  assert.equal(hasPdfFile([]), false);
});

test('builds a query for tasks that already have a PDF attachment', () => {
  assert.deepEqual(pdfFileQuery(), {
    files: {
      $elemMatch: {
        $or: [{ name: /\.pdf$/i }, { mimeType: 'application/pdf' }],
      },
    },
  });
});
