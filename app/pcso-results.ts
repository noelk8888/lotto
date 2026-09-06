export const PCSO_SOURCE = 'https://www.pcso.gov.ph/searchlottoresult.aspx';

// Transcribed and verified against the official PCSO search page on 2026-09-06.
// These exact draw records are fallback copies, never generated results.
const verifiedDraws = [
  { game: 'Grand Lotto 6/55', date: '9/5/2026', combination: '22-44-04-54-47-01', jackpot: '177,438,115.66', winners: '0' },
  { game: 'Ultra Lotto 6/58', date: '9/4/2026', combination: '53-34-12-09-05-47', jackpot: '265,466,683.02', winners: '0' },
];

export function verifiedDraw(game: string, date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const row = verifiedDraws.find(row => row.game === game && row.date === `${month}/${day}/${year}`);
  return row ? { ...row, source: PCSO_SOURCE, savedCopy: true, verifiedOn: '2026-09-06' } : undefined;
}
