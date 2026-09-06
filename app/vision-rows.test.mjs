import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelledRows } from './vision-rows.ts';
import { extractTicketEntries } from './ticket-entries.ts';
const word = (text, x, y) => ({ symbols: [...text].map(text => ({text})),
  boundingBox: { vertices: [{x,y}, {x:x+12,y}, {x:x+12,y:y+12}, {x,y:y+12}] } });
test('uses printed endpoints despite tilt and adjacent receipt numbers', () => {
  const values = ['05','09','11','21','30','36'];
  const boxes = [word('A', 0, 10), word(':', 14, 10), word('LP', 160, 18),
    ...values.map((value,i) => word(value, 25+i*20, 10+(25+i*20)*0.05)),
    word('125', 60, 40), word('26', 90, 40)];
  assert.equal(labelledRows(boxes), 'A: 05 09 11 21 30 36');
  assert.equal(labelledRows(boxes.filter(box => box.symbols.map(s=>s.text).join('') !== '21')), '');
});
test('live screenshot transcription keeps four readable rows and rejects corrupt A', () => {
  const text = 'A : 05 05 09 11 2 21 30 36 LP\nB : 16 35 39 40 49 53 LP\nC : 01 19 32 44 49 50 LP\nD : 05 15 26 32 34 54 LP\nE : 12 13 14 45 50 58 LP';
  assert.equal(extractTicketEntries([text]), 'B: 16 35 39 40 49 53\nC: 01 19 32 44 49 50\nD: 05 15 26 32 34 54\nE: 12 13 14 45 50 58');
});
