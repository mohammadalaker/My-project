import React, { useState, useEffect } from 'react';
import { ShoppingBag, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SmartScreensaver({ active, onWake, items }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const featuredItems = React.useMemo(() => {
        if (!items || items.length === 0) return [];
        // Get items with stock & images, prioritize offers/high price
        return [...items]
            .filter(i => i.image && i.image.length > 5 && i.stock > 0 && i.visible !== false)
            .sort((a, b) => (b.isOffer ? 1 : 0) - (a.isOffer ? 1 : 0))
            .slice(0, 5);
    }, [items]);

    // Rotate featured item every 8 seconds
    useEffect(() => {
        if (!active || featuredItems.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % featuredItems.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [active, featuredItems.length]);

    if (!active) return null;

    const currentItem = featuredItems[currentIndex];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            onClick={onWake}
            className="fixed inset-0 z-[9999] bg-black cursor-pointer flex flex-col items-center justify-center overflow-hidden"
            dir="rtl"
        >
            {/* Very dim ambient light effect to save OLED pixels but look premium */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
            
            {featuredItems.length > 0 && currentItem ? (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.05, y: -20 }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                        className="relative z-10 flex flex-col items-center max-w-2xl px-8 text-center"
                    >
                        {/* Image */}
                        <div className="w-64 h-64 md:w-96 md:h-96 mb-12 relative flex items-center justify-center">
                            <img
                                src={currentItem.image.startsWith('http') ? currentItem.image : `https://hytncdomjctqihrqfswh.supabase.co/storage/v1/object/public/Pic_of_items/${currentItem.image.replace(/^\//, '')}`}
                                alt={currentItem.name}
                                className="max-w-full max-h-full object-contain filter drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                            />
                        </div>

                        {/* Text Info */}
                        <h2 className="text-3xl md:text-5xl font-black text-white/90 mb-4 leading-tight tracking-tight">
                            {currentItem.name || currentItem.group}
                        </h2>
                        
                        {currentItem.productType && (
                            <p className="text-indigo-300 text-xl font-medium mb-6 flex items-center gap-2 justify-center">
                                <Sparkles size={20} />
                                {currentItem.productType}
                            </p>
                        )}

                        {/* Price (Dimmed) */}
                        <div className="text-4xl font-light text-white/60">
                            ₪ {Math.round(currentItem.priceAfterDiscount || currentItem.price || 0)}
                        </div>
                    </motion.div>
                </AnimatePresence>
            ) : (
                <motion.div 
                    animate={{ opacity: [0.3, 0.7, 0.3] }} 
                    transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                    className="flex flex-col items-center gap-6"
                >
                    {/* Fallback generic screensaver if no items with images */}
                    <ShoppingBag size={80} className="text-white/20" strokeWidth={1} />
                    <h1 className="text-4xl font-light text-white/30 tracking-widest">MASLAMANI</h1>
                </motion.div>
            )}

            {/* Floating "Touch to start" indicator - keeps moving to prevent burn-in */}
            <motion.div
                animate={{ 
                    y: [0, -15, 0], 
                    opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute bottom-16 text-white/50 flex flex-col items-center gap-3"
            >
                <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white/50 rounded-full animate-ping" />
                </div>
                <p className="text-sm font-medium tracking-widest uppercase">المس الشاشة للبدء</p>
            </motion.div>
        </motion.div>
    );
}
