import test from 'node:test';
import assert from 'node:assert/strict';
import { plainTextToHtml } from '../src/documentTransfer.js';

test('plain text document import escapes HTML and preserves lines', () => {
  assert.equal(
    plainTextToHtml('First <line>\n\nLast & final'),
    '<p>First &lt;line&gt;</p><p><br></p><p>Last &amp; final</p>',
  );
});
