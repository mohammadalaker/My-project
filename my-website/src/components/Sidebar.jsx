import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ShoppingCart, Users, Package, FileText, Settings, X, LogOut, ChevronRight, Search } from 'lucide-react';

function Sidebar({
    isOpen,
    onClose,
    mode,
    setMode,
    userRole,
    handleLogout,
    username,
    badgeSubmitted = 0,
    badgeLowStock = 0,
    badgeHeld = 0,
}) {
    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
    };

    const sidebarVariants = {
        hidden: { x: '-100%', opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
        exit: { x: '-100%', opacity: 0, transition: { duration: 0.2 } },
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['supervisor', 'admin'], badgeKey: null },
        { id: 'submitted', label: 'Sale Orders', icon: FileText, roles: ['supervisor', 'admin'], badgeKey: 'submitted' },
        { id: 'sales_hub', label: 'Sales Area', icon: ShoppingCart, roles: ['customer', 'supervisor', 'admin'], badgeKey: 'held' },
        { id: 'product_lookup', label: 'Product Lookup', icon: Search, roles: ['customer', 'supervisor', 'admin'], badgeKey: null },
        { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'supervisor'], badgeKey: null },
        { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin'], badgeKey: 'lowStock' },
        { id: 'reports', label: 'Reports', icon: FileText, roles: ['admin', 'supervisor'], badgeKey: null },
        { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'], badgeKey: null },
    ];

    const getBadgeCount = (badgeKey) => {
        if (!badgeKey) return 0;
        if (badgeKey === 'submitted') return Math.max(0, Number(badgeSubmitted) || 0);
        if (badgeKey === 'held') return Math.max(0, Number(badgeHeld) || 0);
        if (badgeKey === 'lowStock') return Math.max(0, Number(badgeLowStock) || 0);
        return 0;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay — خلفية شفافة مع ضبابية خفيفة */}
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-[100] transition-opacity"
                    />

                    {/* Sidebar Panel — مظهر زجاجي (Glassmorphism): شفاف + ضبابية */}
                    <motion.div
                        variants={sidebarVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed top-4 left-4 bottom-4 w-72 z-[101] flex flex-col overflow-hidden backdrop-blur-2xl rounded-3xl border shadow-xl bg-white/60 border-white/40 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.5)_inset]"
                    >
                        {/* Header / Brand */}
                        <div className="flex items-center justify-between p-6 border-b backdrop-blur-md rounded-t-3xl border-white/30 bg-white/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white font-bold text-lg rotate-3">
                                    MS
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
                                        Maslamani
                                    </h2>
                                    <span className="text-xs font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-slate-500">Premium Appliances</span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl transition-colors text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Navigation — مؤشر نشط منزلق (Framer Motion) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1 relative backdrop-blur-sm bg-white/20">
                            {navItems.map((item) => {
                                const isVisible = item.roles.includes(userRole);
                                if (!isVisible) return null;

                                const isActive = mode === item.id || (userRole === 'customer' && item.id === 'sales_hub' && mode === 'order');
                                const isPlaceholder = [].includes(item.id);
                                const badgeCount = getBadgeCount(item.badgeKey);
                                const effectiveMode = (userRole === 'customer' && item.id === 'sales_hub') ? 'order' : item.id;
                                return (
                                    <div key={item.id} className="relative">
                                        {isActive && !isPlaceholder && (
                                            <motion.div
                                                layoutId="sidebar-active"
                                                className="absolute inset-0 rounded-xl backdrop-blur-sm bg-indigo-100/70 border border-indigo-200/50 shadow-sm"
                                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                                style={{ zIndex: 0 }}
                                            />
                                        )}
                                        <button
                                            onClick={() => {
                                                if (item.id === 'product_lookup') {
                                                    window.open('/?mode=lookup', '_blank', 'noopener,noreferrer');
                                                    onClose();
                                                    return;
                                                }
                                                setMode(effectiveMode);
                                                onClose();
                                            }}
                                            disabled={false}
                                            className={`relative z-10 w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all group ${isActive
                                                ? 'text-indigo-700'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon
                                                    size={20}
                                                    className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}
                                                />
                                                <span>{item.label}</span>
                                                {badgeCount > 0 && (
                                                    <span
                                                        title={item.badgeKey === 'lowStock' ? 'أصناف أوشكت على النفاد (كمية ≤5)' : undefined}
                                                        className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-sm"
                                                    >
                                                        {badgeCount > 99 ? '99+' : badgeCount}
                                                    </span>
                                                )}
                                            </div>
                                            {isActive && (
                                                <ChevronRight size={16} className="text-indigo-400" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t backdrop-blur-md rounded-b-3xl border-white/30 bg-white/30">
                            <button
                                onClick={() => {
                                    handleLogout();
                                    onClose();
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl backdrop-blur-sm font-semibold transition-colors shadow-sm bg-white/60 border border-white/50 text-rose-500 hover:bg-rose-50/80 border-white/50"
                            >
                                <LogOut size={18} className="text-rose-500" />
                                <span>تسجيل الخروج</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default React.memo(Sidebar);
