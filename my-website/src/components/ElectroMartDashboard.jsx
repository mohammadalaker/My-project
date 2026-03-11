import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Settings, 
  TrendingUp, ArrowUpRight, ArrowDownRight, Bell, Search, 
  MoreVertical, CreditCard, Activity, Zap, Star, Sun, Moon
} from 'lucide-react';

// Mesh Gradient Component for "WOW" background
const MeshBackground = ({ isDarkMode }) => (
  <div className={`fixed inset-0 -z-10 overflow-hidden transition-colors duration-700 ${isDarkMode ? 'bg-[#0a0c10]' : 'bg-[#f8fafc]'}`}>
    {/* Floating Orbs with Blur */}
    <motion.div 
      animate={{ 
        x: [0, 100, 0], 
        y: [0, 50, 0],
        scale: [1, 1.2, 1] 
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 ${isDarkMode ? 'bg-indigo-600/20' : 'bg-indigo-400/30'}`} 
    />
    <motion.div 
      animate={{ 
        x: [0, -80, 0], 
        y: [0, 120, 0],
        scale: [1.2, 1, 1.2] 
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 ${isDarkMode ? 'bg-purple-600/20' : 'bg-purple-400/30'}`} 
    />
    <div className={`absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full blur-[100px] transition-colors duration-700 ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-300/20'}`} />
    
    {/* Subtle Grid overlay */}
    <div className={`absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-100 mix-blend-overlay transition-opacity duration-700 ${isDarkMode ? 'opacity-20 ' : 'opacity-10'}`} />
  </div>
);

// Animated Sparkline SVG
const Sparkline = ({ color }) => (
  <svg className="w-16 h-8 opacity-50" viewBox="0 0 100 40">
    <motion.path
      d="M0 35 L20 25 L40 30 L60 10 L80 20 L100 5"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
    />
  </svg>
);

const GlassCard = ({ title, value, icon: Icon, color, trend, trendValue, index, isDarkMode }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.12, type: "spring", stiffness: 100 }}
      whileHover={{ y: -8, scale: 1.03 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative group overflow-hidden backdrop-blur-3xl border p-7 rounded-[32px] transition-all duration-500 shadow-2xl ${
        isDarkMode 
          ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]' 
          : 'bg-white/70 border-slate-200 hover:bg-white/90 hover:border-slate-300 shadow-[0_20px_40px_rgba(0,0,0,0.05)]'
      }`}
    >
      {/* Dynamic Glow logic */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute -inset-1 bg-gradient-to-r from-${color}-500/15 via-transparent to-purple-500/15 rounded-[32px] blur-2xl z-0`}
          />
        )}
      </AnimatePresence>
      
      <div className="relative z-10 flex justify-between items-start">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className={`p-3.5 rounded-2xl border transition-colors duration-500 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)] ${
              isDarkMode ? `bg-${color}-500/10 text-${color}-400 border-${color}-400/20` : `bg-${color}-50 text-${color}-600 border-${color}-200`
            }`}>
              <Icon size={22} />
            </div>
            <p className={`text-[10px] font-black tracking-widest uppercase opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{title}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className={`text-4xl font-black tracking-tighter leading-none transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
            <div className="flex items-center gap-2">
              <div className={`flex items-center text-[10px] font-black ${trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'} px-2.5 py-1 rounded-full border border-current/10`}>
                {trend === 'up' ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
                {trendValue}
              </div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">vs yesterday</span>
            </div>
          </div>
        </div>
        <div className="mt-2">
           <Sparkline color={trend === 'up' ? '#34d399' : '#fb7185'} />
        </div>
      </div>
      
      {/* Internal highlight line */}
      <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </motion.div>
  );
};

const NavItem = ({ icon: Icon, label, active = false, badge, isDarkMode }) => (
  <motion.button
    whileHover={{ x: 8, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)' }}
    whileTap={{ scale: 0.96 }}
    className={`w-full flex items-center justify-between p-4.5 rounded-2xl transition-all duration-300 group ${
      active 
        ? (isDarkMode ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm') 
        : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900')
    }`}
  >
    <div className="flex items-center gap-4">
      <div className={`transition-all duration-300 ${active ? (isDarkMode ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'text-indigo-600 scale-110') : (isDarkMode ? 'group-hover:text-white' : 'group-hover:text-slate-900')}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </div>
      <span className={`text-sm tracking-tight ${active ? 'font-black' : 'font-bold'}`}>{label}</span>
    </div>
    {badge && (
      <span className="bg-gradient-to-tr from-rose-500 to-orange-500 text-white text-[9px] font-black w-5 h-5 rounded-lg flex items-center justify-center shadow-lg shadow-rose-500/40 border border-white/20">
        {badge}
      </span>
    )}
  </motion.button>
);

// Animated Sales Chart Component
const SalesChart = ({ isDarkMode }) => (
  <div className="w-full h-48 relative overflow-hidden">
    <svg className={`w-full h-full ${isDarkMode ? 'drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]' : ''}`} viewBox="0 0 1000 200" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isDarkMode ? "rgba(99, 102, 241, 0.4)" : "rgba(99, 102, 241, 0.2)"} />
          <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
        </linearGradient>
      </defs>
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
        d="M0,150 Q125,50 250,130 T500,80 T750,110 T1000,40"
        fill="url(#chartGradient)"
        stroke="transparent"
      />
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.5, ease: "easeInOut" }}
        d="M0,150 Q125,50 250,130 T500,80 T750,110 T1000,40"
        fill="none"
        stroke={isDarkMode ? "#6366f1" : "#4f46e5"}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Interactive Dots */}
      {[250, 500, 750].map((x, i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.5 + i * 0.2 }}
          cx={x}
          cy={x === 250 ? 130 : x === 500 ? 80 : 110}
          r="6"
          fill={isDarkMode ? "#fff" : "#4f46e5"}
          className="cursor-pointer hover:fill-indigo-400 transition-colors shadow-2xl"
        />
      ))}
    </svg>
  </div>
);

const RecentSalesTable = ({ isDarkMode }) => {
  const sales = [
    { id: '#4521', item: 'آيفون 15 برو', price: '₪5,200', time: 'منذ 5 دقائق', status: 'Completed' },
    { id: '#4520', item: 'ساعة آبل 9', price: '₪1,850', time: 'منذ 12 دقيقة', status: 'Pending' },
    { id: '#4519', item: 'ماك بوك آير', price: '₪4,100', time: 'منذ 45 دقيقة', status: 'Completed' },
    { id: '#4518', item: 'سماعات سوني', price: '₪1,200', time: 'منذ ساعة', status: 'Completed' },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-right">
        <thead>
          <tr className={`text-[10px] font-black uppercase tracking-widest border-b transition-colors duration-500 ${isDarkMode ? 'text-gray-500 border-white/5' : 'text-slate-400 border-slate-100'}`}>
            <th className="pb-4 pr-6">المنتج</th>
            <th className="pb-4">الحالة</th>
            <th className="pb-4 text-left pl-6">السعر</th>
          </tr>
        </thead>
        <tbody className={`divide-y transition-colors duration-500 ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
          {sales.map((sale, i) => (
            <motion.tr 
              key={sale.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className={`group transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50/80'}`}
            >
              <td className="py-4 pr-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                    isDarkMode ? 'bg-white/5 border-white/10 group-hover:border-indigo-500/30' : 'bg-slate-50 border-slate-200 group-hover:border-indigo-200'
                  }`}>
                    <Package size={18} className={`transition-colors ${isDarkMode ? 'text-gray-400 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-none transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{sale.item}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{sale.time} • {sale.id}</p>
                  </div>
                </div>
              </td>
              <td className="py-4">
                <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${sale.status === 'Completed' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-orange-400 bg-orange-400/10 border-orange-400/20'}`}>
                  {sale.status === 'Completed' ? 'مكتمل' : 'قيد الانتظار'}
                </span>
              </td>
              <td className={`py-4 text-left pl-6 font-black transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sale.price}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ElectroMartDashboard = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  return (
    <div className={`min-h-screen flex font-sans leading-relaxed selection:bg-indigo-500/30 overflow-hidden transition-colors duration-700 ${isDarkMode ? 'bg-[#07080a] text-white' : 'bg-[#f1f5f9] text-slate-900'}`} dir="rtl">
      <MeshBackground isDarkMode={isDarkMode} />

      {/* Sidebar */}
      <motion.aside 
        initial={{ x: 120, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`w-80 backdrop-blur-3xl p-8 hidden lg:flex flex-col sticky top-0 h-screen z-50 transition-all duration-700 ${
          isDarkMode 
            ? 'bg-black/40 border-l border-white/5 shadow-[40px_0_80px_rgba(0,0,0,0.8)]' 
            : 'bg-white/80 border-l border-slate-200 shadow-[40px_0_80px_rgba(0,0,0,0.05)]'
        }`}
      >
        <div className="mb-14 px-2">
          <motion.div 
            initial={{ scale: 0.8, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            className="flex items-center gap-4 mb-3"
          >
            <div className={isDarkMode ? '' : 'text-slate-900'}>
              <h1 className={`text-2xl font-extrabold tracking-tight leading-none transition-colors duration-700 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Maslamani<span className={isDarkMode ? 'font-light text-white/95' : 'font-light text-slate-600'}>Sales</span>
              </h1>
              <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>system</p>
            </div>
          </motion.div>
        </div>
        
        <nav className="space-y-3 flex-grow">
          <div className={`px-4 mb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-700 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>General</div>
          <NavItem icon={LayoutDashboard} label="لوحة التحكم" active isDarkMode={isDarkMode} />
          <NavItem icon={Package} label="المنتجات" badge="12" isDarkMode={isDarkMode} />
          <NavItem icon={ShoppingCart} label="المبيعات" isDarkMode={isDarkMode} />
          <NavItem icon={Users} label="العملاء" isDarkMode={isDarkMode} />
          
          <div className={`px-4 mt-8 mb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-700 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>Analytics</div>
          <NavItem icon={Activity} label="التقارير" isDarkMode={isDarkMode} />
          <NavItem icon={CreditCard} label="المدفوعات" isDarkMode={isDarkMode} />
          <NavItem icon={Settings} label="الإعدادات" isDarkMode={isDarkMode} />
        </nav>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className={`mt-auto p-6 rounded-[32px] border relative overflow-hidden group shadow-inner transition-all duration-700 ${
            isDarkMode ? 'bg-gradient-to-br from-indigo-600/10 to-purple-800/20 border-white/5' : 'bg-indigo-50/50 border-indigo-100 shadow-[inset_0_2px_10px_rgba(99,102,241,0.05)]'
          }`}
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
          <div className="flex items-center gap-3 mb-5 relative z-10">
            <div className={`p-2.5 rounded-xl border transition-colors ${isDarkMode ? 'bg-indigo-500/20 border-indigo-400/20' : 'bg-white border-indigo-200'}`}>
              <Star size={18} className="text-indigo-400 fill-indigo-400" />
            </div>
            <div className="text-xs">
              <p className={`font-black transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>النسخة الاحترافية</p>
              <p className={`font-bold mt-0.5 transition-colors ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>احصل على كامل المزايا</p>
            </div>
          </div>
          <button className={`w-full py-3.5 px-4 font-black text-[11px] rounded-[18px] transition-all active:scale-95 ${
            isDarkMode ? 'bg-white text-black hover:bg-indigo-50 shadow-[0_15px_30px_rgba(255,255,255,0.1)]' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_10px_20px_rgba(99,102,241,0.2)]'
          }`}>
            ترقية حسابك الآن
          </button>
        </motion.div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 p-8 lg:p-14 overflow-y-auto custom-scrollbar relative">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-20 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={`flex items-center gap-3 mb-4 w-fit px-4 py-1.5 rounded-full border backdrop-blur-md ${isDarkMode ? 'text-indigo-400 bg-white/5 border-white/10' : 'text-indigo-600 bg-indigo-50/80 border-indigo-200'}`}>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Statistics • March 2026</span>
            </div>
            <h2 className={`text-6xl font-black tracking-tighter mb-4 drop-shadow-2xl transition-colors duration-700 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>أهلاً بك، محمد 👋</h2>
            <p className={`text-xl font-medium max-w-2xl leading-relaxed transition-colors duration-700 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>إليك نظرة شاملة على أداء مبيعات <span className={`font-extrabold tracking-tight transition-colors duration-700 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Maslamani<span className={isDarkMode ? 'font-light text-white/90' : 'font-light text-slate-600'}>Sales</span></span> في فرعك اليوم.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`flex gap-4 items-center p-3 rounded-[32px] border backdrop-blur-2xl shadow-2xl transition-all duration-700 ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-slate-200'
            }`}
          >
            {/* Theme Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-4 rounded-2xl border transition-all duration-500 flex items-center justify-center ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-yellow-500 hover:bg-white/10' 
                  : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'
              }`}
            >
              {isDarkMode ? <Sun size={22} fill="currentColor" /> : <Moon size={22} fill="currentColor" />}
            </motion.button>

            <div className={`relative p-4 text-gray-400 hover:text-white transition-all cursor-pointer rounded-2xl group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
              <Search size={22} />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-indigo-500 group-hover:w-4 transition-all duration-300" />
            </div>
            <div className="relative p-4 text-gray-400 hover:text-white transition-all cursor-pointer hover:bg-white/5 rounded-2xl group">
              <Bell size={22} />
              <span className="absolute top-4 right-4 w-3 h-3 bg-gradient-to-tr from-rose-500 to-orange-500 rounded-full border-[3px] border-[#07080a] shadow-lg shadow-rose-500/40" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-indigo-500 group-hover:w-4 transition-all duration-300" />
            </div>
            <div className="h-10 w-px bg-white/10 mx-2" />
            <div className="flex items-center gap-5 bg-white/10 p-2.5 pr-8 rounded-[24px] border border-white/10 hover:bg-white/15 transition-all cursor-pointer group shadow-inner">
              <div className="text-right">
                <p className="text-xs font-black text-white leading-none mb-1.5 group-hover:text-indigo-200 transition-colors">أحمد المصري</p>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none group-hover:text-gray-400">مشرف الفرع (Supervisor)</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center text-white font-black text-sm shadow-[0_8px_16px_rgba(99,102,241,0.3)] border border-white/20 group-hover:scale-105 transition-transform duration-500">
                AM
              </div>
            </div>
          </motion.div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
          <GlassCard title="Revenue" value="₪4,520" icon={CreditCard} color="indigo" trend="up" trendValue="+12.5%" index={0} isDarkMode={isDarkMode} />
          <GlassCard title="New Orders" value="24" icon={Zap} color="purple" trend="up" trendValue="+8.2%" index={1} isDarkMode={isDarkMode} />
          <GlassCard title="Low Stock" value="5 items" icon={Package} color="rose" trend="down" trendValue="-3.1%" index={2} isDarkMode={isDarkMode} />
          <GlassCard title="Churn Rate" value="1.2%" icon={Activity} color="emerald" trend="up" trendValue="+0.4%" index={3} isDarkMode={isDarkMode} />
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
          {/* Recent Sales Table */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`xl:col-span-2 backdrop-blur-3xl border rounded-[48px] p-10 shadow-2xl overflow-hidden relative transition-all duration-700 ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/80 border-slate-200 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.05)]'
            }`}
          >
            <div className="flex justify-between items-center mb-10 px-2">
              <div>
                <h3 className={`text-3xl font-black tracking-tight transition-colors duration-700 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>العمليات الأخيرة</h3>
                <p className="text-gray-500 text-sm font-bold mt-1">تتبع آخر المبيعات والطلبات</p>
              </div>
              <button className={`px-6 py-2.5 border rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${
                isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                عرض الكل
              </button>
            </div>
            <RecentSalesTable isDarkMode={isDarkMode} />
          </motion.div>

          {/* Sales Analytics Chart */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-br from-indigo-600 to-purple-800 rounded-[48px] p-10 shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-2 px-3 py-1 bg-white/10 rounded-full w-fit">Branch Overview</p>
                  <h3 className="text-4xl font-black text-white tracking-tighter">أداء الفرع الحالي</h3>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                  <TrendingUp size={24} className="text-white" />
                </div>
              </div>

              <SalesChart isDarkMode={isDarkMode} />

              <div className="mt-12 grid grid-cols-2 gap-4">
                <div className={`p-5 rounded-3xl border backdrop-blur-md transition-all duration-700 ${isDarkMode ? 'bg-white/10 border-white/10' : 'bg-white/20 border-white/30 shadow-inner'}`}>
                  <p className={`text-[10px] font-black uppercase mb-1 ${isDarkMode ? 'text-indigo-200' : 'text-indigo-100'}`}>Total Sales</p>
                  <p className="text-2xl font-black text-white">450+</p>
                </div>
                <div className={`p-5 rounded-3xl border backdrop-blur-md transition-all duration-700 ${isDarkMode ? 'bg-white/10 border-white/10' : 'bg-white/20 border-white/30 shadow-inner'}`}>
                  <p className={`text-[10px] font-black uppercase mb-1 ${isDarkMode ? 'text-indigo-200' : 'text-indigo-100'}`}>Growth</p>
                  <p className="text-2xl font-black text-emerald-300">+24%</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'};
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
          border-radius: 20px;
          border: 2px solid transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'};
        }
      `}} />
    </div>
  );
};

export default ElectroMartDashboard;
