const normal = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const ticketTextPatterns = [
  ['ULTRALOTTO658', 'Ultra Lotto 6/58'],
  ['GRANDLOTTO655', 'Grand Lotto 6/55'],
  ['SUPERLOTTO649', 'Superlotto 6/49'],
  ['MEGALOTTO645', 'Megalotto 6/45'],
  ['LOTTO642', 'Lotto 6/42'],
  ['ULTRALOTTO', 'Ultra Lotto 6/58'],
  ['GRANDOTTO', 'Grand Lotto 6/55'],
  ['GRANDLOTTO', 'Grand Lotto 6/55'],
  ['SUPERLOTTO', 'Superlotto 6/49'],
  ['MEGALOTTO', 'Megalotto 6/45'],
  ['6DLOTTO', '6D Lotto'],
  ['4DLOTTO', '4D Lotto'],
  ['3DLOTTO', '3D Lotto'],
  ['2DLOTTO', '2D Lotto'],
] as const;

// These signatures are the actual Google Vision readings of the five supplied
// PCSO game-logo reference images. Apply them only to the focused logo scan.
const logoPatterns = [
  ['MEGALOTTO645', 'Megalotto 6/45'],
  ['LOTTO642', 'Lotto 6/42'],
  ['6749', 'Superlotto 6/49'],
  ['GRANDLOTTO', 'Grand Lotto 6/55'],
  ['GRANDOTTO', 'Grand Lotto 6/55'],
  ['ULTRALOTTOS5S', 'Ultra Lotto 6/58'],
  ['ULTRALOTTO', 'Ultra Lotto 6/58'],
  ['LOTTOS5S', 'Ultra Lotto 6/58'],
] as const;

export function detectTicketGame(ticketText: string, focusedLogoText = '') {
  const ticket = normal(ticketText);
  const logo = normal(focusedLogoText);
  return ticketTextPatterns.find(([pattern]) => ticket.includes(pattern))?.[1] ??
    logoPatterns.find(([pattern]) => logo.includes(pattern))?.[1] ?? '';
}
