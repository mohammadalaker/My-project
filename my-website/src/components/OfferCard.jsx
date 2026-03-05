import { ShoppingCart, Gift, Sparkles, Trash2, FileText, Zap, Star, Flame } from 'lucide-react';

export default function OfferCard({
    offer,
    getItemByBarcode,
    getImage,
    getImageFallback,
    getStockStatus,
    userRole,
    onEdit,
    onDelete,
    addOfferToOrder,
    onItemClick
}) {
    const totalPrice = offer.items.reduce((sum, e) => {
        const it = getItemByBarcode(e.barcode);
        return sum + (it ? (e.isFree ? 0 : e.offerPrice * e.quantity) : 0);
    }, 0);

    const totalOriginalPrice = offer.items.reduce((sum, e) => {
        const it = getItemByBarcode(e.barcode);
        return sum + ((it?.price ?? 0) * e.quantity);
    }, 0);

    const freeItems = offer.items.filter((e) => e.isFree);
    const paidItems = offer.items.filter((e) => !e.isFree);

    const savings = totalOriginalPrice - totalPrice;
    const savingsPercent = totalOriginalPrice > 0 ? Math.round((savings / totalOriginalPrice) * 100) : 0;

    return (
        <div className="w-full max-w-6xl mx-auto my-12 group">
            {/* 
        CONCEPT: The Split Magazine 
        Asymmetric Layout: 
        - Left (35%): Action / Price / Identity (Dark & Bold)
        - Right (65%): Content / Products (Light & Clean)
      */}
            <div className="flex flex-col lg:flex-row shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] rounded-[3rem] overflow-hidden bg-white min-h-[500px] transition-transform duration-500 hover:-translate-y-2">

                {/* LEFT PANEL: Identity & Action (The "Spine") */}
                <div className="lg:w-[35%] bg-slate-900 relative p-8 lg:p-12 text-white flex flex-col justify-between overflow-hidden">
                    {/* Abstract Background Shapes */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[80px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-20 translate-y-1/2 -translate-x-1/2"></div>

                    {/* Header Info */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-orange-500/30">
                                Limited Offer
                            </span>
                            {savings > 0 && (
                                <span className="bg-white/10 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                    Save {savingsPercent}%
                                </span>
                            )}
                        </div>

                        <h3 className="text-3xl lg:text-5xl font-black leading-[1.1] tracking-tight mb-4">
                            {offer.title}
                        </h3>
                        <div className="h-1 w-20 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full"></div>
                        {/* Admin Tools */}
                        {userRole === 'admin' && (
                            <div className="flex gap-2 mt-6">
                                <button onClick={() => onEdit(offer)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><FileText size={18} /></button>
                                <button onClick={() => onDelete(offer.id)} className="p-2 rounded-lg bg-white/10 hover:bg-rose-500/50 text-white transition-colors"><Trash2 size={18} /></button>
                            </div>
                        )}
                    </div>

                    {/* Price & Primary Action */}
                    <div className="relative z-10 mt-12 lg:mt-0">
                        <div className="mb-2 text-slate-400 text-sm font-bold uppercase tracking-widest">Bundle Price</div>
                        <div className="flex items-baseline gap-2 mb-8">
                            <span className="text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
                                {Math.round(totalPrice)}
                            </span>
                            <span className="text-2xl font-bold text-orange-500">₪</span>
                        </div>
                        {savings > 0 && (
                            <div className="mb-8 text-slate-400 line-through decoration-orange-500/50 decoration-2 font-medium">
                                was ₪{Math.round(totalOriginalPrice)}
                            </div>
                        )}

                        {userRole !== 'admin' && (
                            <button
                                onClick={() => addOfferToOrder(offer)}
                                className="group/btn w-full py-5 rounded-2xl bg-white text-slate-900 font-black text-xl hover:bg-orange-50 transition-colors flex items-center justify-between px-6 overflow-hidden relative"
                            >
                                <span className="relative z-10">Add to Cart</span>
                                <div className="relative z-10 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                    <ShoppingCart size={20} />
                                </div>
                                {/* Hover Fill Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 translate-x-full group-hover/btn:translate-x-0 transition-transform duration-300"></div>
                                <span className="absolute left-6 z-20 text-white opacity-0 group-hover/btn:opacity-100 transition-opacity font-black text-xl">Add to Cart</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Content & Products (The "Page") */}
                <div className="lg:w-[65%] bg-slate-50 p-8 lg:p-12 flex flex-col relative">

                    {/* Main Product Grid - Editorial Style */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        {paidItems.map((entry, idx) => {
                            const it = getItemByBarcode(entry.barcode);
                            const effectiveQty = it ? entry.quantity : 0;
                            const isLarge = idx === 0; // First item is featured larger

                            return (
                                <div
                                    key={entry.barcode}
                                    className={`group/item relative bg-white rounded-3xl p-6 shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:border-slate-200 cursor-pointer ${isLarge ? 'md:row-span-2 bg-gradient-to-br from-white to-slate-50' : ''}`}
                                    onClick={() => onItemClick && it && onItemClick(it)}
                                >
                                    {/* Floating index number for editorial feel - INCREASED VISIBILITY */}
                                    <span className="absolute top-4 left-6 text-[100px] font-black text-slate-200/40 leading-none select-none -translate-x-2 -translate-y-4 z-0">
                                        {idx + 1}
                                    </span>

                                    {it && it.stock_count > 0 && it.stock_count <= 5 && (
                                        <div className="absolute top-4 right-4 z-20 animate-pulse">
                                            <div className="bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-rose-500/30 flex items-center gap-1 border border-white/20" dir="rtl">
                                                <Flame size={12} className="text-yellow-200" fill="currentColor" />
                                                <span>باقي {it.stock_count} فقط!</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`relative flex flex-col h-full z-10 ${isLarge ? 'justify-between' : 'justify-center items-center md:items-start'}`}>
                                        <div className={`w-full ${isLarge ? 'h-64' : 'h-32'} flex items-center justify-center mb-6`}>
                                            {it && getImage(it) ? (
                                                <img src={getImage(it)} alt="" className="w-full h-full object-contain filter drop-shadow-xl group-hover/item:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <span className="text-4xl opacity-20">📦</span>
                                            )}
                                        </div>

                                        <div className="w-full relative mt-[-10px]">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded shadow-lg ${it ? 'bg-slate-900 text-white' : 'bg-red-100 text-red-600'}`}>
                                                    x{effectiveQty} {it ? '' : '(Deleted)'}
                                                </span>
                                                {it?.group && <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{it.group}</span>}
                                            </div>

                                            <div className="mb-2 w-full text-right" dir="rtl">
                                                {it?.productType ? (
                                                    <h4 className={`font-bold text-slate-800 leading-tight ${isLarge ? 'text-xl' : 'text-base'}`}>
                                                        {it.productType}
                                                    </h4>
                                                ) : (
                                                    <h4 className={`font-bold text-slate-400 italic ${isLarge ? 'text-xl' : 'text-base'}`}>
                                                        {/* Fallback if no product type is specified */}
                                                    </h4>
                                                )}
                                                <p className={`text-slate-500 font-medium line-clamp-1 mt-0.5 ${isLarge ? 'text-sm' : 'text-xs'}`} title={it?.name}>
                                                    {it?.name || <span className="text-red-400 italic">Removed Product</span>}
                                                </p>
                                            </div>

                                            {/* INCREASED PRICE SIZE */}
                                            <div className="mt-3 flex items-baseline gap-1">
                                                <span className="text-sm font-bold text-orange-500">₪</span>
                                                <span className="text-3xl font-black text-slate-900">{it ? entry.offerPrice : 0}</span>
                                                <span className="text-slate-400 text-xs font-medium ml-1">/ unit</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* FREE GIFTS STRIP - Bottom or Side */}
                    {freeItems.length > 0 && (
                        <div className="mt-10 pt-8 border-t-2 border-slate-100 border-dashed">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm">
                                    <Gift size={24} />
                                </div>
                                <div>
                                    {/* ADDED COUNT LABEL */}
                                    <h4 className="font-black text-slate-800 text-xl tracking-tight">Included Bonuses</h4>
                                    <p className="text-emerald-600 font-bold text-base bg-emerald-50 px-3 py-1 rounded-lg inline-block mt-1">
                                        Total: {freeItems.reduce((sum, item) => sum + item.quantity, 0)} items FREE!
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                                {freeItems.map((entry) => {
                                    const it = getItemByBarcode(entry.barcode);
                                    const effectiveQty = it ? entry.quantity : 0;
                                    const imgSrc = it && (getImageFallback ? getImageFallback(it) : getImage(it));

                                    return (
                                        // INCREASED SIZE OF GIFT CARD
                                        <div key={entry.barcode} onClick={() => onItemClick && it && onItemClick(it)} className="shrink-0 w-56 flex flex-col items-center text-center bg-white p-4 rounded-3xl border-2 border-emerald-50 shadow-lg shadow-emerald-100/50 relative group/gift transition-transform hover:-translate-y-1 cursor-pointer">
                                            <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 mb-3 relative">
                                                <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl rotate-3 group-hover/gift:rotate-6 transition-transform"></div>
                                                {imgSrc ? (
                                                    <img src={imgSrc} alt="" className="w-full h-full object-contain relative z-10" />
                                                ) : (
                                                    <Gift size={32} className="text-emerald-200 relative z-10" />
                                                )}
                                                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md z-20">FREE</div>
                                            </div>
                                            <div className="min-w-0 w-full relative mt-2 flex flex-col items-center gap-1">
                                                {it?.productType && (
                                                    <h4 className="font-bold text-slate-800 leading-tight text-sm text-center w-full" dir="rtl">
                                                        {it.productType}
                                                    </h4>
                                                )}
                                                <p className="text-xs text-slate-500 font-medium line-clamp-1 text-center w-full px-2" title={it?.name} dir="rtl">
                                                    {it?.name || <span className="text-red-400">Removed</span>}
                                                </p>
                                                <div className={`inline-flex items-center gap-1 text-white px-3 py-1 rounded-full text-xs font-black shadow-md mx-auto ${it ? 'bg-slate-900' : 'bg-red-500'}`}>
                                                    <span>QTY:</span>
                                                    <span className={it ? "text-emerald-400 text-base" : "text-white text-base"}>{effectiveQty}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Decorative Corner */}
                    <div className="absolute top-0 right-0 p-6">
                        <Sparkles className="text-slate-200" size={48} strokeWidth={1} />
                    </div>

                </div>
            </div>
        </div>
    );
}
