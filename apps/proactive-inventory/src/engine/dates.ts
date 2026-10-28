const DAY = 86_400_000;

export function toTime(iso: string): number {
  return Date.parse(iso + 'T00:00:00Z');
}

export function addDays(iso: string, days: number): string {
  return new Date(toTime(iso) + days * DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY);
}

export function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function fmtDate(iso: string, withYear = false): string {
  return (withYear ? fmtYear : fmt).format(new Date(toTime(iso)));
}

export function fmtMoney(v: number): string {
  return v >= 10_000
    ? `$${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k`
    : `$${Math.round(v).toLocaleString('en-US')}`;
}

export function fmtNum(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}
