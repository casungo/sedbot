import assert from 'node:assert/strict';
import test from 'node:test';
import { runSed } from '../sedEngine.ts';

test('allows finite loops and rejects runaway branches', () => {
  assert.equal(runSed(':repeat;s/a//;t repeat', 'aaa'), '');
  assert.throws(() => runSed(':loop;b loop', 'x'), /execution limit/);
});

test('stops output-producing loops before building an oversized response', () => {
  assert.throws(() => runSed(':loop;p;b loop', 'x'.repeat(1024)), /output limit/);
  assert.throws(() => runSed(':loop;a x;b loop', 'x'), /output limit/);
});
