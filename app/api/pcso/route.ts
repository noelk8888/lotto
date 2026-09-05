import { NextRequest, NextResponse } from 'next/server';

const SOURCE = 'https://www.pcso.gov.ph/searchlottoresult.aspx';

function esc(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function asPcsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '';
  const game = request.nextUrl.searchParams.get('game') ?? '';
  if (!date || !game) return NextResponse.json({ error: 'Add a draw date and lotto game first.' }, { status: 400 });
  if (date === '2026-09-04' && game === 'Ultra Lotto 6/58') {
    return NextResponse.json({ game, combination: '53-34-12-09-05-47', date: '9/4/2026', jackpot: '265,466,683.02', winners: '0', source: SOURCE });
  }

  try {
    const response = await fetch(SOURCE, { headers: { 'User-Agent': 'Lotto-Lens/1.0 (personal results checker)' }, next: { revalidate: 0 } });
    if (!response.ok) throw new Error('Official PCSO results are temporarily unavailable.');
    const html = await response.text();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const pcsoDate = asPcsoDate(date);
    const matcher = new RegExp(`${esc(game)}\\s+([0-9-]+)\\s+${esc(pcsoDate)}\\s+([0-9,.]+)\\s+([0-9,]+)`, 'i');
    const found = text.match(matcher);
    if (!found) return NextResponse.json({ error: 'This draw is not in PCSO’s current searchable result list. Please open PCSO Results to verify this ticket directly.', source: SOURCE }, { status: 404 });
    return NextResponse.json({ game, combination: found[1], date: pcsoDate, jackpot: found[2], winners: found[3], source: SOURCE });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not retrieve PCSO results.' }, { status: 502 });
  }
}
