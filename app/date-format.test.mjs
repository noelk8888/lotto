import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayDrawDate, storedDrawDate } from './date-format.ts';

test('formats stored and PCSO dates as DD-Mmm-YYYY', () => {
  assert.equal(displayDrawDate('2026-09-06'), '06-Sep-2026');
  assert.equal(displayDrawDate('9/6/2026'), '06-Sep-2026');
  assert.equal(storedDrawDate('06-Sep-2026'), '2026-09-06');
});
