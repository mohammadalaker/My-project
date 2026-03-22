/**
 * قراءة باركود من ملف صورة — عدة مسارات للتوافق مع iOS / Chrome / صيغ مختلفة.
 * 1) BarcodeDetector (Chromium)
 * 2) @zxing/browser — صورة + مقاسات متعددة على Canvas
 * 3) createImageBitmap ثم Canvas إذا فشل تحميل Image
 * 4) html5-qrcode (ZXing داخلي)
 */

const NATIVE_FORMATS = [
  'ean_13',
  'ean_8',
  'code_128',
  'code_39',
  'code_93',
  'upc_a',
  'upc_e',
  'itf',
  'qr_code',
];

const HTML5_SCANNER_ID = 'html5-qrcode-file-scan';

/** أبعاد غير صفرية — بعض المتصفحات تعطي clientWidth=0 للعنصر 0×0 فيفشل scanFile */
function ensureHiddenScannerHost() {
  let el = document.getElementById(HTML5_SCANNER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = HTML5_SCANNER_ID;
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '320px',
      height: '320px',
      overflow: 'hidden',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    document.body.appendChild(el);
  }
  return HTML5_SCANNER_ID;
}

async function tryNativeBarcodeDetector(file) {
  if (!window.BarcodeDetector) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
    const results = await detector.detect(bitmap);
    try {
      bitmap.close?.();
    } catch {
      /* ignore */
    }
    const v = results?.[0]?.rawValue;
    return v ? String(v).trim() : null;
  } catch {
    return null;
  }
}

async function zxingDecodeCanvas(reader, canvas) {
  const result = await reader.decodeFromCanvas(canvas);
  const t = result?.getText?.();
  return t ? String(t).trim() : null;
}

/**
 * ZXing مباشرة: صورة + تكبير/تصغير على Canvas (باركود صغير أو ضبابي في الصورة)
 */
async function tryZxingFromFile(file) {
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();

  const url = URL.createObjectURL(file);
  /** @type {HTMLImageElement | null} */
  let img = null;
  /** @type {ImageBitmap | null} */
  let bitmap = null;

  try {
    try {
      img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.decoding = 'async';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('image-load'));
        el.src = url;
      });
    } catch {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        return null;
      }
    }

    const tryOnce = async (fn) => {
      try {
        return await fn();
      } catch {
        return null;
      }
    };

    if (img) {
      const fromImg = await tryOnce(() => reader.decodeFromImageElement(img));
      if (fromImg) return fromImg.getText().trim();

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w > 0 && h > 0) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const scales = [1, 2, 1.5, 3, 0.5, 0.75, 4];
          for (const s of scales) {
            canvas.width = Math.max(1, Math.floor(w * s));
            canvas.height = Math.max(1, Math.floor(h * s));
            ctx.imageSmoothingEnabled = s < 1;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const text = await tryOnce(() => zxingDecodeCanvas(reader, canvas));
            if (text) return text;
          }
        }
      }
    }

    if (bitmap) {
      const w = bitmap.width;
      const h = bitmap.height;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx && w > 0 && h > 0) {
        const scales = [1, 2, 1.5, 3, 0.5];
        try {
          for (const s of scales) {
            canvas.width = Math.max(1, Math.floor(w * s));
            canvas.height = Math.max(1, Math.floor(h * s));
            ctx.imageSmoothingEnabled = s < 1;
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const text = await tryOnce(() => zxingDecodeCanvas(reader, canvas));
            if (text) return text;
          }
        } finally {
          try {
            bitmap.close?.();
          } catch {
            /* ignore */
          }
        }
      }
    }

    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function tryHtml5ScanFile(file) {
  const { Html5Qrcode } = await import('html5-qrcode');
  const elementId = ensureHiddenScannerHost();
  const qr = new Html5Qrcode(elementId, { verbose: false });
  try {
    const text = await qr.scanFile(file, false);
    return text ? String(text).trim() : null;
  } finally {
    try {
      await qr.clear();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function detectBarcodeFromImageFile(file) {
  if (!file || typeof window === 'undefined') return null;

  const a = await tryNativeBarcodeDetector(file);
  if (a) return a;

  const b = await tryZxingFromFile(file);
  if (b) return b;

  try {
    return await tryHtml5ScanFile(file);
  } catch (e) {
    console.warn('barcodeFromFile (html5-qrcode):', e);
    return null;
  }
}

export function hasNativeBarcodeDetector() {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}
