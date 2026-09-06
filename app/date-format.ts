const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function displayDrawDate(value: string) {
  let year = 0, month = 0, day = 0;
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) [, year, month, day] = match.map(Number);
  else {
    match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) [, month, day, year] = match.map(Number);
  }
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return value;
  return `${String(day).padStart(2, '0')}-${monthNames[month - 1]}-${year}`;
}

export function storedDrawDate(value: string) {
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return value;
  const month = monthNames.findIndex((name) => name.toLowerCase() === match[2].toLowerCase()) + 1;
  if (!month) return value;
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}
