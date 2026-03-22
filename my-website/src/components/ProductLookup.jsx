import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Image as ImageIcon, ArrowLeft, Barcode, ScanLine, Usb, Bluetooth, Camera } from 'lucide-react';
import {
  supportsWebSerial,
  supportsWebBluetooth,
  connectWebSerialScanner,
  connectWebBluetoothUartScanner,
} from '../lib/webBarcodeBridge';
import { detectBarcodeFromImageFile, hasNativeBarcodeDetector } from '../lib/barcodeFromFile';

function toEnglishDigits(input) {
  return String(input || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function openProduct(barcode) {
  const clean = String(barcode || '').trim();
  if (!clean) return;
  window.location.href = `/?barcode=${encodeURIComponent(clean)}`;
}

/** فجوة قصيرة بين الأحرف = غالباً قارئ باركود (HID / تطبيق يحاكي لوحة مفاتيح) */
const SCAN_MAX_GAP_MS = 95;
/** بعد توقف الإدخال هذا الوقت نعتبر المسح انتهى */
const SCAN_END_DEBOUNCE_MS = 85;
/** أقل طول نعتبره باركوداً تلقائياً بعد مسح سريع */
const MIN_SCAN_LENGTH = 4;

const BARCODE_DETECTOR_FORMATS = [
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

const HTML5_CAMERA_HOST_ID = 'product-lookup-html5-camera';

export default function ProductLookup() {
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const inputRef = useRef(null);
  const keyTimesRef = useRef([]);
  const scanDebounceRef = useRef(null);
  const openedRef = useRef(false);
  const prevQueryLenRef = useRef(0);
  const bridgeDisconnectRef = useRef(null);

  const [bridgeCaps, setBridgeCaps] = useState({ serial: false, bluetooth: false });
  const [bridgeKind, setBridgeKind] = useState(null);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [serialBaud, setSerialBaud] = useState(9600);

  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraRafRef = useRef(null);
  const cameraCancelledRef = useRef(false);
  const html5CameraInstanceRef = useRef(null);

  const nativeBarcodeCamera = useMemo(() => hasNativeBarcodeDetector(), []);

  const qNorm = useMemo(() => toEnglishDigits(query).trim(), [query]);

  const stopCameraScan = useCallback(() => {
    cameraCancelledRef.current = true;
    if (cameraRafRef.current != null) {
      cancelAnimationFrame(cameraRafRef.current);
      cameraRafRef.current = null;
    }
    const s = cameraStreamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    const h5 = html5CameraInstanceRef.current;
    if (h5) {
      html5CameraInstanceRef.current = null;
      h5.stop().catch(() => {});
    }
    setCameraOpen(false);
  }, []);

  const handleOpenCamera = useCallback(() => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('الكاميرا غير متاحة من هذا المتصفح.');
      return;
    }
    setCameraOpen(true);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !nativeBarcodeCamera) return;

    cameraCancelledRef.current = false;

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cameraCancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        video.playsInline = true;
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.srcObject = stream;
        await video.play();
      } catch (e) {
        setError(e?.message || 'لم يُمنح إذن استخدام الكاميرا.');
        setCameraOpen(false);
        return;
      }

      const detector = new window.BarcodeDetector({ formats: BARCODE_DETECTOR_FORMATS });
      let lastDetect = 0;

      const tick = () => {
        if (cameraCancelledRef.current) return;
        cameraRafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - lastDetect < 90) return;
        lastDetect = now;
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;

        detector
          .detect(v)
          .then((results) => {
            const code = results?.[0]?.rawValue;
            if (!code || cameraCancelledRef.current) return;
            openedRef.current = true;
            stopCameraScan();
            openProduct(toEnglishDigits(code).trim() || code);
          })
          .catch(() => {
            /* إطار غير جاهز أحياناً */
          });
      };

      cameraRafRef.current = requestAnimationFrame(tick);
    };

    const bootTimer = window.setTimeout(() => start(), 0);

    return () => {
      clearTimeout(bootTimer);
      cameraCancelledRef.current = true;
      if (cameraRafRef.current != null) {
        cancelAnimationFrame(cameraRafRef.current);
        cameraRafRef.current = null;
      }
      const s = cameraStreamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen, nativeBarcodeCamera, stopCameraScan]);

  /** كاميرا عبر html5-qrcode (ZXing) — Chrome على iPhone، Safari، إلخ */
  useEffect(() => {
    if (!cameraOpen || nativeBarcodeCamera) return;

    let cancelled = false;

    const run = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        await new Promise((r) => requestAnimationFrame(r));
        if (cancelled) return;

        const qr = new Html5Qrcode(HTML5_CAMERA_HOST_ID, { verbose: false });
        html5CameraInstanceRef.current = qr;

        await qr.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 280, height: 180 } },
          (decodedText) => {
            if (cancelled || !decodedText) return;
            openedRef.current = true;
            const code = String(decodedText).trim();
            qr.stop()
              .catch(() => {})
              .finally(() => {
                html5CameraInstanceRef.current = null;
                stopCameraScan();
                openProduct(toEnglishDigits(code).trim() || code);
              });
          },
          () => {}
        );
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'تعذّر تشغيل الكاميرا لمسح الباركود.');
          setCameraOpen(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      const q = html5CameraInstanceRef.current;
      html5CameraInstanceRef.current = null;
      if (q) q.stop().catch(() => {});
    };
  }, [cameraOpen, nativeBarcodeCamera, stopCameraScan]);

  const focusScanField = useCallback(() => {
    inputRef.current?.focus?.({ preventScroll: false });
  }, []);

  useEffect(() => {
    focusScanField();
    try {
      inputRef.current?.select?.();
    } catch {
      /* ignore */
    }
  }, [focusScanField]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') focusScanField();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [focusScanField]);

  useEffect(() => {
    setBridgeCaps({
      serial: supportsWebSerial(),
      bluetooth: supportsWebBluetooth(),
    });
  }, []);

  const disconnectBridge = useCallback(async () => {
    const fn = bridgeDisconnectRef.current;
    bridgeDisconnectRef.current = null;
    if (typeof fn === 'function') {
      try {
        await fn();
      } catch {
        /* ignore */
      }
    }
    setBridgeKind(null);
  }, []);

  useEffect(() => {
    return () => {
      if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
      const fn = bridgeDisconnectRef.current;
      bridgeDisconnectRef.current = null;
      if (typeof fn === 'function') {
        fn();
      }
    };
  }, []);

  const onBarcodeFromBridge = useCallback((code) => {
    const c = String(code || '').trim();
    if (!c || openedRef.current) return;
    openedRef.current = true;
    openProduct(toEnglishDigits(c).trim() || c);
  }, []);

  const handleConnectSerial = async () => {
    if (bridgeBusy) return;
    setError(null);
    setBridgeBusy(true);
    try {
      await disconnectBridge();
      const { disconnect } = await connectWebSerialScanner({
        baudRate: serialBaud,
        onBarcode: onBarcodeFromBridge,
        onError: (e) => setError(e?.message || String(e)),
      });
      bridgeDisconnectRef.current = disconnect;
      setBridgeKind('serial');
    } catch (e) {
      if (e?.name !== 'NotFoundError' && e?.name !== 'AbortError') {
        setError(e?.message || 'تعذّر الربط عبر USB (Serial).');
      }
    } finally {
      setBridgeBusy(false);
    }
  };

  const handleConnectBluetooth = async () => {
    if (bridgeBusy) return;
    setError(null);
    setBridgeBusy(true);
    try {
      await disconnectBridge();
      const { disconnect } = await connectWebBluetoothUartScanner({
        onBarcode: onBarcodeFromBridge,
        onError: (e) => setError(e?.message || String(e)),
      });
      bridgeDisconnectRef.current = disconnect;
      setBridgeKind('bluetooth');
    } catch (e) {
      if (e?.name !== 'NotFoundError' && e?.name !== 'AbortError') {
        setError(e?.message || 'تعذّر الربط عبر Bluetooth (UART).');
      }
    } finally {
      setBridgeBusy(false);
    }
  };

  useEffect(() => {
    const raw = String(query || '').trim();
    if (raw.length < MIN_SCAN_LENGTH) return;

    if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
    scanDebounceRef.current = setTimeout(() => {
      scanDebounceRef.current = null;
      const times = keyTimesRef.current;
      if (times.length < raw.length || openedRef.current) return;

      const recent = times.slice(-raw.length);
      if (recent.length < MIN_SCAN_LENGTH) return;

      let maxGap = 0;
      for (let i = 1; i < recent.length; i++) {
        maxGap = Math.max(maxGap, recent[i] - recent[i - 1]);
      }

      if (maxGap <= SCAN_MAX_GAP_MS) {
        openedRef.current = true;
        openProduct(toEnglishDigits(raw).trim() || raw);
      }
    }, SCAN_END_DEBOUNCE_MS);

    return () => {
      if (scanDebounceRef.current) {
        clearTimeout(scanDebounceRef.current);
        scanDebounceRef.current = null;
      }
    };
  }, [query]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans selection:bg-indigo-100" dir="rtl">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            title="العودة"
          >
            <ArrowLeft size={18} className="rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <Search size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 leading-tight">بحث عن منتج</p>
              <p className="text-[11px] text-slate-500 leading-snug">
                كاميرا مباشرة، أو صورة، أو يدوياً، أو قارئ USB/بلوتوث
              </p>
            </div>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1 relative">
              <Barcode size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="search"
                aria-label="حقل الباركود لقارئ HID أو الإدخال اليدوي"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.length < prevQueryLenRef.current) {
                    keyTimesRef.current = [];
                    openedRef.current = false;
                  }
                  prevQueryLenRef.current = v.length;
                  setQuery(v);
                  if (!v.trim()) {
                    keyTimesRef.current = [];
                    openedRef.current = false;
                  }
                }}
                onPaste={() => {
                  keyTimesRef.current = [];
                  openedRef.current = false;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    openedRef.current = true;
                    const raw = String(e.currentTarget?.value ?? '').trim();
                    openProduct(toEnglishDigits(raw).trim() || raw);
                    return;
                  }
                  if (e.key === 'Backspace' || e.key === 'Delete') {
                    keyTimesRef.current = [];
                    return;
                  }
                  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    keyTimesRef.current.push(Date.now());
                    if (keyTimesRef.current.length > 96) keyTimesRef.current.shift();
                  }
                }}
                placeholder="امسح الباركود هنا (USB/بلوتوث) أو اكتب ثم Enter"
                className="w-full pr-11 pl-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-sm bg-slate-50/50"
                dir="ltr"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={focusScanField}
                className="px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-sm font-bold transition-colors flex items-center gap-2"
                title="ركّز الحقل لاستقبال قارئ الباركود"
              >
                <ScanLine size={18} />
                جاهز للمسح
              </button>
              <button
                type="button"
                onClick={handleOpenCamera}
                className="px-4 py-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-sm font-bold transition-colors flex items-center gap-2"
                title="يطلب المتصفح إذن الكاميرا لمسح الباركود مباشرة"
              >
                <Camera size={18} />
                مسح بالكاميرا
              </button>
              <label className={`px-4 py-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors flex items-center gap-2 ${fileBusy ? 'opacity-60 pointer-events-none' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>
                <ImageIcon size={18} />
                قارئ باركود (صورة)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFileBusy(true);
                    setError(null);
                    try {
                      const code = await detectBarcodeFromImageFile(file);
                      if (!code) {
                        setError('لم نستطع قراءة الباركود من الصورة. جرّب صورة أوضح أو أدخل الباركود يدوياً.');
                        return;
                      }
                      openProduct(code);
                    } catch (err) {
                      console.error(err);
                      setError('حدث خطأ أثناء قراءة الصورة.');
                    } finally {
                      setFileBusy(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => openProduct(qNorm)}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
              >
                فتح
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
            <p>
              <span className="font-bold text-slate-700">قارئ باركود حقيقي:</span> يعمل كلوحة مفاتيح (HID). اضغط «جاهز للمسح»
              أو انقر داخل الحقل ثم امسح — يُفتح المنتج تلقائياً بعد المسح السريع، أو اضغط Enter إن لزم.
            </p>
            <p className="text-slate-500">
              على الهاتف/التابلت: صِل قارئ بلوتوث أو استخدم تطبيقاً يمرّر الأرقام كإدخال لوحة مفاتيح إلى المتصفح (نفس السلوك).
            </p>
            <p className="text-slate-500 border-t border-slate-100 pt-2 mt-2">
              <span className="font-semibold text-slate-600">لماذا لا يفتح التطبيق المثبّت لقراءة الباركود؟</span> لأسباب أمنية،
              مواقع الويب لا تستطيع استدعاء تطبيقات أخرى على الجهاز (مثل قارئ الباركود من المتجر). المتصفح يسمح فقط بطلب إذن
              محدد مثل إذن «الكاميرا» — لذلك أضفنا «مسح بالكاميرا» داخل الصفحة نفسها.
            </p>
          </div>

          {error && (
            <p className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-200/60 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {(bridgeCaps.serial || bridgeCaps.bluetooth) && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <p className="text-[11px] font-bold text-slate-700">ربط مباشر (متصفح Chrome / Edge)</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                للقارئات التي تُرسل نصاً عبر منفذ تسلسلي (USB-Serial) أو Bluetooth UART — وليس وضع لوحة المفاتيح HID.
                اختر الجهاز من القائمة بعد الضغط. لا يدعم Safari على iPhone/iPad.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {bridgeCaps.serial && (
                  <>
                    <select
                      value={serialBaud}
                      onChange={(e) => setSerialBaud(Number(e.target.value))}
                      disabled={!!bridgeKind || bridgeBusy}
                      className="text-sm rounded-lg border border-slate-200 px-2 py-2 bg-white text-slate-800"
                      title="سرعة المنفذ (راجع دليل القارئ)"
                    >
                      <option value={9600}>9600 baud</option>
                      <option value={57600}>57600 baud</option>
                      <option value={115200}>115200 baud</option>
                      <option value={38400}>38400 baud</option>
                    </select>
                    <button
                      type="button"
                      disabled={bridgeBusy}
                      onClick={handleConnectSerial}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-800 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Usb size={18} />
                      {bridgeKind === 'serial' ? 'إعادة اختيار USB' : 'ربط USB (Serial)'}
                    </button>
                  </>
                )}
                {bridgeCaps.bluetooth && (
                  <button
                    type="button"
                    disabled={bridgeBusy}
                    onClick={handleConnectBluetooth}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-800 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Bluetooth size={18} />
                    {bridgeKind === 'bluetooth' ? 'إعادة اختيار بلوتوث' : 'ربط Bluetooth (UART)'}
                  </button>
                )}
                {bridgeKind && (
                  <button
                    type="button"
                    disabled={bridgeBusy}
                    onClick={() => disconnectBridge()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold"
                  >
                    قطع الربط
                  </button>
                )}
              </div>
              {bridgeKind && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-lg px-3 py-2">
                  {bridgeKind === 'serial' ? 'متصل عبر USB Serial — امسح الباركود.' : 'متصل عبر Bluetooth UART — امسح الباركود.'}
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {cameraOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="مسح الباركود بالكاميرا"
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl space-y-3" dir="rtl">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-800">مسح الباركود بالكاميرا</p>
                <button
                  type="button"
                  onClick={stopCameraScan}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
              {nativeBarcodeCamera ? (
                <video
                  ref={videoRef}
                  className="w-full aspect-[4/3] rounded-xl bg-black object-cover"
                  playsInline
                  muted
                />
              ) : (
                <div
                  id={HTML5_CAMERA_HOST_ID}
                  className="w-full aspect-[4/3] rounded-xl bg-black min-h-[200px] overflow-hidden"
                />
              )}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                سيُطلب منك السماح للمتصفح باستخدام الكاميرا. وجّه الكاميرا نحو الباركود حتى يُقرأ تلقائياً.
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

