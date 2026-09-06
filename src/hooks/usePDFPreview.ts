
import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite handled worker import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export function usePDFPreview(pdfBuffer: ArrayBuffer | null) {
  const [numPages, setNumPages] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfBuffer) {
      setPreviews([]);
      setNumPages(0);
      return;
    }

    const loadPDF = async () => {
      setLoading(true);
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);

        const newPreviews: string[] = [];
        // Preview only first two pages (Front and Back of first sheet)
        // But for impositioned PDF, we want to see what we've generated.
        // For the raw upload, maybe just first few pages.
        const pagesToPreview = Math.min(pdf.numPages, 4);
        
        for (let i = 1; i <= pagesToPreview; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            newPreviews.push(canvas.toDataURL());
          }
        }
        setPreviews(newPreviews);
      } catch (err) {
        console.error('Error rendering PDF preview:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [pdfBuffer]);

  return { numPages, previews, loading };
}
