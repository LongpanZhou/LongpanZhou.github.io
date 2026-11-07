// Turning a browser address into the PDF it points at. Kept apart from the pdf.js loader so the
// parts of the site that only need the address do not pull pdf.js in with them.

/**
 * Turn the browser path into the URL of a PDF to load.
 *
 *   /arxiv.org/pdf/1706.03762            -> https://arxiv.org/pdf/1706.03762
 *   /https://arxiv.org/pdf/1706.03762    -> https://arxiv.org/pdf/1706.03762
 *   /http://example.com/a.pdf            -> http://example.com/a.pdf
 *
 * Returns null when the path does not look like a host/URL.
 */
export function resolveTarget(pathname: string, search: string): string | null {
  let raw = pathname.replace(/^\/+/, '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw as-is if it is not valid percent-encoding */
  }
  if (!raw) return null;

  // Browsers collapse "https://" in the path to "https:/" — restore it.
  raw = raw.replace(/^(https?):\/+/i, '$1://');

  let url: string;
  if (/^https?:\/\//i.test(raw)) {
    url = raw;
  } else {
    const firstSegment = raw.split('/')[0];
    if (!firstSegment.includes('.') || /\s/.test(firstSegment)) return null;
    url = 'https://' + raw;
  }

  if (search && search.length > 1) url += search;

  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

/** Bare `host/path` form used in the address box and for share links. */
export function bareForm(url: string): string {
  return url.replace(/^https?:\/\//i, '');
}
