import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFormatSnapshot, captureFormatSnapshot } from '../src/formatPainter.js';

test('format painter snapshots all supported inline mark attributes from the selected text', () => {
  const expectedTextStyle = {
    color: '#3567c8',
    fontFamily: 'Georgia',
    fontSize: '24px',
    backgroundColor: '#fff7cc',
    letterSpacing: '0.04em',
  };
  const marks = [
    { type: { name: 'bold' }, attrs: {} },
    { type: { name: 'textStyle' }, attrs: { ...expectedTextStyle, unused: null } },
    { type: { name: 'highlight' }, attrs: { color: '#fff0a8' } },
    { type: { name: 'link' }, attrs: { href: 'https://example.test' } },
  ];
  const state = {
    doc: {
      nodesBetween(from, to, visit) {
        assert.deepEqual([from, to], [12, 19]);
        visit({ isText: true, nodeSize: 10, marks }, 10);
      },
    },
    storedMarks: null,
  };
  const selection = {
    from: 12,
    to: 19,
    $from: { marks: () => [] },
  };

  assert.deepEqual(captureFormatSnapshot(state, selection), {
    from: 12,
    to: 19,
    doc: state.doc,
    marks: ['bold'],
    textStyle: expectedTextStyle,
    highlight: { color: '#fff0a8' },
  });
});

test('format painter applies marks across the complete target selection without replacing text', () => {
  const calls = [];
  const chain = {};
  ['focus', 'setTextSelection', 'setMark', 'unsetMark'].forEach((method) => {
    chain[method] = (...args) => {
      calls.push([method, ...args]);
      return chain;
    };
  });
  chain.run = () => true;
  const editor = { chain: () => chain };
  const painter = {
    marks: ['bold', 'underline'],
    textStyle: { fontFamily: 'Georgia', fontSize: '24px', letterSpacing: '0.04em' },
    highlight: { color: '#fff0a8' },
  };

  assert.equal(applyFormatSnapshot(editor, painter, { from: 35, to: 82 }), true);
  assert.deepEqual(calls.slice(0, 3), [
    ['focus'],
    ['setTextSelection', { from: 35, to: 82 }],
    ['setMark', 'bold'],
  ]);
  assert.ok(calls.some(([method, mark]) => method === 'setMark' && mark === 'underline'));
  assert.ok(calls.some(([method, mark]) => method === 'unsetMark' && mark === 'italic'));
  assert.ok(calls.some(([method, mark, attrs]) => (
    method === 'setMark' && mark === 'textStyle'
    && attrs.letterSpacing === '0.04em'
    && attrs.fontFamily === 'Georgia'
  )));
  assert.ok(calls.some(([method, mark, attrs]) => (
    method === 'setMark' && mark === 'highlight' && attrs.color === '#fff0a8'
  )));
  assert.ok(!calls.some(([method]) => method === 'insertContent'));
});
