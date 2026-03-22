import React, { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';
import { Package, Smartphone, ShieldCheck, Zap, Info, Share2, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBrandLogos } from '../hooks/useBrandLogos';
import { getDisplayGroupForBarcode } from '../utils/displayGroupKMG';
import { getLocalProducts } from '../lib/db';
import { getStoragePublicImageUrl } from '../lib/storageImageUrl';

export default function CustomerProductView() {
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [productSource, setProductSource] = useState(''); // cache | supabase
    const { getLogoUrl } = useBrandLogos();

    const debug =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1';

    // Parse barcode from URL query string
    const getBarcodeFromUrl = () => {
        if (typeof window === 'undefined') return null;
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('barcode');
    };

    useEffect(() => {
        const fetchProduct = async () => {
            const barcode = getBarcodeFromUrl();
            if (!barcode) {
                setError('Barcode not provided. Please scan a valid product QR code.');
                setLoading(false);
                return;
            }

            try {
                const cleanBarcode = String(barcode).trim();
                const digitsBarcode = cleanBarcode.replace(/[^\d]/g, '');
                const stripLeadingZeros = (s) => String(s || '').replace(/^0+/, '');
                const cleanNoZeros = stripLeadingZeros(cleanBarcode);
                const digitsNoZeros = stripLeadingZeros(digitsBarcode);

                // نستخدم نفس الأعمدة التي يعتمدها كرت المنتج في الصفحة الرئيسية (App.jsx)
                const selectCols = 'barcode, eng_name, brand_group, box_count, full_price, price_after_disc, stock_count, image_url, is_offer, visible, product_type';

                // 1) محاولة من الكاش المحلي أولاً (نفس البيانات التي تعرضها الصفحة الرئيسية)
                try {
                    const localItems = await getLocalProducts();
                    if (Array.isArray(localItems) && localItems.length > 0) {
                        const candidates = new Set();
                        candidates.add(cleanBarcode);
                        candidates.add(digitsBarcode);
                        candidates.add(cleanNoZeros);
                        candidates.add(digitsNoZeros);
                        const qNum = Number(digitsNoZeros);
                        if (Number.isFinite(qNum)) candidates.add(String(qNum));

                        // محرك المطابقة: App.jsx يستخدم id = String(row.barcode ?? '').trim()
                        // لذا نطابق على li.id أيضاً إن وُجد.
                        const localMatch = localItems.find((li) => {
                            const liBarcode = String(li?.barcode ?? '').trim();
                            const liId = String(li?.id ?? '').trim();

                            const liDigits = liBarcode.replace(/[^\d]/g, '');
                            const liNoZeros = stripLeadingZeros(liBarcode);
                            const liDigitsNoZeros = stripLeadingZeros(liDigits);

                            const liCandidates = new Set([
                                liBarcode,
                                liDigits,
                                liNoZeros,
                                liDigitsNoZeros,
                                liId,
                            ]);

                            for (const c of liCandidates) {
                                if (c && candidates.has(c)) return true;
                            }
                            return false;
                        });
                        if (localMatch) {
                            setProduct(localMatch);
                            setProductSource('cache');
                            return;
                        }
                    }
                } catch (cacheErr) {
                    // ignore cache errors and fallback to supabase
                    console.warn('Local cache lookup failed:', cacheErr);
                }

                // 2) إذا لم نجد في الكاش، نجلب من Supabase
                // بعض قواعد البيانات تخزن barcode كنص، وبعضها كرقم.
                // نحاول أولاً كنص، وإذا لم نجد نحاول كرقم.
                let res = await supabase
                    .from('items')
                    .select(selectCols)
                    .eq('barcode', cleanBarcode)
                    .maybeSingle();

                const trySupabaseEq = async (value) => {
                    return supabase
                        .from('items')
                        .select(selectCols)
                        .eq('barcode', value)
                        .maybeSingle();
                };

                if (!res.data && !res.error && digitsBarcode) {
                    // try string no-zeros
                    if (cleanNoZeros && cleanNoZeros !== cleanBarcode) {
                        const r2 = await trySupabaseEq(cleanNoZeros);
                        if (r2.data) res = r2;
                    }
                    // try digits no-zeros
                    if ((!res.data || res.error) && digitsNoZeros && digitsNoZeros !== digitsBarcode) {
                        const r3 = await trySupabaseEq(digitsNoZeros);
                        if (r3.data) res = r3;
                    }
                    // try numeric
                    if ((!res.data || res.error) && digitsNoZeros) {
                        const asNum = Number(digitsNoZeros);
                        if (Number.isFinite(asNum)) {
                            const r4 = await trySupabaseEq(asNum);
                            if (r4.data) res = r4;
                        }
                    }
                }

                if (res.error) throw res.error;
                if (!res.data) throw new Error('NOT_FOUND');

                setProduct(res.data);
                setProductSource('supabase');
            } catch (err) {
                console.warn('Error fetching product for customer view:', err);
                setError('Product not found or unavailable. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, []);

    // تحديث عنوان الصفحة عند توفر المنتج (يجب أن يكون الـ hook دائماً في نفس الترتيب)
    useEffect(() => {
        if (!product) return;
        const dg = getDisplayGroupForBarcode(product.barcode, product.brand_group);
        const title = product.eng_name || dg || product.barcode || 'Product';
        document.title = `${title} | Maslamani Sales`;
        return () => { document.title = 'Maslamani Sales'; };
    }, [product]);

    const parsePrice = (val) => {
        if (val === null || val === undefined || val === '') return null;
        // Regex الصحيح: أبقِ على الأرقام + '.' و '-' فقط
        const str = String(val).replace(/[^\d.-]/g, '');
        const num = Number(str);
        return isNaN(num) ? null : num;
    };

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6 font-sans">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="flex flex-col items-center">
                    <Package size={48} className="text-indigo-400 mb-4" />
                    <p className="text-slate-500 font-medium">جاري إحضار التفاصيل...</p>
                </motion.div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans" dir="rtl">
                <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mb-6">
                    <Info size={40} className="text-rose-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">عذراً</h2>
                <p className="text-slate-500">{error || 'لم نتمكن من العثور على هذا المنتج.'}</p>
                <button onClick={() => window.location.href = '/'} className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">
                    العودة للمتجر
                </button>
            </div>
        );
    }

    // منطق السعر مطابق تماماً لـ App.jsx (normalizeItemFromSupabase)
    const price = parsePrice(product.full_price) || 0;
    const disc = parsePrice(product.price_after_disc);
    const finalPrice = (disc !== null && !isNaN(disc) && disc !== 0) ? disc : price;
    const hasDiscount = finalPrice < price;
    const discountPercent = hasDiscount ? Math.round(((price - finalPrice) / price) * 100) : 0;
    const stockCount = Number(product.stock_count) || 0;
    const displayGroup = getDisplayGroupForBarcode(product.barcode, product.brand_group);
    const urlBarcode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('barcode') : '';
    const productImageUrl = getStoragePublicImageUrl(product.image_url, { size: 'medium' });

    return (
        <div className="min-h-[100dvh] bg-slate-50 font-sans selection:bg-indigo-100 pb-24" dir="rtl">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Package size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-800 leading-none">Maslamani<span className="font-light text-slate-500">Sales</span></h1>
                        <p className="text-xs font-extrabold text-slate-600 tracking-tight">Premium Appliances</p>
                    </div>
                </div>
                <button onClick={() => {
                    if (navigator.share) {
                        navigator.share({
                            title: product.eng_name || product.barcode,
                            url: window.location.href,
                        }).catch(console.error);
                    }
                }} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition">
                    <Share2 size={20} />
                </button>
            </header>

            <main className="max-w-md mx-auto w-full">
                {/* Product Image Section */}
                <section className="relative w-full aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center p-8 overflow-hidden pb-20 rounded-b-[2.5rem] shadow-sm shadow-slate-200/50">
                    {/* Subtle background decoration */}
                    <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full h-full flex items-center justify-center">
                        {productImageUrl ? (
                            <img src={productImageUrl} alt={product.eng_name || ''} loading="lazy" decoding="async" className="max-w-full max-h-full object-contain filter drop-shadow-2xl" />
                        ) : (
                            <Package size={100} className="text-slate-300" />
                        )}
                    </motion.div>

                    {/* Badges */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                        {hasDiscount && (
                            <div className="bg-rose-500 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg shadow-rose-500/30 flex items-center gap-1">
                                خصم {discountPercent}%
                            </div>
                        )}
                        {displayGroup && (
                            getLogoUrl(displayGroup) ? (
                                <div className="bg-white/95 shadow-sm border border-slate-100 rounded-lg py-1 px-2 flex items-center justify-center">
                                    <img src={getLogoUrl(displayGroup)} alt={displayGroup} loading="lazy" className="h-5 object-contain" />
                                </div>
                            ) : (
                                <div className="bg-white/90 backdrop-blur text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm border border-slate-200 uppercase tracking-wider">
                                    {displayGroup}
                                </div>
                            )
                        )}
                    </div>
                </section>

                {/* Product Info */}
                <section className="px-4 relative z-30 -mt-24">
                    <div className="bg-white/70 backdrop-blur-2xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[2.5rem] p-6 sm:p-8">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <p className="text-xs font-mono text-slate-400 mb-2">{product.barcode}</p>
                            <h2
                                className="text-base sm:text-lg font-black text-slate-800 leading-snug mb-2 break-words"
                                style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {product.eng_name || product.name || displayGroup || 'منتج غير معروف'}
                            </h2>
                            {product.product_type && (
                                <p className="text-sm font-bold text-indigo-500 mb-6 bg-indigo-50 inline-block px-3 py-1 rounded-lg">
                                    {product.product_type}
                                </p>
                            )}
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
                            <div className="flex items-end justify-between gap-6" dir="ltr">
                                {/* Final price (big) */}
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-1">PRICE</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-slate-800">₪</span>
                                        <span className="text-5xl font-black text-slate-900 tracking-tight">
                                            {Math.round(finalPrice)}
                                        </span>
                                    </div>
                                </div>

                                {/* Original price + discount percent */}
                                {hasDiscount && (
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-slate-400 mb-1">₪{Math.round(price)}</p>
                                        <p className="text-sm font-black text-emerald-600">
                                            -{discountPercent}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {debug && (
                          <div className="fixed bottom-0 left-0 right-0 z-[999999] bg-black/85 text-white p-4 border-t border-white/15">
                            <div className="max-w-5xl mx-auto">
                              <div className="font-black text-[18px] text-amber-200 mb-3">DEBUG (Product Lookup)</div>
                              <div className="text-[14px] font-mono leading-6 text-white/90 space-y-1">
                                <div>source: {String(productSource || 'unknown')}</div>
                                <div>urlBarcode: {String(urlBarcode || '')}</div>
                                <div>product.barcode: {String(product?.barcode || '')}</div>
                                <div>product.eng_name: {String(product?.eng_name || '')}</div>
                                <div>product.product_type: {String(product?.product_type || '')}</div>
                                <div>full_price(raw): {String(product?.full_price ?? '')} (type: {typeof product?.full_price})</div>
                                <div>price_after_disc(raw): {String(product?.price_after_disc ?? '')} (type: {typeof product?.price_after_disc})</div>
                                <div>computed price(base): {String(price)}</div>
                                <div>computed finalPrice: {String(finalPrice)}</div>
                                <div>hasDiscount: {String(hasDiscount)} | discountPercent: {String(discountPercent)}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Stock Warning (Urgency) */}
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
                            {stockCount > 0 && stockCount <= 5 ? (
                                <div className="bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-4 mb-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-400 to-rose-500 opacity-10 rounded-bl-full" />
                                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                        <Flame className="text-orange-500" size={20} fill="currentColor" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-orange-800 text-sm">أسرع بالشراء!</h4>
                                        <p className="text-xs text-orange-700/80 mt-1">
                                            متبقي <strong className="font-black text-orange-600">{stockCount}</strong> قطع فقط في المخزون.
                                        </p>
                                    </div>
                                </div>
                            ) : stockCount === 0 ? (
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-center mb-6">
                                    <p className="font-bold text-slate-500 text-sm">المنتج نفذ من المخزون حالياً</p>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                        <span className="text-emerald-600 font-bold text-lg">✓</span>
                                    </div>
                                    <p className="font-bold text-emerald-800 text-sm">متوفر في المخزون</p>
                                </div>
                            )}
                        </motion.div>

                        <div className="space-y-3 mt-8">
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <ShieldCheck className="text-indigo-500" size={24} />
                                <div className="flex-1">
                                    <p className="font-bold text-slate-800 text-sm">كفالة مسلماني</p>
                                    <p className="text-xs text-slate-500 mt-0.5">ضمان على جميع الأجهزة الإلكترونية</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <Zap className="text-amber-500" size={24} fill="currentColor" />
                                <div className="flex-1">
                                    <p className="font-bold text-slate-800 text-sm">جودة عالية</p>
                                    <p className="text-xs text-slate-500 mt-0.5">ماركات عالمية أصلية 100%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            {/* Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-40 transform translate-y-0 text-center">
                <p className="text-xs font-bold text-slate-500 flex items-center justify-center gap-1">
                    <Smartphone size={14} /> اطلب هذا المنتج متوجهك لأقرب موظف مبيعات
                </p>
            </div>
        </div>
    );
}
