import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Served from a CDN so PDFs that rely on the 14 standard fonts or on CJK
// CMaps still render correctly.
const PDFJS_VERSION = pdfjsLib.version;
const CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;
const STANDARD_FONTS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`;

/** Starts loading a PDF. The caller destroys the task when it is done with it. */
export function loadPdfDocument(url: string) {
  return pdfjsLib.getDocument({
    url,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
  });
}
