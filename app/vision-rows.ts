export type VisionWord = {
  symbols?: Array<{ text?: string }>;
  boundingBox?: { vertices?: Array<{ x?: number; y?: number }> };
};

type Box = {
  text: string;
  left: number;
  right: number;
  x: number;
  y: number;
  height: number;
};

function increasingSix(values: number[]) {
  const results = new Set<string>();
  function visit(start: number, picked: number[]) {
    if (picked.length === 6) {
      if (picked.every((value, index) =>
        value >= 1 && value <= 58 && (index === 0 || value > picked[index - 1])))
        results.add(picked.join(' '));
      return;
    }
    for (let index = start; index < values.length; index++) {
      if (values[index] >= 1 && values[index] <= 58 &&
          (!picked.length || values[index] > picked[picked.length - 1]))
        visit(index + 1, [...picked, values[index]]);
    }
  }
  visit(0, []);
  return results;
}

// A ticket row is the letter A–E followed horizontally by six increasing,
// non-repeated numbers. “LP” and all other receipt text are irrelevant.
export function labelledRows(words: VisionWord[] = []) {
  const boxes: Box[] = words.flatMap((word) => {
    const vertices = word.boundingBox?.vertices ?? [];
    if (vertices.length < 4) return [];
    const xs = vertices.map((vertex) => vertex.x ?? 0);
    const ys = vertices.map((vertex) => vertex.y ?? 0);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return [{
      text: word.symbols?.map((symbol) => symbol.text ?? '').join('') ?? '',
      left,
      right,
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      height: bottom - top,
    }];
  });
  const rows: string[] = [];
  for (const anchor of boxes) {
    const label = anchor.text.match(/^([A-E])[:.]?$/i)?.[1]?.toUpperCase();
    if (!label) continue;
    const possibleRows = new Set<string>();
    // Test modest ticket tilt. Only accept a single resulting number sequence.
    for (let step = -15; step <= 15; step++) {
      const slope = step / 100;
      const row = boxes
        .filter((box) =>
          box.left >= anchor.right &&
          /^\d{1,2}$/.test(box.text) &&
          Math.abs(box.y - (anchor.y + slope * (box.x - anchor.x))) <
            Math.min(anchor.height, box.height) * 0.65,
        )
        .sort((left, right) => left.x - right.x);
      for (const sequence of increasingSix(row.map((box) => Number(box.text))))
        possibleRows.add(sequence);
    }
    if (possibleRows.size === 1) {
      const values = [...possibleRows][0].split(' ');
      rows.push(`${label}: ${values.map((value) => value.padStart(2, '0')).join(' ')}`);
    }
  }
  return rows.join('\n');
}
