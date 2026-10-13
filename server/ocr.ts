/**
 * Real OCR for recipe images — tesseract.js running on the server.
 * First use downloads the English traineddata (~4MB); subsequent calls reuse a warm worker.
 * Keys: none required for OCR. If OCR is unavailable/fails, callers get a clear error —
 * we never fall back to pretending a canned result came from the photo.
 */
let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, { logger: () => {} });
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

export async function ocrImage(imageBase64: string): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  const buf = Buffer.from(imageBase64.replace(/^data:[^,]+,/, ''), 'base64');
  const { data } = await worker.recognize(buf);
  return { text: (data.text || '').trim(), confidence: data.confidence ?? 0 };
}

export function ocrAvailable(): boolean {
  return true; // tesseract.js is bundled; traineddata downloads on first use (needs network once)
}
