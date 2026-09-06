'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { editableTicketEntries, partialTicketEntries, extractTicketEntries, validTicketNumbers } from './ticket-entries';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Trophy,
  XCircle,
} from 'lucide-react';

const games = [
  'Lotto 6/42',
  'Megalotto 6/45',
  'Superlotto 6/49',
  'Grand Lotto 6/55',
  'Ultra Lotto 6/58',
  '6D Lotto',
  '4D Lotto',
  '3D Lotto',
  '2D Lotto',
];
type CheckResult = {
  game: string;
  combination: string;
  date: string;
  jackpot: string;
  winners: string;
  savedCopy?: boolean;
  verifiedOn?: string;
};
const numbers = (value: string) => value.match(/\d{1,2}/g)?.map(Number) ?? [];
const lineLabel = (value: string, index: number) =>
  value.match(/^\s*([A-Z])\s*[:.-]/i)?.[1]?.toUpperCase() ??
  `Line ${index + 1}`;
const gamePatterns = [
  ['ULTRALOTTO658', 'Ultra Lotto 6/58'],
  ['GRANDLOTTO655', 'Grand Lotto 6/55'],
  ['SUPERLOTTO649', 'Superlotto 6/49'],
  ['MEGALOTTO645', 'Megalotto 6/45'],
  ['LOTTO642', 'Lotto 6/42'],
  ['6DLOTTO', '6D Lotto'],
  ['4DLOTTO', '4D Lotto'],
  ['3DLOTTO', '3D Lotto'],
  ['2DLOTTO', '2D Lotto'],
] as const;
const gameAliases = [
  ['ULTRALOTTO', 'Ultra Lotto 6/58'],
  ['GRANDOTTO', 'Grand Lotto 6/55'],
  ['GRANDLOTTO', 'Grand Lotto 6/55'],
  ['SUPERLOTTO', 'Superlotto 6/49'],
  ['MEGALOTTO', 'Megalotto 6/45'],
] as const;
const months: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};
const MAX_SCAN_UPLOAD_BYTES = 3.8 * 1024 * 1024;
const MAX_SCAN_IMAGE_EDGE = 3000;

async function optimizeTicketPhoto(file: File) {
  // Phone camera photos are frequently 5–15 MB. Resize them in the browser
  // before uploading so the server-side OCR request stays below its limit.
  if (file.size <= MAX_SCAN_UPLOAD_BYTES && !/hei[cf]/i.test(file.type))
    return file;

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const source = new Image();
      source.onload = () => resolve(source);
      source.onerror = () => reject(new Error('This photo format could not be prepared for scanning. Please choose a JPEG or PNG photo.'));
      source.src = sourceUrl;
    });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this ticket photo.');
    const makeJpeg = async (edge: number, quality: number) => {
      const scale = Math.min(
        1,
        edge / Math.max(image.naturalWidth, image.naturalHeight),
      );
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      );
    };
    // Try full resolution first. Reduce dimensions only if required by the
    // upload limit; CSS preview dimensions must never determine OCR resolution.
    let compressed = await makeJpeg(Math.max(image.naturalWidth, image.naturalHeight), 0.92);
    if (compressed && compressed.size > MAX_SCAN_UPLOAD_BYTES)
      compressed = await makeJpeg(MAX_SCAN_IMAGE_EDGE, 0.92);
    if (compressed && compressed.size > MAX_SCAN_UPLOAD_BYTES)
      compressed = await makeJpeg(MAX_SCAN_IMAGE_EDGE, 0.82);
    if (compressed && compressed.size > MAX_SCAN_UPLOAD_BYTES)
      compressed = await makeJpeg(2600, 0.84);
    if (!compressed)
      throw new Error('Your browser could not prepare this ticket photo.');
    if (compressed.size > MAX_SCAN_UPLOAD_BYTES)
      throw new Error('This ticket photo is still too large after preparation. Please take a closer, front-on photo of the ticket.');
    return new File([compressed], 'ticket.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
async function enhanceTicketPhoto(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const source = new Image();
      source.onload = () => resolve(source);
      source.onerror = () => reject(new Error('The ticket photo could not be enhanced.'));
      source.src = sourceUrl;
    });
    const scale = Math.min(1, MAX_SCAN_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The ticket photo could not be enhanced.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
      // Suppress the pink security pattern, then strengthen dark ticket text.
      const pink = red > green + 14 && red > blue + 8;
      const value = pink ? 255 : gray < 145 ? 0 : gray > 195 ? 255 : Math.round((gray - 145) * 5.1);
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('The ticket photo could not be enhanced.');
    return new File([blob], 'ticket-enhanced.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
const validEntry = /^\s*([A-E])\s*[:.-]\s*((?:\d{1,2}\s+){5}\d{1,2})\s*$/i;
const hasSixUniqueTicketNumbers = (line: string) => {
  const values = numbers(line);
  return (
    validTicketNumbers(values)
  );
};
const individuallyValidTicketEntries = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => validEntry.test(line) && hasSixUniqueTicketNumbers(line))
    .slice(0, 5);
const ticketEntries = (value: string) => {
  const entries = individuallyValidTicketEntries(value);
  if (entries.length !== value.split('\n').filter(line => line.trim()).length) return [];
  const isSequential = entries.every(
    (entry, index) =>
      entry[0] === String.fromCharCode('A'.charCodeAt(0) + index),
  );
  return isSequential ? entries : [];
};
function expectedEntryCountFromPrice(read: string) {
  const amounts = [
    ...read.matchAll(/TICKET\s*PRICE[\s\S]{0,80}?([1-9]\d{1,2})\D{0,4}0{2}/gi),
    ...read.matchAll(/[P₱]\s*([1-9]\d{1,2})\D{0,4}0{2}/gi),
  ]
    .map((match) => Number(match[1]))
    .filter((amount) => amount >= 25 && amount <= 125 && amount % 25 === 0);
  return amounts[0] ? amounts[0] / 25 : 0;
}
function scanTicket(read: string, spatialText = '') {
  const compact = read.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const detectedGame =
    gamePatterns.find(([pattern]) => compact.includes(pattern))?.[1] ??
    gameAliases.find(([pattern]) => compact.includes(pattern))?.[1] ?? '';
  const draw =
    read.match(
      /DRAW[^\n]{0,80}?(\d{1,2})\s*[-/]\s*([A-Z]{3})\s*[-/]\s*(\d{2,4})/i,
    ) ??
    read.match(
      /(?:MON|TUE|WED|THU|FRI|SAT|SUN)[^\n]{0,24}?(\d{1,2})\s*[-/]\s*([A-Z]{3})\s*[-/]\s*(\d{2,4})/i,
    );
  const date = draw
    ? `${draw[3].length === 2 ? `20${draw[3]}` : draw[3]}-${months[draw[2].toLowerCase()] ?? ''}-${draw[1].padStart(2, '0')}`
    : '';
  const expectedEntryCount = expectedEntryCountFromPrice(read);
  const entries = extractTicketEntries([spatialText, read]);
  return {
    detectedGame,
    date,
    entries,
    expectedEntryCount,
  };
}
function prizeTier(game: string, matched: number, total: number) {
  if (matched === total) return 'Jackpot winner';
  if (game.includes('6/') || game === '6D Lotto') {
    if (matched === 5) return '5-number prize tier';
    if (matched === 4) return '4-number prize tier';
    if (matched === 3) return '3-number prize tier';
  }
  return matched > 0
    ? `${matched} matching number${matched === 1 ? '' : 's'} — no prize`
    : 'No matching prize tier';
}

export default function Home() {
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [game, setGame] = useState('');
  const [date, setDate] = useState('');
  const [lines, setLines] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checkedLines, setCheckedLines] = useState<string[]>([]);
  const [checkedGame, setCheckedGame] = useState('');
  const [expectedEntryCount, setExpectedEntryCount] = useState(0);
  const [error, setError] = useState('');
  const ticketLines = useMemo(() => ticketEntries(lines), [lines]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'stage_lotto_ticket_check',
          title: 'Prepare lotto ticket check',
          description:
            'Fill the visible ticket-check fields with confirmed game, draw date, and number lines before checking PCSO results.',
          inputSchema: {
            type: 'object',
            properties: {
              game: { type: 'string', enum: games },
              date: {
                type: 'string',
                description: 'Draw date in YYYY-MM-DD format',
              },
              lines: {
                type: 'string',
                description: 'One or more number lines, separated by new lines',
              },
            },
            required: ['game', 'date', 'lines'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (value: unknown) => {
            const ticket = value as {
              game?: string;
              date?: string;
              lines?: string;
            };
            if (
              !games.includes(ticket.game ?? '') ||
              !/^\d{4}-\d{2}-\d{2}$/.test(ticket.date ?? '') ||
              !ticket.lines?.trim()
            )
              throw new Error(
                'Provide a supported game, YYYY-MM-DD draw date, and at least one number line.',
              );
            setGame(ticket.game!);
            setDate(ticket.date!);
            setLines(ticket.lines!);
            return {
              staged: true,
              game: ticket.game,
              date: ticket.date,
              lineCount: ticket.lines.split(/\n|,/).filter(Boolean).length,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  async function checkTicket(
    ticket = { game, date, lines, expectedEntryCount },
  ) {
    const entries = ticketEntries(ticket.lines);
    if (
      !ticket.game ||
      !ticket.date ||
      entries.some(entry => !validTicketNumbers(numbers(entry), Number(ticket.game.match(/6\/(\d+)/)?.[1] ?? 58))) ||
      entries.length < 1 ||
      (ticket.expectedEntryCount > 0 &&
        entries.length !== ticket.expectedEntryCount)
    )
      throw new Error(
        ticket.expectedEntryCount > 0
          ? `I found ${entries.length} of ${ticket.expectedEntryCount} ticket entries. Please scan again or complete the missing line.`
          : 'Add a lotto game, draw date, and at least one complete labelled entry before checking.',
      );
    setLoading(true);
    setError('');
    setResult(null);
    setCheckedLines(entries);
    setCheckedGame(ticket.game);
    try {
      const response = await fetch(
        `/api/pcso?date=${encodeURIComponent(ticket.date)}&game=${encodeURIComponent(ticket.game)}`,
      );
      const data = (await response.json()) as CheckResult & { error?: string };
      if (!response.ok)
        throw new Error(data.error || 'PCSO results could not be reached.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }
  function clearTicketDetails() {
    setGame('');
    setDate('');
    setLines('');
    setExpectedEntryCount(0);
    setResult(null);
    setCheckedLines([]);
    setCheckedGame('');
    setError('');
  }
  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    clearTicketDetails();
    setImage(URL.createObjectURL(file));
    setScanning(true);
    try {
      const scanFile = await optimizeTicketPhoto(file);
      const enhancedFile = await enhanceTicketPhoto(scanFile);
      const form = new FormData();
      form.append('image', scanFile);
      form.append('enhancedImage', enhancedFile);
      const response = await fetch('/api/ocr', { method: 'POST', body: form });
      const data = (await response.json()) as {
        text?: string;
        spatialText?: string;
        enhancedText?: string;
        enhancedSpatialText?: string;
        labelledText?: string;
        error?: string;
      };
      if (!response.ok || !data.text)
        throw new Error(data.error || 'The ticket could not be read.');
      const ticket = scanTicket(
        `${data.enhancedText ?? ''}\n${data.text}`.replace(/\r/g, ''),
        `${data.labelledText ?? ''}\n${data.enhancedSpatialText ?? ''}\n${data.spatialText ?? ''}`.replace(/\r/g, ''),
      );
      if (ticket.detectedGame) setGame(ticket.detectedGame);
      if (ticket.date) setDate(ticket.date);
      setLines(partialTicketEntries([data.labelledText ?? '', data.enhancedSpatialText ?? '', data.spatialText ?? '', data.enhancedText ?? '', data.text], ticket.expectedEntryCount));
      if (ticket.expectedEntryCount)
        setExpectedEntryCount(ticket.expectedEntryCount);
      const entries = ticketEntries(ticket.entries);
      if (
        !ticket.detectedGame ||
        !ticket.date ||
        ticket.expectedEntryCount === 0 ||
        entries.length < 1 ||
        (ticket.expectedEntryCount > 0 &&
          entries.length !== ticket.expectedEntryCount)
      )
        throw new Error(
          ticket.expectedEntryCount > 0
            ? `I found ${entries.length} of ${ticket.expectedEntryCount} ticket entries. The detected details are kept below—scan again or complete the missing line.`
            : 'I could not verify the printed ticket price. No automatic result was given—review the detected details and use the manual button only after correcting them.',
        );
      await checkTicket({
        game: ticket.detectedGame,
        date: ticket.date,
        lines: ticket.entries,
        expectedEntryCount: ticket.expectedEntryCount,
      });
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : 'I could not read this ticket.',
      );
    } finally {
      setScanning(false);
    }
  }
  const winning = result ? numbers(result.combination) : [];
  const displayedLines = result ? checkedLines : ticketLines;
  const displayedGame = result ? checkedGame : game;
  const hasWinner =
    result &&
    displayedLines.some(
      (line) =>
        numbers(line).filter((n) => winning.includes(n)).length ===
        winning.length,
    );
  return (
    <main className="min-h-screen bg-[#071a2b] text-slate-950">
      <div className="mesh" />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-7 sm:pt-8">
        <header className="mb-7 flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7c843] text-[#07243a]">
              <img src="/app-logo.jpg" alt="PH Lotto Checker" className="h-10 w-10 rounded-xl object-contain bg-white" />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight">
                PH-Lotto-Checker
              </h1>
              <p className="text-xs text-sky-100/70">PCSO ticket checker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
              aria-label="Refresh PH-Lotto-Checker"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <a
              href="https://www.pcso.gov.ph/searchlottoresult.aspx"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white sm:flex"
            >
              PCSO results <ExternalLink size={13} />
            </a>
          </div>
        </header>
        <section className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
          <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/20">
            <div className="grid gap-5 p-5 sm:p-7">
              <div>
                <input
                  ref={input}
                  onChange={chooseImage}
                  accept="image/*"
                  className="hidden"
                  type="file"
                  id="ticket-photo"
                />
                <label
                  htmlFor="ticket-photo"
                  className="group flex min-h-60 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-sky-200 bg-sky-50 p-4 text-center transition hover:border-sky-500 hover:bg-sky-100"
                >
                  {image ? (
                    <img
                      src={image}
                      alt="Selected lotto ticket"
                      className="max-h-96 w-full rounded-2xl object-contain"
                    />
                  ) : (
                    <>
                      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#0b6b93] text-white shadow-lg shadow-sky-900/15">
                        <Camera size={26} />
                      </span>
                      <span className="font-bold text-[#08243b]">
                        Scan ticket
                      </span>
                      <span className="mt-1 text-xs text-slate-500">
                        Use your camera or upload a photo
                      </span>
                      <span className="mt-1 text-xs text-slate-500">
                        Ticket photos are sent to Google Cloud Vision for
                        scanning.
                      </span>
                    </>
                  )}
                </label>
                {(scanning || loading) && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-sky-700">
                    <ScanLine className="animate-pulse" size={14} />
                    {scanning
                      ? 'Reading ticket details…'
                      : 'Checking official PCSO result…'}
                  </p>
                )}
                {image && (
                  <button
                    onClick={() => {
                      setImage(null);
                      clearTicketDetails();
                      if (input.current) input.current.value = '';
                    }}
                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    <RotateCcw size={13} /> Scan another ticket
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-slate-700">Detected entries (A–E)</legend>
                  <div className="space-y-2">
                    {editableTicketEntries(lines, expectedEntryCount).split('\n').map((line, rowIndex) => {
                      const slots = line.slice(2).trim().split(/\s+/);
                      return <div key={rowIndex} className="grid grid-cols-[1.2rem_repeat(6,minmax(0,1fr))] items-center gap-1">
                        <span className="text-sm font-bold">{'ABCDE'[rowIndex]}:</span>
                        {Array.from({ length: 6 }, (_, column) => <input
                          key={column}
                          aria-label={`Entry ${'ABCDE'[rowIndex]}, number ${column + 1}`}
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="__"
                          value={/^\d{1,2}$/.test(slots[column] ?? '') ? slots[column] : ''}
                          onChange={event => {
                            const value = event.target.value.replace(/\D/g, '').slice(0, 2);
                            const rows = editableTicketEntries(lines, expectedEntryCount).split('\n');
                            const values = Array.from({ length: 6 }, (_, index) => slots[index] || '__');
                            values[column] = value || '__';
                            rows[rowIndex] = `${'ABCDE'[rowIndex]}: ${values.join(' ')}`;
                            setLines(rows.join('\n'));
                            setResult(null);
                            setError('');
                          }}
                          className="min-w-0 rounded-lg border border-slate-200 px-1 py-3 text-center font-mono text-base font-bold outline-none focus:border-sky-600"
                        />)}
                      </div>;
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Fill any blanks exactly as printed, smallest to largest.</p>
                </fieldset>
                <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0 text-sm font-bold text-slate-700">
                  Detected lotto game
                  <select
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium outline-none focus:border-sky-600"
                  >
                    <option value="">Select lotto game</option>
                    {games.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0 text-sm font-bold text-slate-700">
                  Detected draw date
                  <input
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    type="date"
                    className="mt-1.5 min-w-0 max-w-full w-full rounded-xl border border-slate-200 px-1 py-3 text-sm outline-none focus:border-sky-600"
                  />
                </label>
                </div>
                <p className="text-xs text-slate-500">
                  If the app did not automatically check for results, use the
                  button to do it manually.
                </p>
                <button
                  disabled={
                    !game ||
                    !date ||
                    ticketLines.length < 1 ||
                    ticketLines.length > 5 ||
                    (expectedEntryCount > 0 &&
                      ticketLines.length !== expectedEntryCount) ||
                    loading
                  }
                  onClick={() => checkTicket()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f7c843] px-4 py-3.5 text-sm font-black text-[#08243b] shadow-lg shadow-amber-400/20 transition hover:bg-[#ffd65c] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? (
                    <>
                      <ScanLine className="animate-pulse" size={18} />
                      Checking PCSO result…
                    </>
                  ) : (
                    <>
                      CHECK RESULTS MANUALLY <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          <aside className="rounded-[2rem] bg-[#0b3150] p-5 text-white shadow-2xl shadow-black/20 sm:p-7">
            {!result && !error && (
              <div className="flex h-full min-h-80 flex-col justify-center">
                <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-[#f7c843]">
                  <Trophy size={28} />
                </span>
                <h2 className="text-2xl font-black">Ready to scan.</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-sky-100/75">
                  Show a clear, front-on ticket to the camera. We’ll identify
                  the draw and check each labelled entry automatically.
                </p>
              </div>
            )}
            {error && (
              <div className="flex h-full min-h-80 flex-col justify-center">
                <XCircle className="mb-4 text-rose-300" size={34} />
                <h2 className="text-xl font-black">
                  {checkedLines.length > 0 ? 'Ticket read — result lookup failed' : 'Couldn’t complete the automatic check'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-sky-100/75">
                  {error}
                </p>
                <p className="mt-3 text-xs leading-5 text-sky-100/60">
                  {checkedLines.length > 0 ? 'Use CHECK RESULTS MANUALLY to retry, or open the official PCSO results below.' : 'Fill missing details, then use CHECK RESULTS MANUALLY.'}
                </p>
                <a href="https://www.pcso.gov.ph/searchlottoresult.aspx" target="_blank" rel="noreferrer" className="mt-4 font-bold text-amber-300 underline">Open official PCSO results</a>
              </div>
            )}
            {result && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#f7c843]">
                  Official PCSO draw found
                </p>
                {result.savedCopy && <p className="mt-2 text-sm text-sky-100/80">Saved official result, verified on {result.verifiedOn}. Live PCSO access was unavailable.</p>}
                <h2 className="mt-2 text-xl font-black">{result.game}</h2>
                <p className="mt-1 text-sm text-sky-100/70">
                  {result.date} · Jackpot ₱{result.jackpot}
                </p>
                <div
                  className={`mt-5 rounded-2xl border p-4 ${hasWinner ? 'border-emerald-300/20 bg-emerald-400/10' : 'border-rose-300/20 bg-rose-400/10'}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-100">
                    Ticket result
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {hasWinner ? 'Winning line found' : 'No winning line'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-sky-100/75">
                    {hasWinner
                      ? 'Check the line details and verify your prize with PCSO.'
                      : 'No entry reached a winning prize tier.'}
                  </p>
                </div>
                <div className="mt-5 rounded-2xl bg-white/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-100/60">
                    Winning combination
                  </p>
                  <p className="mt-2 font-mono text-xl font-black tracking-wider text-[#f7c843]">
                    {result.combination.replaceAll('-', ' · ')}
                  </p>
                </div>
                <div className="mt-5 space-y-3">
                  {displayedLines.map((line, index) => {
                    const picked = numbers(line);
                    const matches = picked.filter((n) => winning.includes(n));
                    const tier = prizeTier(
                      displayedGame,
                      matches.length,
                      winning.length,
                    );
                    const won = matches.length >= 3;
                    return (
                      <div
                        key={`${line}-${index}`}
                        className="rounded-2xl bg-white p-4 text-[#08243b]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Entry {lineLabel(line, index)}
                            </p>
                            <p className="mt-1 font-mono text-sm font-bold">
                              {line.replace(/^\s*[A-Z]\s*[:.-]\s*/i, '')}
                            </p>
                          </div>
                          {won ? (
                            <CheckCircle2 className="text-emerald-600" />
                          ) : (
                            <XCircle className="text-slate-300" />
                          )}
                        </div>
                        <p
                          className={`mt-3 text-sm font-black ${won ? 'text-emerald-700' : 'text-slate-600'}`}
                        >
                          {tier}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Matched:{' '}
                          {matches.length ? matches.join(', ') : 'none'}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <a
                  href="https://www.pcso.gov.ph/searchlottoresult.aspx"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#f7c843] underline underline-offset-4"
                >
                  Verify on PCSO <ExternalLink size={13} />
                </a>
              </div>
            )}
          </aside>
        </section>
        <footer className="mx-auto mt-6 max-w-4xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs leading-5 text-sky-100/70">
          PH-Lotto-Checker is an independent helper, not PCSO. Results and
          prizes must be verified with the official PCSO draw results and your
          original ticket before claiming.
        </footer>
      </div>
    </main>
  );
}
