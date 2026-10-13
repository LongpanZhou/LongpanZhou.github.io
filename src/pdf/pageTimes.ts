// Remembers how long recent pages took to translate, so the progress bar can show
// a realistic average. Kept in localStorage, so it carries across visits.

const KEY = 'pdfv.pageTimes';
const KEEP = 20;

function readPageTimes(): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function recordPageTime(seconds: number): void {
  try {
    const times = readPageTimes();
    times.push(seconds);
    localStorage.setItem(KEY, JSON.stringify(times.slice(-KEEP)));
  } catch {
    // Storage can be blocked (e.g. private windows); the average just won't carry across visits.
  }
}

// Average seconds per translated page, or null before any page has been timed.
export function averagePageSeconds(): number | null {
  const times = readPageTimes();
  if (!times.length) return null;
  return times.reduce((sum, t) => sum + t, 0) / times.length;
}
