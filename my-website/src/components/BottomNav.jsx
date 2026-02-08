import React from 'react';
import { Package, Grid } from 'lucide-react';

export default function BottomNav({ mode, setMode, cartCount, onOpenCart }) {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 pb-safe z-50 flex items-center justify-around sm:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <button
                onClick={() => setMode('order')}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${mode === 'order' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Package size={24} strokeWidth={mode === 'order' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Sales</span>
            </button>

            <div className="relative -top-6">
                <button
                    onClick={onOpenCart}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/40 flex items-center justify-center border-4 border-slate-50 relative"
                >
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                        {cartCount}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
                </button>
            </div>

            <button
                onClick={() => setMode('catalog')}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${mode === 'catalog' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Grid size={24} strokeWidth={mode === 'catalog' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Catalog</span>
            </button>
        </div>
    );
}
