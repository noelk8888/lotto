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
