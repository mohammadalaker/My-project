/**
 * قراءة باركود من ملف صورة: BarcodeDetector الأصلي ثم html5-qrcode (ZXing)
 * — Chrome على iPhone يستخدم WebKit ولا يوفّر BarcodeDetector.
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

function ensureHiddenScannerHost() {
  let el = document.getElementById(HTML5_SCANNER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = HTML5_SCANNER_ID;
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed',
      width: '0',
      height: '0',
      overflow: 'hidden',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(el);
  }
  return HTML5_SCANNER_ID;
}

/**
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function detectBarcodeFromImageFile(file) {
  if (!file || typeof window === 'undefined') return null;

  if (window.BarcodeDetector) {
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
      if (v) return v;
    } catch {
      /* انتقل للبديل */
    }
  }

  try {
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
  } catch (e) {
    console.warn('barcodeFromFile (html5-qrcode):', e);
    return null;
  }
}

/** يتوفر مسار أصلي سريع (Chromium حقيقي) */
export function hasNativeBarcodeDetector() {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}
