import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const GOOGLE_VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

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

    const content = Buffer.from(await image.arrayBuffer()).toString('base64');
    const response = await fetch(`${GOOGLE_VISION_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
      cache: 'no-store',
    });
    const body = (await response.json()) as {
      error?: { message?: string };
      responses?: Array<{
        error?: { message?: string };
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
      }>;
    };
    const result = body.responses?.[0];
    const text =
      result?.fullTextAnnotation?.text ??
      result?.textAnnotations?.[0]?.description;
    if (!response.ok || result?.error || !text)
      throw new Error(
        result?.error?.message ||
          body.error?.message ||
          'The ticket could not be read by the scanning service.',
      );
    return NextResponse.json({ text });
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
