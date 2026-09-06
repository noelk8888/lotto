import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifiedDraw } from './pcso-results.ts';

test('fallback is restricted to an exact verified game and draw date', () => {
  const result = verifiedDraw('Grand Lotto 6/55', '2026-09-05');
  assert.equal(result.combination, '22-44-04-54-47-01');
  assert.equal(result.savedCopy, true);
  assert.equal(result.verifiedOn, '2026-09-06');
  assert.equal(verifiedDraw('Grand Lotto 6/55', '2026-09-06'), undefined);
  assert.equal(verifiedDraw('Ultra Lotto 6/58', '2026-09-05'), undefined);
});
test('both supplied September 5 entries have zero matches', () => {
  const winning = verifiedDraw('Grand Lotto 6/55', '2026-09-05').combination.split('-').map(Number);
  for (const entry of [[5,8,10,12,16,48], [8,16,18,19,24,32]]) {
    assert.equal(entry.filter(value => winning.includes(value)).length, 0);
  }
});
