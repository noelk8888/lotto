export type VisionWord = {
  symbols?: Array<{ text?: string }>;
  boundingBox?: { vertices?: Array<{ x?: number; y?: number }> };
};

// Anchor each printed row between its letter and LP marker, so neighbouring
// receipt text and rows cannot be gathered into a six-number candidate.
export function labelledRows(words: VisionWord[] = []) {
  const boxes = words.flatMap(word => {
    const vertices = word.boundingBox?.vertices ?? [];
    if (vertices.length < 4) return [];
    const xs = vertices.map(v => v.x ?? 0), ys = vertices.map(v => v.y ?? 0);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    return [{ text: word.symbols?.map(s => s.text ?? '').join('') ?? '',
      left, right, x: (left + right) / 2, y: (top + bottom) / 2, height: bottom - top }];
  });
  const rows: string[] = [];
  for (const anchor of boxes) {
    const label = anchor.text.match(/^([A-E])[:.]?$/i)?.[1]?.toUpperCase();
    if (!label) continue;
    const end = boxes.filter(box => /^LP$/i.test(box.text) && box.left > anchor.right &&
      Math.abs(box.y - anchor.y) < anchor.height * 2)
      .sort((a, b) => Math.abs(a.y - anchor.y) - Math.abs(b.y - anchor.y))[0];
    if (!end) continue;
    const slope = (end.y - anchor.y) / (end.x - anchor.x);
    const row = boxes.filter(box => box.left >= anchor.right && box.right <= end.left &&
      Math.abs(box.y - (anchor.y + slope * (box.x - anchor.x))) < Math.min(anchor.height, box.height) * 0.6 &&
      /^\d{1,2}$/.test(box.text)).sort((a, b) => a.x - b.x);
    if (row.length === 6) rows.push(`${label}: ${row.map(box => box.text).join(' ')}`);
  }
  return rows.join('\n');
}
