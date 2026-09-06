import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { PCSO_SOURCE, verifiedDraw } from '../../pcso-results';

const LOTTOMATIK_RESULTS =
  'https://lottomatik-backend.api-lottomatik.workers.dev/get-results';
const YEAR = 60 * 60 * 24 * 365;
const gameCodes: Record<string, string> = {
  'Ultra Lotto 6/58': 'UL58',
  'Grand Lotto 6/55': 'GL55',
  'Superlotto 6/49': 'SL49',
  'Megalotto 6/45': 'ML45',
  'Lotto 6/42': 'LOTTO42',
  '6D Lotto': '6DL',
  '4D Lotto': '4DL',
  '3D Lotto': '3DL',
  '2D Lotto': '2DL',
};

type LottoMatikDraw = {
  lottery?: string;
  result?: string[];
  drawDate?: string;
  jackpot?: number;
  totalWinners?: number;
};

function asPcsoDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

const findOfficialDraw = unstable_cache(
  async (game: string, date: string) => {
    const code = gameCodes[game];
    if (!code) throw new Error('Unsupported lotto game.');
    const response = await fetch(LOTTOMATIK_RESULTS, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new Error('The official results service could not be reached.');
    const draws = (await response.json()) as LottoMatikDraw[];
    const matches = draws.filter(
      (draw) => draw.lottery === code && draw.drawDate === date,
    );
    // 2D and 3D have multiple daily draws. Do not pick one without a draw time.
    if (matches.length !== 1 || matches[0].result?.length === 0)
      throw new Error(
        matches.length > 1
          ? 'This game has multiple results on that date. Choose the draw time on the official PCSO page.'
          : 'This draw is not yet available from the official results service.',
      );
    const draw = matches[0];
    return {
      game,
      combination: draw.result!.join('-'),
      date: asPcsoDate(date),
      jackpot: Number(draw.jackpot ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      winners: String(draw.totalWinners ?? 0),
      source: PCSO_SOURCE,
      resultFeed: 'https://lottomatik.pcso.gov.ph/lotto-results',
    };
  },
  ['official-lotto-result-by-game-and-date-v1'],
  { revalidate: YEAR },
);

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '';
  const game = request.nextUrl.searchParams.get('game') ?? '';
  if (!date || !game)
    return NextResponse.json(
      { error: 'Add a draw date and lotto game first.' },
      { status: 400 },
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: 'Choose a valid draw date.' }, { status: 400 });

  try {
    const result = await findOfficialDraw(game, date);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': `public, s-maxage=${YEAR}, stale-while-revalidate=86400`,
      },
    });
  } catch (error) {
    const saved = verifiedDraw(game, date);
    if (saved)
      return NextResponse.json(saved, {
        headers: {
          'Cache-Control': `public, s-maxage=${YEAR}, stale-while-revalidate=86400`,
        },
      });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The official result could not be retrieved.',
        source: PCSO_SOURCE,
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
