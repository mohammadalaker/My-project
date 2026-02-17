import React from 'react';
import { Package, Grid, Gift } from 'lucide-react';

export default function BottomNav({ mode, setMode, cartCount, onOpenCart, hasOffers }) {
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

            <div className="relative -top-8">
                <button
                    onClick={onOpenCart}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center border-4 border-white/80 backdrop-blur-sm relative transition-transform active:scale-95"
                >
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 rounded-full text-xs font-bold flex items-center justify-center border-2 border-white shadow-sm">
                        {cartCount}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
                </button>
            </div>

            <button
                onClick={() => setMode('catalog')}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${mode === 'catalog' ? 'text-rose-600 bg-rose-50 -translate-y-1' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Grid size={22} strokeWidth={mode === 'catalog' ? 2.5 : 2} className={mode === 'catalog' ? 'drop-shadow-sm' : ''} />
                <span className="text-[10px] font-bold">Catalog</span>
            </button>
        </div>
    );
}
