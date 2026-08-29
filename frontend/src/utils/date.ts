/**
 * Utility functions for robust local timezone and timestamp formatting.
 * Ensures UTC strings from backend (even without 'Z' suffix) are parsed
 * as UTC and displayed in local timezone (IST, 12-hour AM/PM format).
 */

export function parseUtcDate(ts: string | Date | undefined | null): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  let str = String(ts).trim();
  if (!str) return null;
  // If string does not specify timezone offset, append 'Z' so JS treats it as UTC
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('GMT') && str.includes('T')) {
    str += 'Z';
  } else if (!str.endsWith('Z') && !str.includes('+') && !str.includes('GMT') && str.includes(' ')) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatLocalTime(ts: string | Date | undefined | null): string {
  const d = parseUtcDate(ts);
  if (!d) return '—';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatLocalDateTime(ts: string | Date | undefined | null): string {
  const d = parseUtcDate(ts);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
