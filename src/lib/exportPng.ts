import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite handled worker import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import JSZip from 'jszip';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface RenderedSheetPng {
  sheetNumber: number;
  side: 'frente' | 'verso';
  fileName: string;
  dataUrl: string;
}

export interface PngExportProgress {
  current: number;
  total: number;
  percent: number;
  statusText: string;
}

/**
 * Renderiza todas as páginas do PDF imposto para imagens PNG em 300 DPI:
 * - A4 Retrato: 2480 x 3508 pixels (para A6 e folhas em orientação vertical)
 * - A4 Paisagem: 3508 x 2480 pixels (para A5, A7 e folhas em orientação horizontal)
 * Ideal para impressão sem margem física na impressora.
 */
export async function renderImposedPdfToPngs(
  pdfBytes: Uint8Array,
  onProgress?: (progress: PngExportProgress) => void
): Promise<RenderedSheetPng[]> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  // Reusable canvas to prevent memory leaks on high-resolution rendering
  const canvas = document.createElement('canvas');
  canvas.width = 3508;
  canvas.height = 2480;
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) {
    throw new Error('Não foi possível inicializar o contexto gráfico 2D para renderização em 300 DPI.');
  }

  const results: RenderedSheetPng[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const sheetNumber = Math.floor((pageNum - 1) / 2) + 1;
    const side: 'frente' | 'verso' = pageNum % 2 === 1 ? 'frente' : 'verso';
    const sideLabel = side === 'frente' ? 'Frente' : 'Verso';
    const fileName = `folha${sheetNumber}_${side}.png`;

    if (onProgress) {
      const pct = Math.round(((pageNum - 1) / totalPages) * 100);
      onProgress({
        current: pageNum,
        total: totalPages,
        percent: pct,
        statusText: `Renderizando Folha ${sheetNumber} (${sideLabel}) em 300 DPI...`,
      });
      await new Promise((r) => setTimeout(r, 4));
    }

    const page = await pdfDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // Detecta orientação nativa da folha gerada no PDF (Retrato ou Paisagem)
    const isPortrait = unscaledViewport.height > unscaledViewport.width;
    const targetWidth = isPortrait ? 2480 : 3508;
    const targetHeight = isPortrait ? 3508 : 2480;

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    // Fundo branco sólido para impressão sem margem
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    await page.render({
      canvasContext: ctx,
      viewport,
      intent: 'print',
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');

    results.push({
      sheetNumber,
      side,
      fileName,
      dataUrl,
    });
  }

  if (onProgress) {
    onProgress({
      current: totalPages,
      total: totalPages,
      percent: 100,
      statusText: 'Renderização das folhas em 300 DPI concluída!',
    });
  }

  return results;
}

/**
 * Dispara o download no navegador para um link ou dataUrl
 */
export function triggerFileDownload(urlOrDataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = urlOrDataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    if (urlOrDataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(urlOrDataUrl);
    }
  }, 1200);
}

/**
 * Baixa as imagens individualmente com pequeno espaçamento de tempo entre downloads
 */
export async function downloadPngsIndividually(images: RenderedSheetPng[]): Promise<void> {
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    triggerFileDownload(item.dataUrl, item.fileName);
    if (i < images.length - 1) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/**
 * Empacota todas as imagens PNG em um arquivo ZIP e dispara o download
 */
export async function downloadPngsAsZip(
  images: RenderedSheetPng[],
  baseZipName: string,
  onZipProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();

  for (const item of images) {
    const base64Data = item.dataUrl.split(',')[1];
    zip.file(item.fileName, base64Data, { base64: true });
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onZipProgress) {
        onZipProgress(Math.round(metadata.percent));
      }
    }
  );

  const zipUrl = URL.createObjectURL(zipBlob);
  triggerFileDownload(zipUrl, `${baseZipName}-folhas-png-300dpi.zip`);
}
