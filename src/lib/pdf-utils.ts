
import { PDFDocument, rgb, degrees, PDFName } from 'pdf-lib';

export const A4_PORTRAIT_WIDTH = 595.28; // 210mm in pt (Vertical / Retrato: 210 * 72 / 25.4)
export const A4_PORTRAIT_HEIGHT = 841.89; // 297mm in pt (Vertical / Retrato: 297 * 72 / 25.4)
export const A4_LANDSCAPE_WIDTH = 841.89; // 297mm in pt (Horizontal / Paisagem)
export const A4_LANDSCAPE_HEIGHT = 595.28; // 210mm in pt (Horizontal / Paisagem)

export const A4_WIDTH = A4_LANDSCAPE_WIDTH;
export const A4_HEIGHT = A4_LANDSCAPE_HEIGHT;

export function normalizePage(page: any, width: number, height: number) {
  page.setSize(width, height);
  page.setRotation(degrees(0));
  try {
    if (page.node && typeof page.node.delete === 'function') {
      page.node.delete(PDFName.of('Rotate'));
    }
  } catch {
    // 0 degrees guaranteed
  }
}

export async function createImposition(
  pdfBuffer: ArrayBuffer,
  preset: 'pocketbook-a6' | 'booklet-a5' | 'cut-stack-a6',
  addCropMarks: boolean
): Promise<Uint8Array> {
  const sourcePdf = await PDFDocument.load(pdfBuffer);
  const outPdf = await PDFDocument.create();
  const pages = sourcePdf.getPages();
  const totalPages = pages.length;

  if (preset === 'pocketbook-a6') {
    // 8 pages per sheet (4 front, 4 back) - A4 Vertical (Portrait)
    const multiplier = 8;
    const sheetsCount = Math.ceil(totalPages / multiplier);

    for (let s = 0; s < sheetsCount; s++) {
      const base = s * multiplier;
      
      // Front Page (A4 Retrato)
      const frontPage = outPdf.addPage([A4_PORTRAIT_WIDTH, A4_PORTRAIT_HEIGHT]);
      normalizePage(frontPage, A4_PORTRAIT_WIDTH, A4_PORTRAIT_HEIGHT);
      const frontIndices = [base + 7, base + 0, base + 5, base + 2]; // 8, 1, 6, 3 (0-indexed: 7, 0, 5, 2)
      await drawQuadrants(sourcePdf, outPdf, frontPage, frontIndices, addCropMarks);

      // Back Page (A4 Retrato)
      const backPage = outPdf.addPage([A4_PORTRAIT_WIDTH, A4_PORTRAIT_HEIGHT]);
      normalizePage(backPage, A4_PORTRAIT_WIDTH, A4_PORTRAIT_HEIGHT);
      const backIndices = [base + 1, base + 6, base + 3, base + 4]; // 2, 7, 4, 5 (0-indexed: 1, 6, 3, 4)
      await drawQuadrants(sourcePdf, outPdf, backPage, backIndices, addCropMarks);
    }
  } else if (preset === 'booklet-a5') {
    // 4 pages per sheet (2 front, 2 back)
    const multiplier = 4;
    const sheetsCount = Math.ceil(totalPages / multiplier);
    
    for (let s = 0; s < sheetsCount; s++) {
      const base = s * multiplier;
      // Pattern: Back-page, Front-page (e.g., 4, 1, 2, 3)
      // Actually standard booklet is:
      // Sheet 1 Front: [4, 1]
      // Sheet 1 Back: [2, 3]
      const frontPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
      normalizePage(frontPage, A4_WIDTH, A4_HEIGHT);
      await drawHalves(sourcePdf, outPdf, frontPage, [base + 3, base + 0], addCropMarks);

      const backPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
      normalizePage(backPage, A4_WIDTH, A4_HEIGHT);
      await drawHalves(sourcePdf, outPdf, backPage, [base + 1, base + 2], addCropMarks);
    }
  } else if (preset === 'cut-stack-a6') {
    // Similar to pocketbook but simpler stacking or whatever the user expects.
    // User said: "Corte em 4 partes soltas (8 páginas por A4)".
    // This usually means page 1, 2, 3, 4 are in the same quadrant across sheets.
    // For simplicity, let's stick to the 8-page block logic but maybe different order if needed.
    // User didn't specify the exact logic for Cut & Stack, but 8 per A4 is the same density.
    // I'll implement a simple sequential imposition for Cut & Stack.
    const multiplier = 8;
    const sheetsCount = Math.ceil(totalPages / multiplier);
    for (let s = 0; s < sheetsCount; s++) {
      const base = s * multiplier;
      const frontPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
      normalizePage(frontPage, A4_WIDTH, A4_HEIGHT);
      await drawQuadrants(sourcePdf, outPdf, frontPage, [base + 0, base + 1, base + 2, base + 3], addCropMarks);
      const backPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
      normalizePage(backPage, A4_WIDTH, A4_HEIGHT);
      await drawQuadrants(sourcePdf, outPdf, backPage, [base + 4, base + 5, base + 6, base + 7], addCropMarks);
    }
  }

  return await outPdf.save();
}

async function drawQuadrants(
  sourcePdf: PDFDocument,
  outPdf: PDFDocument,
  targetPage: any,
  indices: number[],
  addCropMarks: boolean
) {
  const pW = targetPage.getWidth();
  const pH = targetPage.getHeight();
  const qW = pW / 2;
  const qH = pH / 2;

  // Top-Left, Top-Right, Bottom-Left, Bottom-Right
  const positions = [
    { x: 0, y: qH },
    { x: qW, y: qH },
    { x: 0, y: 0 },
    { x: qW, y: 0 }
  ];

  for (let i = 0; i < 4; i++) {
    const idx = indices[i];
    if (idx < sourcePdf.getPageCount()) {
      const [embeddedPage] = await outPdf.embedPages([sourcePdf.getPage(idx)]);
      const { width, height } = embeddedPage;
      const scale = Math.min(qW / width, qH / height);
      const drawW = width * scale;
      const drawH = height * scale;
      const offsetX = (qW - drawW) / 2;
      const offsetY = (qH - drawH) / 2;

      targetPage.drawPage(embeddedPage, {
        x: positions[i].x + offsetX,
        y: positions[i].y + offsetY,
        width: drawW,
        height: drawH,
      });
    }
  }

  if (addCropMarks) {
    const color = rgb(0.8, 0.8, 0.8);
    // Vertical line
    targetPage.drawLine({
      start: { x: qW, y: 0 },
      end: { x: qW, y: pH },
      thickness: 0.5,
      color,
      dashArray: [5, 5],
    });
    // Horizontal line
    targetPage.drawLine({
      start: { x: 0, y: qH },
      end: { x: pW, y: qH },
      thickness: 0.5,
      color,
      dashArray: [5, 5],
    });
  }
}

async function drawHalves(
  sourcePdf: PDFDocument,
  outPdf: PDFDocument,
  targetPage: any,
  indices: number[],
  addCropMarks: boolean
) {
  const hW = A4_WIDTH / 2;
  const hH = A4_HEIGHT;

  const positions = [
    { x: 0, y: 0 },
    { x: hW, y: 0 }
  ];

  for (let i = 0; i < 2; i++) {
    const idx = indices[i];
    if (idx < sourcePdf.getPageCount()) {
      const [embeddedPage] = await outPdf.embedPages([sourcePdf.getPage(idx)]);
      const { width, height } = embeddedPage;
      const scale = Math.min(hW / width, hH / height);
      
      const drawW = width * scale;
      const drawH = height * scale;
      const offsetX = (hW - drawW) / 2;
      const offsetY = (hH - drawH) / 2;

      targetPage.drawPage(embeddedPage, {
        x: positions[i].x + offsetX,
        y: positions[i].y + offsetY,
        width: drawW,
        height: drawH,
      });
    }
  }

  if (addCropMarks) {
    targetPage.drawLine({
      start: { x: hW, y: 0 },
      end: { x: hW, y: A4_HEIGHT },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
      dashArray: [5, 5],
    });
  }
}
