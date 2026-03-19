import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Image as ImageIcon, ArrowLeft, Barcode } from 'lucide-react';

function toEnglishDigits(input) {
  return String(input || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function openProduct(barcode) {
  const clean = String(barcode || '').trim();
  if (!clean) return;
  window.location.href = `/?barcode=${encodeURIComponent(clean)}`;
}

async function detectBarcodeFromFile(file) {
  if (!file) return null;
  if (typeof window === 'undefined') return null;

  // BarcodeDetector is supported in Chromium-based browsers.
  const BarcodeDetector = window.BarcodeDetector;
  if (!BarcodeDetector) return null;

  const bitmap = await createImageBitmap(file);
  const detector = new BarcodeDetector({
    formats: [
      'ean_13',
      'ean_8',
      'code_128',
      'code_39',
      'code_93',
      'upc_a',
      'upc_e',
      'itf',
      'qr_code',
    ],
  });

  const results = await detector.detect(bitmap);
  return results?.[0]?.rawValue || null;
}

export default function ProductLookup() {
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const inputRef = useRef(null);

  const qNorm = useMemo(() => toEnglishDigits(query).trim(), [query]);

  useEffect(() => {
    // Autofocus for barcode scanners
    inputRef.current?.focus?.();
  }, []);

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
              <p className="text-[11px] text-slate-500">أدخل الباركود يدوياً أو اقرأ باركود من صورة</p>
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
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openProduct(qNorm);
                }}
                placeholder="أدخل الباركود (مثال: 729...) ثم Enter"
                className="w-full pr-11 pl-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-sm bg-slate-50/50"
                dir="ltr"
              />
            </div>

            <div className="flex gap-2">
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
                      const code = await detectBarcodeFromFile(file);
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

          <p className="mt-3 text-[11px] text-slate-500">
            يمكنك أيضاً استخدام جهاز سحب الباركود (Scanner) وسيُكتب الباركود تلقائياً داخل الحقل ثم اضغط Enter.
          </p>

          {!window.BarcodeDetector && (
            <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2">
              ملاحظة: قراءة الباركود من صورة قد لا تعمل على هذا المتصفح. يمكنك دائماً إدخال الباركود يدوياً.
            </p>
          )}

          {error && (
            <p className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-200/60 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

