export function validTicketNumbers(values: number[], maximum = 58) {
  return values.length === 6 && values.every((value, index) =>
    Number.isInteger(value) && value >= 1 && value <= maximum &&
    (index === 0 || value > values[index - 1]));
}

// Keep OCR representations separate: never join the end of one reading to
// the beginning of another, or collect numbers from unlabelled receipt text.
export function extractTicketEntries(readings: string[]) {
  const candidates = new Map<string, Set<string>>();
  for (const reading of readings) {
    const pattern = /(?:^|\n)\s*([A-E])\s*[:.)/-]\s*((?:\d{1,2}[ \t]+){5}\d{1,2})[ \t]*(?:LP)?[ \t]*(?=\n|$)/gi;
    for (const match of reading.matchAll(pattern)) {
      const values = match[2].trim().split(/\s+/).map(Number);
      if (!validTicketNumbers(values)) continue;
      const label = match[1].toUpperCase();
      const entry = `${label}: ${values.map(value => String(value).padStart(2, '0')).join(' ')}`;
      const options = candidates.get(label) ?? new Set<string>();
      options.add(entry);
      candidates.set(label, options);
    }
  }
  // Disagreement needs review, even when both alternatives look plausible.
  return [...candidates.entries()].sort(([a], [b]) => a.localeCompare(b))
    .filter(([, options]) => options.size === 1)
    .map(([, options]) => [...options][0]).join('\n');
}

export function editableTicketEntries(entries: string, count: number) {
  const rows = new Map(entries.split('\n').map(line => [line[0], line]));
  const highest = Math.max(0, ...[...rows.keys()].map(label => 'ABCDE'.indexOf(label) + 1));
  return Array.from({ length: Math.min(5, Math.max(count, highest, 1)) }, (_, index) => {
    const label = 'ABCDE'[index];
    return rows.get(label) || `${label}: __ __ __ __ __ __`;
  }).join('\n');
}

export function partialTicketEntries(readings: string[], count: number) {
  const complete = extractTicketEntries(readings);
  const rows = new Map(complete.split('\n').filter(Boolean).map(row => [row[0], row]));
  const partial = new Map<string, string[][]>();
  for (const reading of readings) {
    for (const match of reading.matchAll(/(?:^|\n)[ \t]*([A-E])[ \t]*[:.)/-][ \t]*([^\n]+)/gi)) {
      const tokens = match[2].replace(/[ \t]*LP[ \t]*$/i, '').trim().split(/[ \t]+/);
      // Preserve column positions only when six explicit slots exist. A short
      // OCR row does not tell us which column was lost.
      if (tokens.length !== 6 || !tokens.every(token => /^(?:\d{1,2}|_+|\?+)$/.test(token))) continue;
      const values = tokens.map(token => /^\d+$/.test(token) ? Number(token) : 0);
      const safe = values.map((value, index) => value >= 1 && value <= 58 &&
        values.every((other, otherIndex) => !other || otherIndex === index ||
          (otherIndex < index ? other < value : other > value))
        ? String(value).padStart(2, '0') : '__');
      const label = match[1].toUpperCase();
      partial.set(label, [...(partial.get(label) ?? []), safe]);
    }
  }
  for (const [label, alternatives] of partial) {
    if (rows.has(label)) continue;
    const slots = Array.from({ length: 6 }, (_, index) => {
      const options = new Set(alternatives.map(row => row[index]));
      return options.size === 1 ? alternatives[0][index] : '__';
    });
    rows.set(label, `${label}: ${slots.join(' ')}`);
  }
  return editableTicketEntries([...rows.values()].join('\n'), count);
}
