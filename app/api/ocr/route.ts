import { NextRequest, NextResponse } from 'next/server';
import { labelledRows } from '../../vision-rows';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const GOOGLE_VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

type Vertex = { x?: number; y?: number };
type VisionWord = {
  symbols?: Array<{ text?: string }>;
  boundingBox?: { vertices?: Vertex[] };
};

function spatialTicketText(words: VisionWord[] | undefined) {
  const positioned = (words ?? [])
    .map((word) => {
      const text = word.symbols?.map((symbol) => symbol.text ?? '').join('');
      const vertices = word.boundingBox?.vertices ?? [];
      const xs = vertices.map((vertex) => vertex.x ?? 0);
      const ys = vertices.map((vertex) => vertex.y ?? 0);
      return {
        text,
        x: xs.length ? Math.min(...xs) : 0,
        y: ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0,
        height: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
        slope: vertices.length >= 2 && (vertices[1].x ?? 0) !== (vertices[0].x ?? 0)
          ? ((vertices[1].y ?? 0) - (vertices[0].y ?? 0)) / ((vertices[1].x ?? 0) - (vertices[0].x ?? 0)) : 0,
      };
    })
    .filter((word) => word.text && word.height > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  // Correct the overall printed baseline before grouping. A fixed 10-pixel
  // tolerance can span two rows in a small image, so use relative text height.
  const slopes = positioned.filter(word => /^\d{2}$/.test(word.text ?? '') && Math.abs(word.slope) < 0.3)
    .map(word => word.slope).sort((a, b) => a - b);
  const slope = slopes[Math.floor(slopes.length / 2)] ?? 0;
  for (const word of positioned) word.y -= slope * word.x;
  positioned.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Array<{ y: number; height: number; words: typeof positioned }> = [];
  for (const word of positioned) {
    const row = rows.findLast(
      (candidate) =>
        Math.abs(candidate.y - word.y) <=
        Math.min(candidate.height, word.height) * 0.4,
    );
    if (row) {
      row.words.push(word);
      row.y = (row.y * (row.words.length - 1) + word.y) / row.words.length;
      row.height = Math.max(row.height, word.height);
    } else {
      rows.push({ y: word.y, height: word.height, words: [word] });
    }
  }
  return rows
    .map((row) =>
      row.words.sort((a, b) => a.x - b.x).map((word) => word.text).join(' '),
    )
    .join('\n');
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      {
        error:
          'Server-side ticket scanning is not configured yet. Please try again shortly.',
      },
      { status: 503 },
    );

  try {
    const form = await request.formData();
    const image = form.get('image');
    const enhancedImage = form.get('enhancedImage');
    if (!(image instanceof File))
      return NextResponse.json(
        { error: 'Choose a ticket photo first.' },
        { status: 400 },
      );
    if (!image.type.startsWith('image/'))
      return NextResponse.json(
        { error: 'Use an image file for the ticket photo.' },
        { status: 400 },
      );
    if (image.size > MAX_IMAGE_BYTES)
      return NextResponse.json(
        { error: 'Use a ticket photo smaller than 4 MB.' },
        { status: 413 },
      );
    if (enhancedImage instanceof File &&
        (!enhancedImage.type.startsWith('image/') || enhancedImage.size > MAX_IMAGE_BYTES))
      return NextResponse.json(
        { error: 'The enhanced ticket photo could not be processed.' },
        { status: 413 },
      );

    const content = Buffer.from(await image.arrayBuffer()).toString('base64');
    const enhancedContent = enhancedImage instanceof File
      ? Buffer.from(await enhancedImage.arrayBuffer()).toString('base64')
      : undefined;
    const response = await fetch(`${GOOGLE_VISION_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [content, enhancedContent].filter(Boolean).map((imageContent) => ({
            image: { content: imageContent },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          })),
      }),
      cache: 'no-store',
    });
    const body = (await response.json()) as {
      error?: { message?: string };
      responses?: Array<{
        error?: { message?: string };
        fullTextAnnotation?: {
          text?: string;
          pages?: Array<{
            blocks?: Array<{
              paragraphs?: Array<{ words?: VisionWord[] }>;
            }>;
          }>;
        };
        textAnnotations?: Array<{ description?: string }>;
      }>;
    };
    const results = body.responses ?? [];
    const result = results[0];
    const text =
      result?.fullTextAnnotation?.text ??
      result?.textAnnotations?.[0]?.description;
    if (!response.ok || result?.error || !text)
      throw new Error(
        result?.error?.message ||
          body.error?.message ||
          'The ticket could not be read by the scanning service.',
      );
    const words = result?.fullTextAnnotation?.pages
      ?.flatMap((page) => page.blocks ?? [])
      .flatMap((block) => block.paragraphs ?? [])
      .flatMap((paragraph) => paragraph.words ?? []);
    const enhancedResult = results[1];
    const enhancedText = enhancedResult?.fullTextAnnotation?.text ??
      enhancedResult?.textAnnotations?.[0]?.description;
    const enhancedWords = enhancedResult?.fullTextAnnotation?.pages
      ?.flatMap((page) => page.blocks ?? [])
      .flatMap((block) => block.paragraphs ?? [])
      .flatMap((paragraph) => paragraph.words ?? []);
    return NextResponse.json({
      text,
      enhancedText,
      spatialText: spatialTicketText(words),
      enhancedSpatialText: spatialTicketText(enhancedWords),
      labelledText: labelledRows(words),
      enhancedLabelledText: labelledRows(enhancedWords),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The ticket could not be read by the scanning service.',
      },
      { status: 502 },
    );
  }
}
