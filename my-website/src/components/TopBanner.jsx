import React from 'react';
import { Tag } from 'lucide-react';

export default function TopBanner({ items }) {
    if (!items || items.length === 0) return null;

    return (
        <div className="bg-gradient-to-r from-rose-600 to-orange-600 text-white overflow-hidden py-2 relative z-50 shadow-md">
            <div className="flex items-center gap-4 animate-marquee whitespace-nowrap">
                {/* Render items twice to create seamless loop effect if needed, or just enough to fill screen */}
                {[...items, ...items, ...items].map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex items-center gap-2 mx-8 text-sm font-bold">
                        <Tag size={16} className="text-yellow-300" />
                        <span className="text-yellow-100">{item.name}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded text-white font-mono">
                            ₪{Math.round(item.priceAfterDiscount ?? item.price ?? 0)}
                        </span>
                    </div>
                ))}
            </div>
            <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          animation: marquee 40s linear infinite;
          width: max-content;
        }
        /* Mobile optimization */
        @media (max-width: 768px) {
          .animate-marquee {
            animation-duration: 20s;
          }
        }
      `}</style>
        </div>
    );
}
