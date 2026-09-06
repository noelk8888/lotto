import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTicketEntries, partialTicketEntries, validTicketNumbers } from './ticket-entries.ts';

const ticket = [
  'A: 05 09 11 21 30 36',
  'B: 16 35 39 40 49 53',
  'C: 01 19 32 44 49 50',
  'D: 05 15 26 32 34 54',
  'E: 12 13 14 45 50 58',
];

test('missing rows and known missing columns remain editable blanks', () => {
  assert.equal(partialTicketEntries(['A: 02 14 29 32 41 48\nC: 27 47 50 51 53 57\nD: 28 29 31 33 55 __'], 4),
    'A: 02 14 29 32 41 48\nB: __ __ __ __ __ __\nC: 27 47 50 51 53 57\nD: 28 29 31 33 55 __');
});
test('short OCR rows do not shift numbers into assumed columns', () => {
  assert.equal(partialTicketEntries(['A: 05 11 21 30 36'], 1), 'A: __ __ __ __ __ __');
  assert.equal(partialTicketEntries(['A: 05 09 11 21 30 30'], 1), 'A: 05 09 11 21 __ __');
});

test('accepts one through five complete printed rows with LP suffixes', () => {
  for (let count = 1; count <= 5; count++) {
    const rows = ticket.slice(0, count);
    assert.equal(extractTicketEntries([rows.map(row => `${row} LP`).join('\n')]), rows.join('\n'));
  }
});
test('rejects repeated, descending, zero, out-of-range and extra numbers', () => {
  for (const line of ['05 09 11 21 30 30', '01 19 19 32 32 44', '05 12 12 13 15 15',
    '09 05 11 21 30 36', '00 05 11 21 30 36', '05 09 11 21 30 59', '05 09 11 21 30 36 48']) {
    assert.equal(extractTicketEntries([`A: ${line}`]), '');
  }
  assert.equal(validTicketNumbers([1, 2, 3, 4, 5, 58], 42), false);
});
test('does not fill a short row from price, date, or another reading', () => {
  assert.equal(extractTicketEntries(['A: 05 09 11\nP 125.00\nDraw 04-Sep-26', '21 30 36']), '');
  assert.equal(extractTicketEntries(['A: 05 09 11 21 30 36 B: 16 35 39 40 49 53']), '');
});
test('valid raw rows can recover invalid spatial rows without guessing', () => {
  assert.equal(extractTicketEntries(['A: 05 09 11 21 30 30', ticket[0]]), ticket[0]);
});
test('conflicting valid readings remain missing; duplicate readings agree', () => {
  assert.equal(extractTicketEntries([ticket[0], 'A: 05 09 11 21 30 38']), '');
  assert.equal(extractTicketEntries([ticket.join('\n'), ticket.join('\n')]), ticket.join('\n'));
});
test('missing labels are never reassigned', () => {
  assert.equal(extractTicketEntries([`${ticket[1]}\n${ticket[3]}`]), `${ticket[1]}\n${ticket[3]}`);
});
