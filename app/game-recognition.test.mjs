import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectTicketGame } from './game-recognition.ts';

test('recognizes all five supplied logo OCR signatures', () => {
  assert.equal(detectTicketGame('', 'LOTTO\n6/42'), 'Lotto 6/42');
  assert.equal(detectTicketGame('', 'MEGALOTTO\n6/45'), 'Megalotto 6/45');
  assert.equal(detectTicketGame('', '6749'), 'Superlotto 6/49');
  assert.equal(detectTicketGame('', 'GRAND\nLOTTO'), 'Grand Lotto 6/55');
  assert.equal(detectTicketGame('', 'ULTRA\nLOTTOS5S'), 'Ultra Lotto 6/58');
});

test('does not infer a logo from unrelated ticket numbers', () => {
  assert.equal(detectTicketGame('A: 06 07 14 29 32 49'), '');
});
