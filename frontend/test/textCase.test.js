import test from 'node:test';
import assert from 'node:assert/strict';
import { transformTextCase } from '../src/textCase.js';

test('text case conversion supports common Word-style case modes', () => {
  assert.equal(transformTextCase('a MIXED sentence. next line!', 'lowercase'), 'a mixed sentence. next line!');
  assert.equal(transformTextCase('a mixed sentence', 'uppercase'), 'A MIXED SENTENCE');
  assert.equal(transformTextCase('a mixed sentence', 'capitalize'), 'A Mixed Sentence');
  assert.equal(transformTextCase('a MIXED sentence. next line!', 'sentence'), 'A mixed sentence. Next line!');
});
