import { PDFDocument, rgb, StandardFonts, degrees, PDFName } from 'pdf-lib';
import { ImpositionPreset, ImpositionConfig, ImpositionStats, SignatureSetting } from '../types';

export const A4_PORTRAIT_WIDTH = 595.28; // 210mm in pt (Vertical / Retrato: 210 * 72 / 25.4)
export const A4_PORTRAIT_HEIGHT = 841.89; // 297mm in pt (Vertical / Retrato: 297 * 72 / 25.4)
export const A4_LANDSCAPE_WIDTH = 841.89; // 297mm in pt (Horizontal / Paisagem)
export const A4_LANDSCAPE_HEIGHT = 595.28; // 210mm in pt (Horizontal / Paisagem)

export const A4_WIDTH = A4_LANDSCAPE_WIDTH;
export const A4_HEIGHT = A4_LANDSCAPE_HEIGHT;

/**
 * Normaliza rigorosamente o canvas da página gerada para impedir tags de rotação (/Rotate)
 * e garantir sistema de coordenadas 0° voltado para cima com dimensões exatas.
 */
export function normalizePage(page: any, width: number, height: number) {
  page.setSize(width, height);
  page.setRotation(degrees(0));
  try {
    if (page.node && typeof page.node.delete === 'function') {
      page.node.delete(PDFName.of('Rotate'));
    }
  } catch {
    // setRotation(degrees(0)) já normatizou o dicionário
  }
}

/**
 * Sanitizes and strips any leading BOM, whitespace, or preamble before the %PDF- header.
 * Ensures the buffer starts strictly at the %PDF- magic bytes required by pdf-lib.
 */
export function sanitizePdfBuffer(input: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = input instanceof Uint8Array 
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    : new Uint8Array(input);

  if (bytes.length === 0) {
    throw new Error('O arquivo selecionado está vazio (0 bytes).');
  }

  // Look for the '%PDF-' magic header: 0x25, 0x50, 0x44, 0x46, 0x2D
  const header = [0x25, 0x50, 0x44, 0x46, 0x2D];
  let headerOffset = -1;

  // Search up to the first 4096 bytes (PDF specification allows header in the first 1024 bytes)
  const maxSearch = Math.min(bytes.length - 5, 4096);
  for (let i = 0; i <= maxSearch; i++) {
    if (
      bytes[i] === header[0] &&
      bytes[i + 1] === header[1] &&
      bytes[i + 2] === header[2] &&
      bytes[i + 3] === header[3] &&
      bytes[i + 4] === header[4]
    ) {
      headerOffset = i;
      break;
    }
  }

  // Fallback: If not found in first 4KB, scan entire buffer
  if (headerOffset === -1 && bytes.length > maxSearch) {
    for (let i = maxSearch; i <= bytes.length - 5; i++) {
      if (
        bytes[i] === header[0] &&
        bytes[i + 1] === header[1] &&
        bytes[i + 2] === header[2] &&
        bytes[i + 3] === header[3] &&
        bytes[i + 4] === header[4]
      ) {
        headerOffset = i;
        break;
      }
    }
  }

  if (headerOffset === -1) {
    // Check if it's text/html to give an actionable, friendly error
    const preview = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 256)));
    if (preview.toLowerCase().includes('<!doctype') || preview.toLowerCase().includes('<html')) {
      throw new Error('O arquivo selecionado é uma página HTML ou texto, não um documento PDF válido.');
    }
    throw new Error('O arquivo não contém a assinatura válida de um PDF (%PDF-). Verifique se o arquivo está corrompido.');
  }

  // If header is at 0, return a clean Uint8Array; otherwise slice from headerOffset
  if (headerOffset === 0) {
    return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  return new Uint8Array(bytes.buffer.slice(bytes.byteOffset + headerOffset, bytes.byteOffset + bytes.byteLength));
}

export interface ImpositionResult {
  pdfBytes: Uint8Array;
  stats: ImpositionStats;
}

export interface SignatureSlice {
  sigIndex: number;
  sigNumber: number;
  sheetsCount: number;
  pagesCapacity: number;
  // Sub-array isolado de páginas deste caderno: índice 0-based do PDF original ou null para páginas em branco
  pages: (number | null)[];
}

/**
 * 1. FATIAMENTO PRIMÁRIO (Slicing):
 * Divide as páginas do PDF em sub-arrays (Cadernos) com base no limite do caderno.
 * Exemplo no A7 com 5 folhas A4 (80 págs por caderno):
 *   Caderno 1 = Páginas [1 até 80]
 *   Caderno 2 = Páginas [81 até 160]
 *   Caderno 3 = Páginas [161 até fim]
 */
export function sliceSignatures(
  originalPages: number,
  config: ImpositionConfig
): SignatureSlice[] {
  const pagesPerSheet = getPagesPerSheet(config.preset);
  const totalSheetsNeeded = Math.ceil(Math.max(1, originalPages) / pagesPerSheet);

  let maxSheetsCapacity: number;
  if (config.sheetsPerSignature === 'single') {
    maxSheetsCapacity = Math.max(1, totalSheetsNeeded);
  } else {
    const s = typeof config.sheetsPerSignature === 'number'
      ? config.sheetsPerSignature
      : (config.customSheetsCount || 4);
    maxSheetsCapacity = Math.max(1, s);
  }

  const pagesPerSigCapacity = maxSheetsCapacity * pagesPerSheet;
  const slices: SignatureSlice[] = [];

  let currentPage = 0; // 0-based index
  let sigIndex = 0;

  while (currentPage < originalPages) {
    const targetCount = Math.min(pagesPerSigCapacity, originalPages - currentPage);
    const pagesInThisSig: (number | null)[] = [];

    for (let i = 0; i < targetCount; i++) {
      pagesInThisSig.push(currentPage + i);
    }
    currentPage += targetCount;

    // Número de folhas A4 necessárias para este caderno individual
    const sheetsCount = Math.ceil(pagesInThisSig.length / pagesPerSheet);
    const sigCapacity = sheetsCount * pagesPerSheet;

    // Preenche com null (página em branco) apenas para fechar o múltiplo da folha A4 deste caderno
    while (pagesInThisSig.length < sigCapacity) {
      pagesInThisSig.push(null);
    }

    slices.push({
      sigIndex,
      sigNumber: sigIndex + 1,
      sheetsCount,
      pagesCapacity: sigCapacity,
      pages: pagesInThisSig,
    });

    sigIndex++;
  }

  if (slices.length === 0) {
    slices.push({
      sigIndex: 0,
      sigNumber: 1,
      sheetsCount: 1,
      pagesCapacity: pagesPerSheet,
      pages: new Array(pagesPerSheet).fill(null),
    });
  }

  return slices;
}

export function calculateImpositionStats(
  originalPages: number,
  preset: ImpositionPreset,
  signatureSetting: SignatureSetting,
  customSheetsCount: number = 4
): ImpositionStats {
  const pagesPerSheet = getPagesPerSheet(preset);

  if (originalPages <= 0) {
    return {
      originalPages: 0,
      totalPagesWithBlanks: 0,
      blankPagesAdded: 0,
      signaturesCount: 1,
      sheetsPerSignature: 1,
      signatureSheets: [1],
      signatureDetailsSummary: 'Nenhum documento carregado',
      totalA4Sheets: 0,
      totalImposedPages: 0,
    };
  }

  const dummyConfig: ImpositionConfig = {
    preset,
    sheetsPerSignature: signatureSetting,
    customSheetsCount,
    addCropMarks: true,
    addFoldGuides: true,
    addSignatureLabels: true,
  };

  const slices = sliceSignatures(originalPages, dummyConfig);
  const signatureSheets = slices.map((s) => s.sheetsCount);
  const totalA4Sheets = signatureSheets.reduce((a, b) => a + b, 0);
  const totalPagesWithBlanks = totalA4Sheets * pagesPerSheet;
  const blankPagesAdded = totalPagesWithBlanks - originalPages;
  const signaturesCount = slices.length;

  const maxSheetsCapacity = signatureSetting === 'single'
    ? totalA4Sheets
    : Math.max(1, typeof signatureSetting === 'number' ? signatureSetting : customSheetsCount);

  let signatureDetailsSummary = '';
  if (signaturesCount === 1) {
    const s = signatureSheets[0];
    const p = s * pagesPerSheet;
    signatureDetailsSummary = `1 caderno de ${s} folha${s > 1 ? 's' : ''} A4 (${p} páginas)`;
  } else {
    const allSame = signatureSheets.every((s) => s === signatureSheets[0]);
    if (allSame) {
      signatureDetailsSummary = `${signaturesCount} cadernos isolados de ${signatureSheets[0]} folhas A4 (${signatureSheets[0] * pagesPerSheet} págs cada)`;
    } else {
      const fullCount = signatureSheets.filter((s) => s === maxSheetsCapacity).length;
      const lastSheets = signatureSheets[signaturesCount - 1];
      const lastPages = lastSheets * pagesPerSheet;
      if (fullCount === 1) {
        signatureDetailsSummary = `1 caderno de ${maxSheetsCapacity} folhas + 1 caderno final de ${lastSheets} folha${lastSheets > 1 ? 's' : ''} (${lastPages} págs)`;
      } else {
        signatureDetailsSummary = `${fullCount} cadernos de ${maxSheetsCapacity} folhas + 1 caderno final de ${lastSheets} folha${lastSheets > 1 ? 's' : ''} (${lastPages} págs)`;
      }
    }
  }

  return {
    originalPages,
    totalPagesWithBlanks,
    blankPagesAdded,
    signaturesCount,
    sheetsPerSignature: maxSheetsCapacity,
    signatureSheets,
    signatureDetailsSummary,
    totalA4Sheets,
    totalImposedPages: totalA4Sheets * 2,
  };
}

export function getPagesPerSheet(preset: ImpositionPreset): number {
  switch (preset) {
    case 'booklet-a5':
      return 4; // 2 Front, 2 Back
    case 'pocketbook-a6':
      return 8; // 4 Front, 4 Back
    case 'mini-pocket-a7':
      return 16; // 8 Front, 8 Back
    case 'cut-stack':
      return 8; // 4 Front, 4 Back
    default:
      return 8;
  }
}

export interface ImpositionOptions {
  onlyFirstSheet?: boolean;
  onProgress?: (progress: { current: number; total: number; percent: number }) => void;
}

/**
 * =========================================================================
 * MATRIZ DE IMPOSIÇÃO A7 COM ESPELHAMENTO DO VERSO (DUPLEX BORDA CURTA)
 * =========================================================================
 * 
 * Para que a Página 2 fique exatamente nas costas da Página 1 após a impressão duplex
 * (virada na Borda Curta / Flip on Short Edge em papel Paisagem), as colunas do VERSO
 * são espelhadas horizontalmente:
 * 
 * FRENTE A4 (Paisagem):
 * - Linha Superior: [ Quadrante(N),   Quadrante(1), Quadrante(N-2), Quadrante(3) ]
 * - Linha Inferior: [ Quadrante(N-4), Quadrante(5), Quadrante(N-6), Quadrante(7) ]
 * 
 * VERSO A4 (Com espelhamento de colunas para coincidir com a frente na virada Borda Curta):
 * - Linha Superior: [ Quadrante(4), Quadrante(N-3), Quadrante(2), Quadrante(N-1) ]
 * - Linha Inferior: [ Quadrante(8), Quadrante(N-7), Quadrante(6), Quadrante(N-5) ]
 * 
 * Regras:
 * 1. Utiliza os índices fatiados do caderno local (0 a N-1).
 * 2. Mantém a orientação vertical das páginas no PDF sem rotação adicional.
 */
export function getA7ImpositionMatrix(
  pagesInSig: (number | null)[],
  sheetsInSig: number,
  sheetIndexInSig: number
) {
  const N = pagesInSig.length;
  const M = 4 * sheetsInSig;
  const k = sheetIndexInSig;

  const strip0 = k;
  const strip1 = 2 * sheetsInSig - 1 - k;
  const strip2 = 2 * sheetsInSig + k;
  const strip3 = M - 1 - k;

  // FRENTE A4 (Paisagem):
  // - Linha Superior: [ Quadrante(N),   Quadrante(1), Quadrante(N-2), Quadrante(3) ]
  // - Linha Inferior: [ Quadrante(N-4), Quadrante(5), Quadrante(N-6), Quadrante(7) ]
  const frontTop = [
    pagesInSig[N - 2 * strip0 - 1], // Quadrante(N)   -> Coluna 0
    pagesInSig[2 * strip0],         // Quadrante(1)   -> Coluna 1
    pagesInSig[N - 2 * strip1 - 1], // Quadrante(N-2) -> Coluna 2
    pagesInSig[2 * strip1],         // Quadrante(3)   -> Coluna 3
  ] as const;

  const frontBottom = [
    pagesInSig[N - 2 * strip2 - 1], // Quadrante(N-4) -> Coluna 0
    pagesInSig[2 * strip2],         // Quadrante(5)   -> Coluna 1
    pagesInSig[N - 2 * strip3 - 1], // Quadrante(N-6) -> Coluna 2
    pagesInSig[2 * strip3],         // Quadrante(7)   -> Coluna 3
  ] as const;

  // VERSO A4 (Com espelhamento de colunas para coincidir com a frente na virada na Borda Curta):
  // - Linha Superior: [ Quadrante(4), Quadrante(N-3), Quadrante(2), Quadrante(N-1) ]
  // - Linha Inferior: [ Quadrante(8), Quadrante(N-7), Quadrante(6), Quadrante(N-5) ]
  const backTop = [
    pagesInSig[2 * strip1 + 1],     // Quadrante(4)   -> Coluna 0 (Costas do Quadrante 3 da Frente)
    pagesInSig[N - 2 * strip1 - 2], // Quadrante(N-3) -> Coluna 1 (Costas do Quadrante N-2 da Frente)
    pagesInSig[2 * strip0 + 1],     // Quadrante(2)   -> Coluna 2 (Costas do Quadrante 1 da Frente)
    pagesInSig[N - 2 * strip0 - 2], // Quadrante(N-1) -> Coluna 3 (Costas do Quadrante N da Frente)
  ] as const;

  const backBottom = [
    pagesInSig[2 * strip3 + 1],     // Quadrante(8)   -> Coluna 0 (Costas do Quadrante 7 da Frente)
    pagesInSig[N - 2 * strip3 - 2], // Quadrante(N-7) -> Coluna 1 (Costas do Quadrante N-6 da Frente)
    pagesInSig[2 * strip2 + 1],     // Quadrante(6)   -> Coluna 2 (Costas do Quadrante 5 da Frente)
    pagesInSig[N - 2 * strip2 - 2], // Quadrante(N-5) -> Coluna 3 (Costas do Quadrante N-4 da Frente)
  ] as const;

  return {
    front: { top: frontTop, bottom: frontBottom },
    back: { top: backTop, bottom: backBottom },
    strips: { strip0, strip1, strip2, strip3 },
  };
}

export interface ImpositionA7Helpers {
  addSlugHeader: (page: any, sigNum: number, sheetNum: number, side: 'Frente' | 'Verso') => void;
  drawGuides: (page: any, type: 'octants') => void;
  drawSourcePageOrBlank: (
    targetPage: any,
    pageIndex: number | null | undefined,
    box: { x: number; y: number; width: number; height: number }
  ) => Promise<void>;
  A4_WIDTH: number;
  A4_HEIGHT: number;
}

/**
 * Função 'gerarImposicaoA7':
 * Renderiza uma folha A4 completa (Frente e Verso) para o preset Mini Pocket A7
 * aplicando estritamente a matriz espelhada do verso para impressão duplex (virada na borda curta).
 */
export async function gerarImposicaoA7(
  caderno: SignatureSlice,
  sheetIndexInSig: number,
  outPdf: any,
  helpers: ImpositionA7Helpers
): Promise<{ frontPage: any; backPage: any }> {
  const { addSlugHeader, drawGuides, drawSourcePageOrBlank, A4_WIDTH, A4_HEIGHT } = helpers;
  const cW = A4_WIDTH / 4;
  const rH = A4_HEIGHT / 2;

  const matrix = getA7ImpositionMatrix(caderno.pages, caderno.sheetsCount, sheetIndexInSig);

  // --- FRENTE A4 (Paisagem) ---
  const frontPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
  normalizePage(frontPage, A4_WIDTH, A4_HEIGHT);
  addSlugHeader(frontPage, caderno.sigNumber, sheetIndexInSig + 1, 'Frente');
  drawGuides(frontPage, 'octants');

  // Linha Superior Frente: [ Quadrante(N), Quadrante(1), Quadrante(N-2), Quadrante(3) ]
  await drawSourcePageOrBlank(frontPage, matrix.front.top[0], { x: 0, y: rH, width: cW, height: rH });
  await drawSourcePageOrBlank(frontPage, matrix.front.top[1], { x: cW, y: rH, width: cW, height: rH });
  await drawSourcePageOrBlank(frontPage, matrix.front.top[2], { x: 2 * cW, y: rH, width: cW, height: rH });
  await drawSourcePageOrBlank(frontPage, matrix.front.top[3], { x: 3 * cW, y: rH, width: cW, height: rH });

  // Linha Inferior Frente: [ Quadrante(N-4), Quadrante(5), Quadrante(N-6), Quadrante(7) ]
  await drawSourcePageOrBlank(frontPage, matrix.front.bottom[0], { x: 0, y: 0, width: cW, height: rH });
  await drawSourcePageOrBlank(frontPage, matrix.front.bottom[1], { x: cW, y: 0, width: cW, height: rH });
  await drawSourcePageOrBlank(frontPage, matrix.front.bottom[2], { x: 2 * cW, y: 0, width: cW, height: rH });
  await drawSourcePageOrBlank(frontPage, matrix.front.bottom[3], { x: 3 * cW, y: 0, width: cW, height: rH });

  // --- VERSO A4 (Com espelhamento de colunas para virada na Borda Curta) ---
  const backPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
  normalizePage(backPage, A4_WIDTH, A4_HEIGHT);
  addSlugHeader(backPage, caderno.sigNumber, sheetIndexInSig + 1, 'Verso');
  drawGuides(backPage, 'octants');

  // Linha Superior Verso: [ Quadrante(4), Quadrante(N-3), Quadrante(2), Quadrante(N-1) ]
  await drawSourcePageOrBlank(backPage, matrix.back.top[0], { x: 0, y: rH, width: cW, height: rH });
  await drawSourcePageOrBlank(backPage, matrix.back.top[1], { x: cW, y: rH, width: cW, height: rH });
  await drawSourcePageOrBlank(backPage, matrix.back.top[2], { x: 2 * cW, y: rH, width: cW, height: rH });
  await drawSourcePageOrBlank(backPage, matrix.back.top[3], { x: 3 * cW, y: rH, width: cW, height: rH });

  // Linha Inferior Verso: [ Quadrante(8), Quadrante(N-7), Quadrante(6), Quadrante(N-5) ]
  await drawSourcePageOrBlank(backPage, matrix.back.bottom[0], { x: 0, y: 0, width: cW, height: rH });
  await drawSourcePageOrBlank(backPage, matrix.back.bottom[1], { x: cW, y: 0, width: cW, height: rH });
  await drawSourcePageOrBlank(backPage, matrix.back.bottom[2], { x: 2 * cW, y: 0, width: cW, height: rH });
  await drawSourcePageOrBlank(backPage, matrix.back.bottom[3], { x: 3 * cW, y: 0, width: cW, height: rH });

  return { frontPage, backPage };
}

/**
 * Creates the imposed PDF according to the selected preset and Coptic signature settings.
 * Optimized with embedded page caching and optional onlyFirstSheet mode for instant lightweight previews.
 */
export async function createImposedPDF(
  sourceBuffer: ArrayBuffer | Uint8Array,
  config: ImpositionConfig,
  options?: ImpositionOptions
): Promise<ImpositionResult> {
  const cleanBytes = sanitizePdfBuffer(sourceBuffer);
  const sourcePdf = await PDFDocument.load(cleanBytes, { ignoreEncryption: true });
  const outPdf = await PDFDocument.create();

  const originalPages = sourcePdf.getPageCount();
  const stats = calculateImpositionStats(
    originalPages,
    config.preset,
    config.sheetsPerSignature,
    config.customSheetsCount
  );

  const font = await outPdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await outPdf.embedFont(StandardFonts.HelveticaBold);

  const pagesPerSheet = getPagesPerSheet(config.preset);

  // Cache embedded pages so identical pages are never duplicated in the output PDF
  const embeddedPagesCache = new Map<number, any>();
  async function getEmbeddedPage(pageIndex: number) {
    if (embeddedPagesCache.has(pageIndex)) {
      return embeddedPagesCache.get(pageIndex);
    }
    const [embedded] = await outPdf.embedPages([sourcePdf.getPage(pageIndex)]);
    embeddedPagesCache.set(pageIndex, embedded);
    return embedded;
  }

  // Helper to draw embedded page or blank placeholder
  async function drawSourcePageOrBlank(
    targetPage: any,
    pageIndex: number | null | undefined, // 0-based
    box: { x: number; y: number; width: number; height: number },
    label?: string
  ) {
    if (pageIndex !== null && pageIndex !== undefined && pageIndex >= 0 && pageIndex < originalPages) {
      const embedded = await getEmbeddedPage(pageIndex);
      const { width, height } = embedded;

      // Escala proporcional uniforme (Aspect Ratio mantido):
      // NUNCA força width e height independentes para não esticar ou distorcer a arte.
      const scale = Math.min(box.width / width, box.height / height);
      const drawW = width * scale;
      const drawH = height * scale;

      // Centralização exata da página no quadrante / célula:
      const offsetX = (box.width - drawW) / 2;
      const offsetY = (box.height - drawH) / 2;

      targetPage.drawPage(embedded, {
        x: box.x + offsetX,
        y: box.y + offsetY,
        width: drawW,
        height: drawH,
      });
    } else {
      // Blank page - draw subtle blank placeholder marker
      targetPage.drawRectangle({
        x: box.x + 8,
        y: box.y + 8,
        width: box.width - 16,
        height: box.height - 16,
        borderColor: rgb(0.92, 0.92, 0.94),
        borderWidth: 0.5,
        borderDashArray: [3, 3],
        color: rgb(0.99, 0.99, 1.0),
      });

      const blankText = '[Página em Branco]';
      const textWidth = font.widthOfTextAtSize(blankText, 8);
      targetPage.drawText(blankText, {
        x: box.x + (box.width - textWidth) / 2,
        y: box.y + box.height / 2 - 4,
        size: 8,
        font,
        color: rgb(0.75, 0.75, 0.78),
      });
    }

    if (config.addSignatureLabels && label) {
      targetPage.drawText(label, {
        x: box.x + 6,
        y: box.y + 6,
        size: 6,
        font,
        color: rgb(0.65, 0.65, 0.7),
      });
    }
  }

  // Draw guide marks (crop and fold lines)
  function drawGuides(targetPage: any, type: 'halves' | 'quadrants' | 'octants') {
    if (!config.addCropMarks && !config.addFoldGuides) return;

    const pageW = targetPage.getWidth();
    const pageH = targetPage.getHeight();
    const cutColor = rgb(0.7, 0.7, 0.72);
    const foldColor = rgb(0.78, 0.78, 0.82);

    if (type === 'halves') {
      // Booklet A5: center vertical fold
      if (config.addFoldGuides) {
        targetPage.drawLine({
          start: { x: pageW / 2, y: 0 },
          end: { x: pageW / 2, y: pageH },
          thickness: 0.5,
          color: foldColor,
          dashArray: [4, 4],
        });
      }
    } else if (type === 'quadrants') {
      // Pocketbook A6 or Cut & Stack
      // Horizontal cut line in exact center
      if (config.addCropMarks) {
        targetPage.drawLine({
          start: { x: 0, y: pageH / 2 },
          end: { x: pageW, y: pageH / 2 },
          thickness: 0.5,
          color: cutColor,
        });
      }
      // Vertical line: fold for A6, cut for Cut & Stack
      const isFold = config.preset === 'pocketbook-a6';
      if (isFold ? config.addFoldGuides : config.addCropMarks) {
        targetPage.drawLine({
          start: { x: pageW / 2, y: 0 },
          end: { x: pageW / 2, y: pageH },
          thickness: 0.5,
          color: isFold ? foldColor : cutColor,
          dashArray: isFold ? [4, 4] : undefined,
        });
      }
    } else if (type === 'octants') {
      // Mini Pocket A7:
      // Cuts: Horizontal center + Vertical center
      if (config.addCropMarks) {
        targetPage.drawLine({
          start: { x: 0, y: pageH / 2 },
          end: { x: pageW, y: pageH / 2 },
          thickness: 0.5,
          color: cutColor,
        });
        targetPage.drawLine({
          start: { x: pageW / 2, y: 0 },
          end: { x: pageW / 2, y: pageH },
          thickness: 0.5,
          color: cutColor,
        });
      }
      // Folds: Vertical at W/4 and 3W/4
      if (config.addFoldGuides) {
        targetPage.drawLine({
          start: { x: pageW / 4, y: 0 },
          end: { x: pageW / 4, y: pageH },
          thickness: 0.5,
          color: foldColor,
          dashArray: [3, 3],
        });
        targetPage.drawLine({
          start: { x: (3 * pageW) / 4, y: 0 },
          end: { x: (3 * pageW) / 4, y: pageH },
          thickness: 0.5,
          color: foldColor,
          dashArray: [3, 3],
        });
      }
    }
  }

  function addSlugHeader(targetPage: any, sigNum: number, sheetNum: number, side: 'Frente' | 'Verso') {
    if (!config.addSignatureLabels) return;
    const pageH = targetPage.getHeight();
    const sheetsInThisSig = stats.signatureSheets[sigNum - 1] || stats.sheetsPerSignature;
    const text = `CADERNO ${sigNum}/${stats.signaturesCount} | FOLHA ${sheetNum}/${sheetsInThisSig} (${side}) - Pocketbook Creator`;
    targetPage.drawText(text, {
      x: 14,
      y: pageH - 12,
      size: 6,
      font: fontBold,
      color: rgb(0.55, 0.55, 0.6),
    });
  }

  // =========================================================================
  // ESTATUTO DE CORREÇÃO CRÍTICO: IMPOSIÇÃO PARA COSTURA COPTA
  // 1. FATIAMENTO PRIMÁRIO (Slicing):
  //    Divide a array de páginas do PDF em sub-arrays (Cadernos) isolados.
  // 2. IMPOSIÇÃO ISOLADA POR CADERNO:
  //    Aplica o cálculo da matriz dentro de cada sub-array individualmente.
  //    A Página 1 do documento JAMAIS compartilha folha com outros cadernos!
  // 3. CONCATENAÇÃO FINAL:
  //    Gera as folhas A4 do Caderno 1, depois Caderno 2, etc., no outPdf final.
  // =========================================================================

  // 1. FATIAMENTO PRIMÁRIO
  const cadernos = sliceSignatures(originalPages, config);

  let completedSheets = 0;
  const totalSheetsToProcess = stats.totalA4Sheets;

  // 2. IMPOSIÇÃO ISOLADA POR CADERNO
  for (const caderno of cadernos) {
    const pagesInSig = caderno.pages; // Sub-array isolado deste caderno
    const N = caderno.pagesCapacity;  // Total de posições de páginas deste caderno
    const sheetsInSig = caderno.sheetsCount;

    if (config.preset === 'booklet-a5') {
      const halfW = A4_WIDTH / 2;

      for (let k = 0; k < sheetsInSig; k++) {
        // --- FRENTE ---
        const frontPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        normalizePage(frontPage, A4_WIDTH, A4_HEIGHT);
        addSlugHeader(frontPage, caderno.sigNumber, k + 1, 'Frente');
        drawGuides(frontPage, 'halves');

        await drawSourcePageOrBlank(frontPage, pagesInSig[N - 2 * k - 1], { x: 0, y: 0, width: halfW, height: A4_HEIGHT });
        await drawSourcePageOrBlank(frontPage, pagesInSig[2 * k], { x: halfW, y: 0, width: halfW, height: A4_HEIGHT });

        // --- VERSO ---
        const backPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        normalizePage(backPage, A4_WIDTH, A4_HEIGHT);
        addSlugHeader(backPage, caderno.sigNumber, k + 1, 'Verso');
        drawGuides(backPage, 'halves');

        await drawSourcePageOrBlank(backPage, pagesInSig[2 * k + 1], { x: 0, y: 0, width: halfW, height: A4_HEIGHT });
        await drawSourcePageOrBlank(backPage, pagesInSig[N - 2 * k - 2], { x: halfW, y: 0, width: halfW, height: A4_HEIGHT });

        completedSheets++;
        if (options?.onlyFirstSheet) {
          const previewBytes = await outPdf.save();
          return { pdfBytes: previewBytes, stats };
        }
        if (options?.onProgress) {
          options.onProgress({
            current: completedSheets,
            total: totalSheetsToProcess,
            percent: Math.min(100, Math.round((completedSheets / totalSheetsToProcess) * 100)),
          });
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      }
    } else if (config.preset === 'pocketbook-a6') {
      const M = 2 * sheetsInSig;
      // Estrutura A6 em A4 estritamente Retrato (Portrait: 210mm x 297mm)
      // Página 1 (Frente) e Página 2 (Verso) possuem EXATAMENTE as mesmas dimensões:
      const sheetW = A4_PORTRAIT_WIDTH; // 595.28 pt (210 mm)
      const sheetH = A4_PORTRAIT_HEIGHT; // 841.89 pt (297 mm)
      const qW = sheetW / 2; // 297.64 pt (105 mm)
      const qH = sheetH / 2; // 420.945 pt (148.5 mm)

      for (let k = 0; k < sheetsInSig; k++) {
        const topStrip = k;
        const bottomStrip = M - 1 - k;

        // --- PÁGINA FRENTE (A4 RETRATO: 210mm x 297mm) ---
        // Sistema de coordenadas virado para cima (0°), sem atributo /Rotate
        const frontPage = outPdf.addPage([sheetW, sheetH]);
        normalizePage(frontPage, sheetW, sheetH);
        addSlugHeader(frontPage, caderno.sigNumber, k + 1, 'Frente');
        drawGuides(frontPage, 'quadrants');

        // Frente Grid 2x2:
        // Topo: [ Esquerda (N - 2*topStrip - 1) | Direita (2*topStrip) ]
        // Base: [ Esquerda (N - 2*bottomStrip - 1) | Direita (2*bottomStrip) ]
        await drawSourcePageOrBlank(frontPage, pagesInSig[N - 2 * topStrip - 1], { x: 0, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(frontPage, pagesInSig[2 * topStrip], { x: qW, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(frontPage, pagesInSig[N - 2 * bottomStrip - 1], { x: 0, y: 0, width: qW, height: qH });
        await drawSourcePageOrBlank(frontPage, pagesInSig[2 * bottomStrip], { x: qW, y: 0, width: qW, height: qH });

        // --- PÁGINA VERSO (A4 RETRATO: 210mm x 297mm - DUPLEX MARGEM LONGA) ---
        // Na virada pela margem longa em folha Retrato (flip vertical), as colunas se espelham horizontalmente:
        // Coluna Esquerda vira Direita, Coluna Direita vira Esquerda.
        // O Topo permanece no Topo e a Base permanece na Base.
        // Coincidência física perfeita frente-e-verso:
        // - Atrás da Pág 1 (Frente Top-Right) fica a Pág 2 (Verso Top-Left)
        // - Atrás da Pág N (Frente Top-Left) fica a Pág N-1 (Verso Top-Right)
        // - Atrás da Pág 3 (Frente Bot-Right) fica a Pág 4 (Verso Bot-Left)
        // - Atrás da Pág N-2 (Frente Bot-Left) fica a Pág N-3 (Verso Bot-Right)
        const backPage = outPdf.addPage([sheetW, sheetH]);
        normalizePage(backPage, sheetW, sheetH);
        addSlugHeader(backPage, caderno.sigNumber, k + 1, 'Verso');
        drawGuides(backPage, 'quadrants');

        // Verso Grid 2x2:
        // Topo: [ Esquerda (2*topStrip + 1) | Direita (N - 2*topStrip - 2) ]
        // Base: [ Esquerda (2*bottomStrip + 1) | Direita (N - 2*bottomStrip - 2) ]
        await drawSourcePageOrBlank(backPage, pagesInSig[2 * topStrip + 1], { x: 0, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(backPage, pagesInSig[N - 2 * topStrip - 2], { x: qW, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(backPage, pagesInSig[2 * bottomStrip + 1], { x: 0, y: 0, width: qW, height: qH });
        await drawSourcePageOrBlank(backPage, pagesInSig[N - 2 * bottomStrip - 2], { x: qW, y: 0, width: qW, height: qH });

        completedSheets++;
        if (options?.onlyFirstSheet) {
          const previewBytes = await outPdf.save();
          return { pdfBytes: previewBytes, stats };
        }
        if (options?.onProgress) {
          options.onProgress({
            current: completedSheets,
            total: totalSheetsToProcess,
            percent: Math.min(100, Math.round((completedSheets / totalSheetsToProcess) * 100)),
          });
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      }
    } else if (config.preset === 'mini-pocket-a7') {
      for (let k = 0; k < sheetsInSig; k++) {
        await gerarImposicaoA7(caderno, k, outPdf, {
          addSlugHeader,
          drawGuides,
          drawSourcePageOrBlank,
          A4_WIDTH,
          A4_HEIGHT,
        });

        completedSheets++;
        if (options?.onlyFirstSheet) {
          const previewBytes = await outPdf.save();
          return { pdfBytes: previewBytes, stats };
        }
        if (options?.onProgress) {
          options.onProgress({
            current: completedSheets,
            total: totalSheetsToProcess,
            percent: Math.min(100, Math.round((completedSheets / totalSheetsToProcess) * 100)),
          });
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      }
    } else if (config.preset === 'cut-stack') {
      const S = sheetsInSig;
      const qW = A4_WIDTH / 2;
      const qH = A4_HEIGHT / 2;

      for (let k = 0; k < sheetsInSig; k++) {
        // --- FRENTE ---
        const frontPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        normalizePage(frontPage, A4_WIDTH, A4_HEIGHT);
        addSlugHeader(frontPage, caderno.sigNumber, k + 1, 'Frente');
        drawGuides(frontPage, 'quadrants');

        await drawSourcePageOrBlank(frontPage, pagesInSig[2 * k], { x: 0, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(frontPage, pagesInSig[2 * S + 2 * k], { x: qW, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(frontPage, pagesInSig[4 * S + 2 * k], { x: 0, y: 0, width: qW, height: qH });
        await drawSourcePageOrBlank(frontPage, pagesInSig[6 * S + 2 * k], { x: qW, y: 0, width: qW, height: qH });

        // --- VERSO ---
        const backPage = outPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        normalizePage(backPage, A4_WIDTH, A4_HEIGHT);
        addSlugHeader(backPage, caderno.sigNumber, k + 1, 'Verso');
        drawGuides(backPage, 'quadrants');

        await drawSourcePageOrBlank(backPage, pagesInSig[2 * S + 2 * k + 1], { x: 0, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(backPage, pagesInSig[2 * k + 1], { x: qW, y: qH, width: qW, height: qH });
        await drawSourcePageOrBlank(backPage, pagesInSig[6 * S + 2 * k + 1], { x: 0, y: 0, width: qW, height: qH });
        await drawSourcePageOrBlank(backPage, pagesInSig[4 * S + 2 * k + 1], { x: qW, y: 0, width: qW, height: qH });

        completedSheets++;
        if (options?.onlyFirstSheet) {
          const previewBytes = await outPdf.save();
          return { pdfBytes: previewBytes, stats };
        }
        if (options?.onProgress) {
          options.onProgress({
            current: completedSheets,
            total: totalSheetsToProcess,
            percent: Math.min(100, Math.round((completedSheets / totalSheetsToProcess) * 100)),
          });
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      }
    }
  }

  const pdfBytes = await outPdf.save();
  embeddedPagesCache.clear();
  return { pdfBytes, stats };
}

export interface StructuralSlot {
  row: number;
  col: number;
  pageIndex: number;
  pageNumber: number | null;
  isBlank: boolean;
  label: string;
  role: string;
  stripIndex?: number;
}

export interface StructuralSheetLayout {
  sigIndex: number;
  sigNumber: number;
  totalSignatures: number;
  sheetIndexInSig: number;
  sheetNumberInSig: number;
  sheetsInSig: number;
  globalSheetIndex: number;
  globalSheetNumber: number;
  totalA4Sheets: number;
  gridRows: number;
  gridCols: number;
  orientation: 'portrait' | 'landscape';
  sheetDimensions: { width: number; height: number };
  hasHorizontalCut: boolean;
  hasVerticalCut: boolean;
  hasVerticalFold: boolean;
  frontSlots: StructuralSlot[];
  backSlots: StructuralSlot[];
}

/**
 * Pure mathematical layout projector for ultra-lightweight zero-memory CSS/HTML previews.
 * Returns the exact page assignment for any Sheet (Frente e Verso) across any signature without loading or parsing PDFs!
 */
export function getStructuralSheetLayout(
  config: ImpositionConfig,
  stats: ImpositionStats,
  globalSheetIndex: number = 0
): StructuralSheetLayout {
  const originalPages = stats.originalPages;
  const cadernos = sliceSignatures(originalPages, config);
  const totalA4Sheets = Math.max(1, stats.totalA4Sheets);
  const clampedSheetIdx = Math.max(0, Math.min(globalSheetIndex, totalA4Sheets - 1));

  // Determine which Caderno contains clampedSheetIdx
  let targetCaderno = cadernos[0];
  let sheetIndexInSig = 0;
  let accumulatedSheets = 0;

  for (const cad of cadernos) {
    if (clampedSheetIdx < accumulatedSheets + cad.sheetsCount) {
      targetCaderno = cad;
      sheetIndexInSig = clampedSheetIdx - accumulatedSheets;
      break;
    }
    accumulatedSheets += cad.sheetsCount;
  }

  const pagesInSig = targetCaderno.pages;
  const N = targetCaderno.pagesCapacity;
  const sheetsInSig = targetCaderno.sheetsCount;
  const k = sheetIndexInSig;

  function createSlot(
    row: number,
    col: number,
    pageIdx: number | null,
    defaultRole: string,
    stripIndex?: number
  ): StructuralSlot {
    const isBlank = pageIdx === null || pageIdx >= originalPages;
    const pageNumber = isBlank || pageIdx === null ? null : pageIdx + 1;
    let role = defaultRole;
    if (isBlank) {
      role = 'Página em Branco';
    } else if (pageIdx === 0) {
      role = 'Capa (Início)';
    } else if (pageIdx === originalPages - 1) {
      role = 'Última Pág. do Livro';
    } else if (pageIdx === pagesInSig[0]) {
      role = `Início Caderno ${targetCaderno.sigNumber}`;
    } else if (pageIdx === pagesInSig[pagesInSig.length - 1]) {
      role = `Fim Caderno ${targetCaderno.sigNumber}`;
    }

    return {
      row,
      col,
      pageIndex: pageIdx ?? -1,
      pageNumber,
      isBlank,
      label: isBlank ? 'Em Branco' : `Pág. ${pageNumber}`,
      role,
      stripIndex,
    };
  }

  const frontSlots: StructuralSlot[] = [];
  const backSlots: StructuralSlot[] = [];
  let gridRows = 2;
  let gridCols = 2;
  let hasHorizontalCut = true;
  let hasVerticalCut = false;
  let hasVerticalFold = true;

  if (config.preset === 'booklet-a5') {
    gridRows = 1;
    gridCols = 2;
    hasHorizontalCut = false;
    hasVerticalCut = false;
    hasVerticalFold = true;

    frontSlots.push(createSlot(0, 0, pagesInSig[N - 2 * k - 1], k === 0 ? 'Fim Caderno' : 'Interna'));
    frontSlots.push(createSlot(0, 1, pagesInSig[2 * k], k === 0 ? 'Início Caderno' : 'Interna'));

    backSlots.push(createSlot(0, 0, pagesInSig[2 * k + 1], 'Interna (Verso)'));
    backSlots.push(createSlot(0, 1, pagesInSig[N - 2 * k - 2], 'Interna (Verso)'));
  } else if (config.preset === 'pocketbook-a6') {
    gridRows = 2;
    gridCols = 2;
    hasHorizontalCut = true;
    hasVerticalCut = false;
    hasVerticalFold = true;

    const M = 2 * sheetsInSig;
    const topStrip = k;
    const bottomStrip = M - 1 - k;

    // Front Top
    frontSlots.push(createSlot(0, 0, pagesInSig[N - 2 * topStrip - 1], `Tira Sup. (${topStrip + 1})`, topStrip));
    frontSlots.push(createSlot(0, 1, pagesInSig[2 * topStrip], `Tira Sup. (${topStrip + 1})`, topStrip));
    // Front Bottom
    frontSlots.push(createSlot(1, 0, pagesInSig[N - 2 * bottomStrip - 1], `Tira Inf. (${bottomStrip + 1})`, bottomStrip));
    frontSlots.push(createSlot(1, 1, pagesInSig[2 * bottomStrip], `Tira Inf. (${bottomStrip + 1})`, bottomStrip));

    // Back Top
    backSlots.push(createSlot(0, 0, pagesInSig[2 * topStrip + 1], `Tira Sup. Verso`, topStrip));
    backSlots.push(createSlot(0, 1, pagesInSig[N - 2 * topStrip - 2], `Tira Sup. Verso`, topStrip));
    // Back Bottom
    backSlots.push(createSlot(1, 0, pagesInSig[2 * bottomStrip + 1], `Tira Inf. Verso`, bottomStrip));
    backSlots.push(createSlot(1, 1, pagesInSig[N - 2 * bottomStrip - 2], `Tira Inf. Verso`, bottomStrip));
  } else if (config.preset === 'mini-pocket-a7') {
    gridRows = 2;
    gridCols = 4;
    hasHorizontalCut = true;
    hasVerticalCut = true;
    hasVerticalFold = true;

    const matrix = getA7ImpositionMatrix(pagesInSig, sheetsInSig, k);
    const { strip0, strip1, strip2, strip3 } = matrix.strips;

    // FRENTE A4 (Paisagem):
    // Linha Superior: [ Quadrante(N), Quadrante(1), Quadrante(N-2), Quadrante(3) ]
    frontSlots.push(createSlot(0, 0, matrix.front.top[0], 'Tira 1 (Ext)', strip0));
    frontSlots.push(createSlot(0, 1, matrix.front.top[1], 'Tira 1 (Int)', strip0));
    frontSlots.push(createSlot(0, 2, matrix.front.top[2], 'Tira 2 (Ext)', strip1));
    frontSlots.push(createSlot(0, 3, matrix.front.top[3], 'Tira 2 (Int)', strip1));

    // Linha Inferior: [ Quadrante(N-4), Quadrante(5), Quadrante(N-6), Quadrante(7) ]
    frontSlots.push(createSlot(1, 0, matrix.front.bottom[0], 'Tira 3 (Ext)', strip2));
    frontSlots.push(createSlot(1, 1, matrix.front.bottom[1], 'Tira 3 (Int)', strip2));
    frontSlots.push(createSlot(1, 2, matrix.front.bottom[2], 'Tira 4 (Ext)', strip3));
    frontSlots.push(createSlot(1, 3, matrix.front.bottom[3], 'Tira 4 (Int)', strip3));

    // VERSO A4 (Com espelhamento de colunas para coincidir na virada na Borda Curta):
    // Linha Superior: [ Quadrante(4), Quadrante(N-3), Quadrante(2), Quadrante(N-1) ]
    backSlots.push(createSlot(0, 0, matrix.back.top[0], 'Tira 2 Verso (Int)', strip1));
    backSlots.push(createSlot(0, 1, matrix.back.top[1], 'Tira 2 Verso (Ext)', strip1));
    backSlots.push(createSlot(0, 2, matrix.back.top[2], 'Tira 1 Verso (Int)', strip0));
    backSlots.push(createSlot(0, 3, matrix.back.top[3], 'Tira 1 Verso (Ext)', strip0));

    // Linha Inferior: [ Quadrante(8), Quadrante(N-7), Quadrante(6), Quadrante(N-5) ]
    backSlots.push(createSlot(1, 0, matrix.back.bottom[0], 'Tira 4 Verso (Int)', strip3));
    backSlots.push(createSlot(1, 1, matrix.back.bottom[1], 'Tira 4 Verso (Ext)', strip3));
    backSlots.push(createSlot(1, 2, matrix.back.bottom[2], 'Tira 3 Verso (Int)', strip2));
    backSlots.push(createSlot(1, 3, matrix.back.bottom[3], 'Tira 3 Verso (Ext)', strip2));
  } else if (config.preset === 'cut-stack') {
    gridRows = 2;
    gridCols = 2;
    hasHorizontalCut = true;
    hasVerticalCut = true;
    hasVerticalFold = false;

    const S = sheetsInSig;
    // Front
    frontSlots.push(createSlot(0, 0, pagesInSig[2 * k], 'Pilha 1'));
    frontSlots.push(createSlot(0, 1, pagesInSig[2 * S + 2 * k], 'Pilha 2'));
    frontSlots.push(createSlot(1, 0, pagesInSig[4 * S + 2 * k], 'Pilha 3'));
    frontSlots.push(createSlot(1, 1, pagesInSig[6 * S + 2 * k], 'Pilha 4'));
    // Back
    backSlots.push(createSlot(0, 0, pagesInSig[2 * S + 2 * k + 1], 'Pilha 2 Verso'));
    backSlots.push(createSlot(0, 1, pagesInSig[2 * k + 1], 'Pilha 1 Verso'));
    backSlots.push(createSlot(1, 0, pagesInSig[6 * S + 2 * k + 1], 'Pilha 4 Verso'));
    backSlots.push(createSlot(1, 1, pagesInSig[4 * S + 2 * k + 1], 'Pilha 3 Verso'));
  }

  return {
    sigIndex: targetCaderno.sigIndex,
    sigNumber: targetCaderno.sigNumber,
    totalSignatures: cadernos.length,
    sheetIndexInSig: k,
    sheetNumberInSig: k + 1,
    sheetsInSig: targetCaderno.sheetsCount,
    globalSheetIndex: clampedSheetIdx,
    globalSheetNumber: clampedSheetIdx + 1,
    totalA4Sheets,
    gridRows,
    gridCols,
    orientation: config.preset === 'pocketbook-a6' ? 'portrait' : 'landscape',
    sheetDimensions: config.preset === 'pocketbook-a6' 
      ? { width: A4_PORTRAIT_WIDTH, height: A4_PORTRAIT_HEIGHT }
      : { width: A4_LANDSCAPE_WIDTH, height: A4_LANDSCAPE_HEIGHT },
    hasHorizontalCut,
    hasVerticalCut,
    hasVerticalFold,
    frontSlots,
    backSlots,
  };
}

/**
 * Creates a sample sample PDF document for instant demo / test without requiring an upload.
 */
export async function createSamplePDF(pageCount: number = 16): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // A5 portrait pages: 419.53 x 595.28 pt
  const pageW = 419.53;
  const pageH = 595.28;

  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([pageW, pageH]);
    
    // Header bar
    page.drawRectangle({
      x: 20,
      y: pageH - 50,
      width: pageW - 40,
      height: 30,
      color: rgb(0.95, 0.95, 0.98),
    });

    page.drawText(`Pocketbook Sample Doc`, {
      x: 30,
      y: pageH - 38,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.7),
    });

    page.drawText(`Página ${i}`, {
      x: pageW - 80,
      y: pageH - 38,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.45),
    });

    // Big central page number
    const bigNum = `${i}`;
    const numSize = 56;
    const numWidth = fontBold.widthOfTextAtSize(bigNum, numSize);
    page.drawText(bigNum, {
      x: (pageW - numWidth) / 2,
      y: pageH / 2 - 10,
      size: numSize,
      font: fontBold,
      color: rgb(0.25, 0.25, 0.8),
    });

    // Content lines
    const title = i === 1 ? 'Capa / Início' : i === pageCount ? 'Contracapa / Fim' : `Capítulo ${i}`;
    const titleW = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, {
      x: (pageW - titleW) / 2,
      y: pageH / 2 + 60,
      size: 14,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.2),
    });

    const desc = `Esta é a página número ${i} deste livro de exemplo. Verifique a ordem das páginas após a impressão e dobra artesanal!`;
    page.drawText(desc, {
      x: 40,
      y: pageH / 2 - 60,
      size: 10,
      font,
      color: rgb(0.45, 0.45, 0.5),
      maxWidth: pageW - 80,
      lineHeight: 14,
    });

    // Footer
    page.drawLine({
      start: { x: 30, y: 35 },
      end: { x: pageW - 30, y: 35 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.9),
    });

    page.drawText(`- ${i} de ${pageCount} -`, {
      x: pageW / 2 - 20,
      y: 20,
      size: 9,
      font,
      color: rgb(0.6, 0.6, 0.65),
    });
  }

  const savedBytes = await doc.save();
  return new Uint8Array(savedBytes.buffer.slice(savedBytes.byteOffset, savedBytes.byteOffset + savedBytes.byteLength));
}
