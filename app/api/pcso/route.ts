import { NextRequest, NextResponse } from 'next/server';
import { PCSO_SOURCE, verifiedDraw } from '../../pcso-results';

const SOURCE = PCSO_SOURCE;

function esc(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function asPcsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '';
  const game = request.nextUrl.searchParams.get('game') ?? '';
  if (!date || !game) return NextResponse.json({ error: 'Add a draw date and lotto game first.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Choose a valid draw date.' }, { status: 400 });
  const saved = verifiedDraw(game, date);

  try {
    const response = await fetch(SOURCE, { headers: { 'User-Agent': 'PH-Lotto-Checker/1.0 (personal results checker)' }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(response.status === 403 ? 'PCSO is blocking automated access. Your ticket was read, but this draw could not be retrieved. Open PCSO results to check it directly.' : 'The PCSO result service could not be reached. Your scanned entries are preserved; please try again.');
    const html = await response.text();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const pcsoDate = asPcsoDate(date);
    const matcher = new RegExp(`${esc(game)}\\s+([0-9-]+)\\s+${esc(pcsoDate)}\\s+([0-9,.]+)\\s+([0-9,]+)`, 'i');
    const found = text.match(matcher);
    if (!found) return NextResponse.json(saved ?? { error: 'This draw is not in PCSO’s current result list. Open PCSO Results and search the game and draw date directly.', source: SOURCE }, { status: saved ? 200 : 404 });
    return NextResponse.json({ game, combination: found[1], date: pcsoDate, jackpot: found[2], winners: found[3], source: SOURCE });
  } catch (error) {
    if (saved) return NextResponse.json(saved);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not retrieve PCSO results.' }, { status: 502 });
  }
}
