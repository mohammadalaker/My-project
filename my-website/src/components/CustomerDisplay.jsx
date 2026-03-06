import React, { useEffect, useState, useMemo } from 'react';
import supabase from '../lib/supabaseClient';
import { Package, CheckCircle2, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomerDisplay() {
    const [cartState, setCartState] = useState({
        items: [],
        total: 0,
        customerName: '',
        customerPoints: null,
    });
    const [offers, setOffers] = useState([]);
    const [currentOfferIndex, setCurrentOfferIndex] = useState(0);

    // Fetch custom offers for the slideshow
    useEffect(() => {
        const fetchOffers = async () => {
            try {
                const { data } = await supabase
                    .from('custom_offers')
                    .select('*')
                    .neq('id', 'SYSTEM_FORCE_LOGOUT')
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (data && data.length > 0) {
                    setOffers(data);
                }
            } catch (err) {
                console.warn('Error fetching offers for display:', err);
            }
        };
        fetchOffers();
    }, []);

    // Slideshow interval
    useEffect(() => {
        if (offers.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentOfferIndex((prev) => (prev + 1) % offers.length);
        }, 6000); // 6 seconds per slide
        return () => clearInterval(interval);
    }, [offers.length]);

    // Supabase Realtime Subscription
    useEffect(() => {
        console.log('Connecting to Customer Display Channel...');
        const channel = supabase.channel('pos-display');

        channel
            .on('broadcast', { event: 'cart_update' }, (payload) => {
                console.log('Received cart update:', payload);
                if (payload.payload) {
                    setCartState({
                        items: payload.payload.items || [],
                        total: payload.payload.total || 0,
                        customerName: payload.payload.customerName || '',
                        customerPoints: payload.payload.customerPoints || null,
                    });
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to pos-display channel');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const getPublicImageUrl = (img) => {
        if (!img) return null;
        if (img.startsWith('http')) return img;
        const path = img.startsWith('/') ? img.slice(1) : img;
        const { data } = supabase.storage.from('Pic_of_items').getPublicUrl(path);
        return data?.publicUrl || null;
    };

    const getImageFallback = (item) => {
        const primary = getPublicImageUrl(item?.image);
        if (primary) return primary;
        if (!item?.barcode) return null;
        const b = String(item.barcode).trim();
        if (!b) return null;
        const paths = [`electric/${b}.jpg`, `electric/${b}.jpeg`, `electric/${b}.png`, `${b}.jpg`, `${b}.jpeg`];
        for (const p of paths) {
            const url = getPublicImageUrl(p);
            if (url) return url;
        }
        return null;
    };

    const isCartEmpty = cartState.items.length === 0;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none -z-10" />

            {/* Header */}
            <header className="bg-white px-8 py-6 shadow-sm z-20 flex justify-between items-center border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <ShoppingBag className="text-white" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                            Maslamani<span className="font-light text-slate-500">Sales</span>
                        </h1>
                        <p className="text-sm font-extrabold text-slate-600 tracking-tight">Premium Appliances</p>
                        <p className="text-sm font-bold text-indigo-500 tracking-widest uppercase">
                            Welcome
                        </p>
                    </div>
                </div>

                {!isCartEmpty && cartState.customerName ? (
                    <div className="flex flex-col items-end">
                        <p className="text-slate-500 text-sm font-bold">مرحباً بك،</p>
                        <p className="text-2xl font-black text-slate-800">{cartState.customerName}</p>
                        {cartState.customerPoints && (
                            <span className="mt-1 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                                لديك {cartState.customerPoints} نقطة ولاء 🌟
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="text-right">
                        <h2 className="text-xl font-bold text-slate-400">Your Shopping Experience</h2>
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative flex">
                <AnimatePresence mode="wait">
                    {isCartEmpty ? (
                        // Idle State: Slideshow of Offers
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            className="flex-1 flex flex-col items-center justify-center p-12"
                        >
                            <div className="text-center mb-12">
                                <h2 className="text-4xl md:text-5xl font-black text-slate-800 mb-4 tracking-tight">
                                    اكتشف عروضنا الحصرية
                                </h2>
                                <p className="text-xl text-slate-500">جودة عالمية بأسعار مذهلة في كل قسم.</p>
                            </div>

                            {offers.length > 0 ? (
                                <div className="relative w-full max-w-5xl aspect-video bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentOfferIndex}
                                            initial={{ opacity: 0, x: 100 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -100 }}
                                            transition={{ duration: 0.8, ease: "easeInOut" }}
                                            className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-indigo-50/50 to-rose-50/50"
                                        >
                                            <h3 className="text-4xl font-black text-indigo-900 mb-8 border-b-4 border-indigo-200 pb-4 inline-block px-8 rounded">
                                                {offers[currentOfferIndex].title}
                                            </h3>
                                            <div className="flex flex-wrap justify-center gap-6 w-full">
                                                {offers[currentOfferIndex].items.slice(0, 4).map((item, idx) => (
                                                    <div key={idx} className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100 flex flex-col items-center max-w-[200px] w-full transform hover:scale-105 transition-transform">
                                                        <div className="w-24 h-24 mb-4 bg-slate-50 rounded-2xl flex items-center justify-center p-2 relative">
                                                            {getImageFallback(item) ? (
                                                                <>
                                                                    <img
                                                                        src={getImageFallback(item)}
                                                                        alt={`Product ${item.barcode}`}
                                                                        className="max-w-full max-h-full object-contain mix-blend-multiply transition-opacity duration-300 peer"
                                                                        onError={(e) => {
                                                                            e.target.style.display = 'none';
                                                                            if (e.target.nextElementSibling) {
                                                                                e.target.nextElementSibling.style.display = 'flex';
                                                                            }
                                                                        }}
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center hidden">
                                                                        <Package size={40} className="text-slate-300" />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <Package size={40} className="text-slate-300" />
                                                            )}
                                                        </div>
                                                        <p className="font-bold text-center text-slate-800 line-clamp-2 text-sm">
                                                            المنتج {item.barcode}
                                                        </p>
                                                        {item.isFree ? (
                                                            <p className="mt-2 text-emerald-600 font-black px-3 py-1 bg-emerald-50 rounded-full text-xs">مجاناً!</p>
                                                        ) : (
                                                            <p className="mt-2 font-black text-rose-600 text-lg">₪{item.offerPrice}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <div className="w-full max-w-4xl aspect-[21/9] bg-gradient-to-r from-slate-100 to-slate-200 rounded-[3rem] animate-pulse flex items-center justify-center">
                                    <Package size={80} className="text-slate-300" />
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        // Active Cart State
                        <motion.div
                            key="active-cart"
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -50 }}
                            transition={{ duration: 0.4 }}
                            className="flex-1 flex max-w-[1600px] mx-auto w-full p-8 gap-8"
                            dir="rtl"
                        >
                            {/* Left Side: Cart Items List */}
                            <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <h2 className="text-2xl font-black text-slate-800">مشترياتك ({cartState.items.length} أصناف)</h2>
                                    <div className="bg-emerald-100 text-emerald-700 font-bold px-4 py-2 rounded-xl flex items-center gap-2">
                                        <CheckCircle2 size={20} /> جاري التسجيل
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    <AnimatePresence initial={false}>
                                        {cartState.items.map((line) => {
                                            const discount = line.price > 0 && line.unit_price < line.price
                                                ? line.price - line.unit_price
                                                : 0;
                                            return (
                                                <motion.div
                                                    key={line.id}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center gap-6 shadow-sm"
                                                >
                                                    <div className="w-20 h-20 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 overflow-hidden shrink-0">
                                                        {getPublicImageUrl(line.image) ? (
                                                            <img src={getPublicImageUrl(line.image)} alt="" className="w-full h-full object-contain p-2" />
                                                        ) : (
                                                            <Package size={24} className="text-slate-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-xl font-bold text-slate-800 mb-1 truncate">{line.name}</h3>
                                                        <p className="text-sm text-slate-400 font-mono tracking-wider">{line.barcode}</p>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center bg-slate-50 px-6 py-3 rounded-xl min-w-[100px]">
                                                        <span className="text-xs font-bold text-slate-400 mb-1 line-through decoration-rose-400/50">
                                                            {discount > 0 ? `₪${line.price}` : ''}
                                                        </span>
                                                        <span className="text-2xl font-black text-slate-700">x{line.qty}</span>
                                                    </div>
                                                    <div className="text-left w-36">
                                                        <p className="text-3xl font-black text-indigo-600">₪{line.total}</p>
                                                        {discount > 0 && (
                                                            <p className="text-sm font-bold text-emerald-500 mt-1 flex items-center justify-end gap-1">
                                                                توفير ₪{discount * line.qty}
                                                            </p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Right Side: Total Summary */}
                            <div className="w-[450px] shrink-0 flex flex-col gap-6">
                                <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-500/40 relative overflow-hidden">
                                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

                                    <div className="relative z-10 flex flex-col h-full justify-center">
                                        <p className="text-indigo-200 text-lg font-bold mb-2 uppercase tracking-widest">إجمالي الحساب</p>
                                        <div className="flex items-baseline gap-2 mb-8">
                                            <span className="text-4xl font-bold opacity-80">₪</span>
                                            <span className="text-[5.5rem] font-black leading-none tracking-tighter">{cartState.total.toLocaleString()}</span>
                                        </div>

                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mt-auto">
                                            <div className="flex justify-between items-center text-sm font-bold text-indigo-100">
                                                <span>النقاط المكتسبة من هذه العملية:</span>
                                                <span className="text-xl text-amber-300">+{Math.floor(cartState.total / 100)} نقطة</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Savings summary */}
                                {cartState.items.some(l => l.price > 0 && l.unit_price < l.price) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] p-8 flex items-center justify-center text-center shadow-lg"
                                    >
                                        <div>
                                            <p className="text-emerald-800 font-black text-xl mb-2">لقد وفرت اليوم معنا!</p>
                                            <p className="text-4xl font-black text-emerald-500">
                                                ₪{cartState.items.reduce((acc, line) => {
                                                    const originalTotal = (line.price || line.unit_price) * line.qty;
                                                    const actualTotal = line.total;
                                                    return acc + (originalTotal - actualTotal);
                                                }, 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
