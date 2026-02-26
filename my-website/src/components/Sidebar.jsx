import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ShoppingCart, Users, Package, FileText, Settings, X, LogOut, ChevronRight } from 'lucide-react';

export default function Sidebar({ isOpen, onClose, mode, setMode, userRole, handleLogout, username }) {
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
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['supervisor', 'admin'] },
        { id: 'submitted', label: 'Sale Orders', icon: FileText, roles: ['supervisor', 'admin'] },
        { id: 'order', label: 'Sales Area', icon: ShoppingCart, roles: ['customer', 'supervisor', 'admin'] },
        // Placeholders for future features
        { id: 'customers', label: 'Customers', icon: Users, roles: ['admin'] },
        { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin'] },
        { id: 'reports', label: 'Reports', icon: FileText, roles: ['admin'] },
        { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        variants={sidebarVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-r border-slate-100"
                    >
                        {/* Header / Brand */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
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

                        {/* Navigation */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
                            {navItems.map((item) => {
                                const isVisible = item.roles.includes(userRole);
                                if (!isVisible) return null;

                                const isActive = mode === item.id;
                                const isPlaceholder = ['customers', 'inventory', 'reports', 'settings'].includes(item.id);

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (!isPlaceholder) {
                                                setMode(item.id);
                                                onClose();
                                            }
                                        }}
                                        disabled={isPlaceholder}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all group ${isActive
                                                ? 'bg-indigo-50/80 text-indigo-700 shadow-sm border border-indigo-100'
                                                : isPlaceholder
                                                    ? 'text-slate-400 opacity-60 cursor-not-allowed hidden' // Keeping them hidden for now or showing as disabled
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon
                                                size={20}
                                                className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}
                                            />
                                            <span>{item.label}</span>
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
                                );
                            })}
                        </div>

                        {/* Footer / User Profile snippet if needed, or Logout */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
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
