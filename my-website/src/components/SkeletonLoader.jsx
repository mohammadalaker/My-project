import React from 'react';

const SkeletonCard = () => {
    return (
        <div className="glass-card flex flex-col min-h-0 animate-pulse bg-white/40">
            {/* Group Label Skeleton */}
            <div className="shrink-0 px-3 py-1.5 bg-slate-100/50 border-b border-white/50">
                <div className="h-4 bg-slate-200/60 rounded w-1/3"></div>
            </div>

            {/* Image Skeleton */}
            <div className="aspect-[4/3] min-h-[200px] bg-slate-50/50 relative flex items-center justify-center">
                <div className="w-16 h-16 bg-slate-200/60 rounded-2xl"></div>
            </div>

            <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
                {/* Title Skeleton */}
                <div className="space-y-2">
                    <div className="h-5 bg-slate-200/60 rounded-lg w-3/4"></div>
                    <div className="h-5 bg-slate-200/60 rounded-lg w-1/2"></div>
                </div>

                <div className="h-4 bg-slate-200/60 rounded w-full mt-auto"></div>

                {/* Price Skeleton */}
                <div className="flex items-end justify-between pt-2">
                    <div className="space-y-1">
                        <div className="h-3 bg-slate-200/60 rounded w-8"></div>
                        <div className="h-6 bg-slate-200/60 rounded w-16"></div>
                    </div>
                </div>

                {/* Button Skeleton */}
                <div className="w-full h-12 bg-slate-800/10 rounded-xl mt-4"></div>
            </div>
        </div>
    );
};

export default function SkeletonGrid() {
    return (
        <div className="pb-8 space-y-12">
            {/* Simulate Sections */}
            {[1, 2].map((section) => (
                <section key={section}>
                    <div className="flex items-center gap-3 mb-6 ml-2">
                        <div className="w-10 h-10 rounded-xl bg-slate-200/60" />
                        <div className="h-8 bg-slate-200/60 rounded w-48"></div>
                    </div>

                    <div className="product-grid">
                        {[...Array(5)].map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
