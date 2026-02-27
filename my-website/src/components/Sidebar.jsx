import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ShoppingCart, Users, Package, FileText, Settings, X, LogOut, ChevronRight } from 'lucide-react';

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
        { id: 'customers', label: 'Customers', icon: Users, roles: ['admin'], badgeKey: null },
        { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin'], badgeKey: 'lowStock' },
        { id: 'reports', label: 'Reports', icon: FileText, roles: ['admin'], badgeKey: null },
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
                    {/* Overlay — z-index مرتفع لضمان الظهور فوق كل العناصر */}
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity"
                    />

                    {/* Sidebar Panel — z-index أعلى من الـ overlay */}
                    <motion.div
                        variants={sidebarVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed top-0 left-0 bottom-0 w-72 z-[101] flex flex-col overflow-hidden bg-white/75 backdrop-blur-xl border-r border-white/40 shadow-xl"
                    >
                        {/* Header / Brand */}
                        <div className="flex items-center justify-between p-6 border-b border-white/50 bg-white/30 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white font-bold text-lg rotate-3">
                                    MS
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
                                        Maslamani
                                    </h2>
                                    <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Workspace</span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Navigation — مؤشر نشط منزلق (Framer Motion) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1 relative">
                            {navItems.map((item) => {
                                const isVisible = item.roles.includes(userRole);
                                if (!isVisible) return null;

                                const isActive = mode === item.id;
                                const isPlaceholder = ['inventory', 'reports'].includes(item.id);
                                const badgeCount = getBadgeCount(item.badgeKey);

                                return (
                                    <div key={item.id} className="relative">
                                        {isActive && !isPlaceholder && (
                                            <motion.div
                                                layoutId="sidebar-active"
                                                className="absolute inset-0 rounded-xl bg-indigo-50/90 border border-indigo-100 shadow-sm"
                                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                                style={{ zIndex: 0 }}
                                            />
                                        )}
                                        <button
                                            onClick={() => {
                                                if (!isPlaceholder) {
                                                    setMode(item.id);
                                                    onClose();
                                                }
                                            }}
                                            disabled={isPlaceholder}
                                            className={`relative z-10 w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all group ${isActive
                                                ? 'text-indigo-700'
                                                : isPlaceholder
                                                    ? 'text-slate-400 opacity-60 cursor-not-allowed'
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
                                                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-sm">
                                                        {badgeCount > 99 ? '99+' : badgeCount}
                                                    </span>
                                                )}
                                            </div>
                                            {isPlaceholder && (
                                                <span className="text-[9px] uppercase font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">
                                                    Soon
                                                </span>
                                            )}
                                            {!isPlaceholder && isActive && (
                                                <ChevronRight size={16} className="text-indigo-400" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/50 bg-white/30 backdrop-blur-sm">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
                            >
                                <LogOut size={18} />
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
