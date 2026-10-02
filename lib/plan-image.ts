// Browser-only: turn whatever the user picked (a PDF page or a photo) into a
// JPEG small enough for the detection request. Vercel caps request bodies
// at about 4.5 MB, and Claude scales images down to roughly 1.5k pixels on
// the long side anyway, so sending more only costs upload time.

export const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.88;

export interface PlanImage {
  base64: string;
  mediaType: 'image/jpeg';
  /** Data URL for showing what will be sent. */
  previewUrl: string;
}

export function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Scale (w, h) down so the longer side is at most `max`, never up. */
export function fitWithin(w: number, h: number, max = MAX_EDGE) {
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

function canvasToPlanImage(canvas: HTMLCanvasElement): PlanImage {
  const previewUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { base64: previewUrl.slice(previewUrl.indexOf(',') + 1), mediaType: 'image/jpeg', previewUrl };
}

// Plans are line drawings, often with transparent backgrounds: paint white
// first so transparent areas don't turn black in the JPEG.
function whiteCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser can’t prepare images.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

export async function imageFileToPlanImage(file: File): Promise<PlanImage> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not read that image. Try a PNG, JPG or WebP file.');
  });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const { canvas, ctx } = whiteCanvas(width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvasToPlanImage(canvas);
}

type PdfDocument = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;

/** An open PDF: its page count, plus `destroy` to free its worker memory. */
export interface OpenPdf {
  doc: PdfDocument;
  pages: number;
  destroy: () => Promise<void>;
}

let pdfjsReady: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;
function loadPdfjs() {
  // Loaded on first use only, so pages that never see a PDF don't pay for it.
  // The legacy build polyfills very new JavaScript (e.g. Map.getOrInsertComputed)
  // that phone browsers such as Samsung Internet don't ship yet.
  pdfjsReady ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsReady;
}

export async function openPdf(file: File): Promise<OpenPdf> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    return { doc, pages: doc.numPages, destroy: () => task.destroy() };
  } catch (err) {
    void task.destroy();
    const name = (err as { name?: string })?.name;
    throw new Error(name === 'PasswordException' ? 'That PDF is password-protected. Remove the password and try again.' : 'Could not open that PDF.');
  }
}

/** Render one page (1-based) to a plan image, `maxEdge` px on the long side. */
export async function renderPdfPage(pdf: OpenPdf, pageNumber: number, maxEdge = MAX_EDGE): Promise<PlanImage> {
  const page = await pdf.doc.getPage(pageNumber);
  // PDF sizes are in points (a Letter page is 612×792), far too coarse for
  // room labels, so scale up to `maxEdge` as well as down. Huge sheets (24×36
  // inch drawings) scale down; the 4× cap only matters for tiny pages.
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(maxEdge / Math.max(base.width, base.height), 4);
  const viewport = page.getViewport({ scale });
  const { canvas, ctx } = whiteCanvas(Math.round(viewport.width), Math.round(viewport.height));
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvasToPlanImage(canvas);
}
