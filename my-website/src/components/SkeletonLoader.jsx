import React from 'react';

const SkeletonCard = () => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col min-h-0 animate-pulse">
            {/* Group Label Skeleton */}
            <div className="shrink-0 px-3 py-1.5 bg-slate-100/90 border-b border-slate-200/60">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            </div>

            {/* Image Skeleton */}
            <div className="aspect-[4/3] min-h-[200px] bg-slate-100 relative flex items-center justify-center">
                <div className="w-16 h-16 bg-slate-200 rounded-lg"></div>
            </div>

            <div className="p-3 flex-1 flex flex-col min-h-0 space-y-3">
                {/* Button Skeleton */}
                <div className="w-full h-10 bg-slate-200 rounded-xl"></div>

                {/* Title Skeleton */}
                <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                <div className="h-5 bg-slate-200 rounded w-1/2"></div>

                {/* Price Skeleton */}
                <div className="space-y-2 pt-2">
                    <div className="flex gap-2">
                        <div className="h-4 bg-slate-200 rounded w-12"></div>
                        <div className="h-4 bg-slate-200 rounded w-16"></div>
                    </div>
                    <div className="flex gap-2">
                        <div className="h-6 bg-slate-200 rounded w-20"></div>
                        <div className="h-6 bg-slate-200 rounded w-24"></div>
                    </div>
                </div>
            </div>

            {/* Footer Skeleton */}
            <div className="shrink-0 px-3 py-2 bg-slate-50/80 border-t border-slate-100 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-5 bg-slate-200 rounded w-1/2"></div>
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
                    <div className="h-8 bg-slate-200 rounded w-1/4 mb-5 mx-1"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 px-1">
                        {[...Array(5)].map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
