import React from 'react';
import { motion } from 'framer-motion';
import { Package, Grid, Gift, ShoppingCart } from 'lucide-react';

export default function BottomNav({ mode, setMode, cartCount, cartTotal = 0, cartPing = false, onOpenCart, hasOffers, cartButtonRef }) {
    return (
        <div className="fixed bottom-0 left-0 right-0 glass-panel border-t-0 px-4 py-3 pb-safe z-50 flex items-center justify-around sm:hidden rounded-t-3xl backdrop-blur-xl">
            <button
                onClick={() => setMode('order')}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${mode === 'order' ? 'text-indigo-600 bg-indigo-50 -translate-y-1' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Package size={22} strokeWidth={mode === 'order' ? 2.5 : 2} className={mode === 'order' ? 'drop-shadow-sm' : ''} />
                <span className="text-[10px] font-bold">Sales</span>
            </button>

            <button
                onClick={() => setMode('offers')}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${mode === 'offers' ? 'text-amber-500 bg-amber-50 -translate-y-1' : hasOffers ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Gift size={22} strokeWidth={mode === 'offers' ? 2.5 : 2} className={mode === 'offers' ? 'drop-shadow-sm' : ''} />
                <span className="text-[10px] font-bold">Offers</span>
            </button>

            <div className="relative -top-6">
                <button
                    ref={cartButtonRef}
                    onClick={onOpenCart}
                    className="flex items-center gap-2 py-2.5 pl-3 pr-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/30 border-2 border-white/80 backdrop-blur-sm transition-transform active:scale-95"
                >
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <ShoppingCart size={18} strokeWidth={2.25} />
                    </div>
                    <div className="flex flex-col items-start gap-0">
                        <motion.span
                            className="text-[10px] font-bold text-white/90 leading-tight inline-block origin-left"
                            animate={cartPing ? { scale: [1, 1.5, 1] } : {}}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            {cartCount} {cartCount === 1 ? 'قطعة' : 'قطع'}
                        </motion.span>
                        <span className="text-sm font-black tracking-tight leading-tight" dir="ltr">
                            ₪{typeof cartTotal === 'number' ? cartTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
                        </span>
                    </div>
                </button>
            </div>

            <button
                onClick={() => setMode('catalog')}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${mode === 'catalog' ? 'text-rose-600 bg-rose-50 -translate-y-1' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Grid size={22} strokeWidth={mode === 'catalog' ? 2.5 : 2} className={mode === 'catalog' ? 'drop-shadow-sm' : ''} />
                <span className="text-[10px] font-bold">الكتالوج</span>
            </button>
        </div>
    );
}
