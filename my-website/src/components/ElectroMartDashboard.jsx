import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  TrendingUp,
  Bell,
  Search,
  Star,
  Loader2,
  Receipt,
  AlertTriangle,
} from 'lucide-react';

// Mesh Gradient Component for "WOW" background
const MeshBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-[#f8fafc]">
    {/* Floating Orbs with Blur */}
    <motion.div 
      animate={{ 
        x: [0, 100, 0], 
        y: [0, 50, 0],
        scale: [1, 1.2, 1] 
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-indigo-400/30" 
    />
    <motion.div 
      animate={{ 
        x: [0, -80, 0], 
        y: [0, 120, 0],
        scale: [1.2, 1, 1.2] 
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-purple-400/30" 
    />
    <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full blur-[100px] bg-blue-300/20" />
    
    {/* Subtle Grid overlay */}
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-100 mix-blend-overlay opacity-10" />
  </div>
);

// Animated Sales Chart Component
const SalesChart = () => (
  <div className="w-full h-48 relative overflow-hidden">
    <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(99, 102, 241, 0.2)" />
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
        stroke="#4f46e5"
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
          fill="#4f46e5"
          className="cursor-pointer hover:fill-indigo-400 transition-colors shadow-2xl"
        />
      ))}
    </svg>
  </div>
);

/** طلب معتمد في التحليل (موافق عليه من شاشة الطلبات) */
function isOrderCompleted(o) {
  const s = String(o?.status ?? '').trim().toLowerCase();
  return s === 'completed' || s === 'complete';
}

const RecentSalesTable = ({ orders, loading = false }) => {
  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-9 h-9 text-indigo-500 animate-spin" />
        <p className="text-sm font-bold">جاري تحميل العمليات…</p>
      </div>
    );
  }
  const sales = (orders || []).slice(0, 10).map((o, i) => {
    const total = o.total_amount ?? (o.items || []).reduce((s, it) => s + (it.total || 0), 0);
    const firstItem = (o.items && o.items[0]) ? (o.items[0].name || o.items[0].barcode || '—') : 'طلب';
    const dateStr = (o.order_date || o.created_at || '').slice(0, 10);
    let statusKey = 'Pending';
    if (isOrderCompleted(o)) statusKey = 'Completed';
    else if (String(o.status || '').toLowerCase() === 'to_prepare') statusKey = 'Preparing';
    return { id: o.id || `#${i + 1}`, item: firstItem, price: `₪${Math.round(total)}`, time: dateStr, status: statusKey };
  });

  if (sales.length === 0) {
    return (
      <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-500">
        <Package size={48} className="mx-auto mb-3 opacity-50" />
        <p className="font-bold">لا توجد عمليات حديثة</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-right">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-widest border-b transition-colors duration-500 text-slate-400 border-slate-100">
            <th className="pb-4 pr-6">المنتج</th>
            <th className="pb-4">الحالة</th>
            <th className="pb-4 text-left pl-6">السعر</th>
          </tr>
        </thead>
        <tbody className="divide-y transition-colors duration-500 divide-slate-50">
          {sales.map((sale, i) => (
            <motion.tr 
              key={sale.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="group transition-colors cursor-pointer hover:bg-slate-50/80"
            >
              <td className="py-4 pr-6">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 border border-slate-200 group-hover:border-indigo-200 w-10 h-10 rounded-xl flex items-center justify-center border transition-all">
                    <Package size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-none transition-colors text-slate-800">{sale.item}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{sale.time} • {sale.id}</p>
                  </div>
                </div>
              </td>
              <td className="py-4">
                <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${
                  sale.status === 'Completed'
                    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                    : sale.status === 'Preparing'
                      ? 'text-sky-400 bg-sky-400/10 border-sky-400/20'
                      : 'text-orange-400 bg-orange-400/10 border-orange-400/20'
                }`}>
                  {sale.status === 'Completed' ? 'مكتمل' : sale.status === 'Preparing' ? 'تحت التجهيز' : 'قيد الانتظار'}
                </span>
              </td>
              <td className="py-4 text-left pl-6 font-black transition-colors text-slate-900">{sale.price}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function orderCalendarDate(o) {
  return (o.order_date || o.created_at || '').slice(0, 10);
}

const ElectroMartDashboard = ({ items = [], orders = [], ordersLoading = false, username, setMode }) => {
  const stats = useMemo(() => {
    const lineTotal = (o) =>
      Number(o.total_amount ?? (o.items || []).reduce((sum, it) => sum + (Number(it.total) || 0), 0)) || 0;

    const pendingCount = (orders || []).filter((o) => !isOrderCompleted(o)).length;

    const lowStock = (items || []).filter((i) => {
      const sc = Number(i.stock_count ?? i.stock ?? NaN);
      if (Number.isNaN(sc)) return false;
      return sc >= 0 && sc <= 5;
    }).length;

    const todayStr = localDateStr();
    const completedToday = (orders || []).filter(
      (o) => isOrderCompleted(o) && orderCalendarDate(o) === todayStr,
    );
    const todayRevenue = completedToday.reduce((s, o) => s + lineTotal(o), 0);
    const todayInvoiceCount = completedToday.length;

    const itemQty = {};
    completedToday.forEach((o) => {
      (o.items || []).forEach((it) => {
        const label = String(it.name || it.barcode || '—').trim() || '—';
        itemQty[label] = (itemQty[label] || 0) + (Number(it.qty) || 1);
      });
    });
    let topItemName = '—';
    let topItemQty = 0;
    Object.entries(itemQty).forEach(([name, q]) => {
      if (q > topItemQty) {
        topItemQty = q;
        topItemName = name;
      }
    });
    if (todayInvoiceCount === 0) {
      topItemName = 'لا مبيعات اليوم';
      topItemQty = 0;
    }

    return {
      pendingCount,
      lowStock,
      todayRevenue,
      todayInvoiceCount,
      topItemName,
      topItemQty,
    };
  }, [orders, items]);

  return (
    <div className="h-full min-h-screen w-full flex font-sans leading-relaxed selection:bg-indigo-500/30 overflow-hidden transition-colors duration-700 bg-[#f8fafc] text-slate-900" dir="ltr">
      <MeshBackground />

      {/* Main Content */}
      <main className="flex-1 p-8 lg:p-14 overflow-y-auto custom-scrollbar relative">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-20 gap-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-1 items-center p-1.5 rounded-2xl transition-all duration-500 order-2 xl:order-1 bg-white/50 border border-slate-200/60 backdrop-blur-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div className="relative p-3 rounded-xl transition-colors duration-300 cursor-pointer group text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <Search size={20} />
            </div>
            <div className="relative p-3 rounded-xl transition-colors duration-300 cursor-pointer group text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            </div>
            <div className="w-px h-8 mx-0.5 transition-colors duration-500 bg-slate-200/80" />
            <div className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl transition-all duration-300 group hover:bg-slate-50/80">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-none">
                {(username || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold truncate leading-none transition-colors duration-300 text-slate-700 group-hover:text-slate-900">{username || 'المستخدم'}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="order-1 xl:order-2 xl:text-right"
          >
            <h2 className="text-6xl font-black tracking-tighter mb-4 drop-shadow-2xl transition-colors duration-700 text-slate-900">أهلاً بك محمد العكر 👋</h2>
            <p className="text-xl font-medium max-w-2xl leading-relaxed transition-colors duration-700 xl:ml-auto text-slate-600">
              نظرة على المبيعات المعتمدة (بعد الموافقة على الطلب).{' '}
              {!ordersLoading && stats.pendingCount > 0 ? (
                <span className="text-amber-700 font-bold">طلبات بانتظار الموافقة: {stats.pendingCount}</span>
              ) : null}{' '}
              <span className="font-extrabold tracking-tight transition-colors duration-700 text-slate-900">Maslamani<span className="font-light text-slate-600">Sales</span></span>
            </p>
          </motion.div>
        </header>

        {/* بطاقات الحالة السريعة — نبض المحل اليوم */}
        <div className="mb-16" dir="rtl">
          <div className="flex items-center justify-between gap-4 mb-5 px-1">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">نبض المحل اليوم</h3>
            <span className="text-xs font-bold text-slate-400 tabular-nums" dir="ltr">
              {localDateStr()}
            </span>
          </div>
          {ordersLoading ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-[28px] border border-slate-200/80 bg-white/60 backdrop-blur">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-500">جاري تحميل إحصائيات الطلبات…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* 1 — إجمالي المبيعات اليوم (أخضر) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-[24px] p-5 border shadow-sm bg-gradient-to-br from-emerald-50 via-emerald-50/90 to-teal-50/80 border-emerald-200/70"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-700 border border-emerald-200/50">
                    <TrendingUp size={22} strokeWidth={2.5} />
                  </div>
                </div>
                <p className="text-[11px] font-black text-emerald-800/80 uppercase tracking-wide mb-1">إجمالي المبيعات (اليوم)</p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-900 tabular-nums tracking-tight" dir="ltr">
                  ₪{Math.round(stats.todayRevenue).toLocaleString('ar-EG')}
                </p>
                <p className="text-[10px] font-bold text-emerald-700/70 mt-2">طلبات معتمدة بتاريخ اليوم</p>
              </motion.div>

              {/* 2 — عدد الفواتير */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-[24px] p-5 border shadow-sm bg-white/90 border-slate-200/80 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <Receipt size={22} strokeWidth={2.5} />
                  </div>
                </div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-1">عدد الفواتير (اليوم)</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">{stats.todayInvoiceCount}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-2">فواتير مكتملة — يدل على حركة الزبائن</p>
              </motion.div>

              {/* 3 — أكثر صنف مبيعاً */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-[24px] p-5 border shadow-sm bg-white/90 border-slate-200/80 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                    <Star size={22} strokeWidth={2.5} className="fill-amber-200/50" />
                  </div>
                </div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-1">أكثر صنف مبيعاً (اليوم)</p>
                <p className="text-base sm:text-lg font-black text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]" title={stats.topItemName}>
                  {stats.topItemName}
                </p>
                {stats.todayInvoiceCount > 0 && stats.topItemQty > 0 && (
                  <p className="text-[10px] font-bold text-amber-700/90 mt-2">الكمية المباعة: {stats.topItemQty}</p>
                )}
              </motion.div>

              {/* 4 — تنبيه النواقص */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`rounded-[24px] p-5 border shadow-sm backdrop-blur-sm ${
                  stats.lowStock > 0
                    ? 'bg-gradient-to-br from-rose-50 to-orange-50/80 border-rose-200/70'
                    : 'bg-white/90 border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      stats.lowStock > 0
                        ? 'bg-rose-500/10 text-rose-700 border-rose-200/60'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}
                  >
                    <AlertTriangle size={22} strokeWidth={2.5} />
                  </div>
                </div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-1">تنبيه النواقص</p>
                <p className={`text-2xl sm:text-3xl font-black tabular-nums ${stats.lowStock > 0 ? 'text-rose-800' : 'text-emerald-700'}`}>
                  {stats.lowStock}
                </p>
                <p className="text-[10px] font-bold text-slate-600 mt-2">
                  {stats.lowStock > 0 ? 'منتجات مخزونها منخفض (≤٥ قطع)' : 'لا يوجد نقص حرج حسب العتبة'}
                </p>
              </motion.div>
            </div>
          )}
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
          {/* Recent Sales Table */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="xl:col-span-2 backdrop-blur-3xl border rounded-[48px] p-10 shadow-2xl overflow-hidden relative transition-all duration-700 bg-white/80 border-slate-200 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.05)]"
          >
            <div className="flex justify-between items-center mb-10 px-2">
              <div>
                <h3 className="text-3xl font-black tracking-tight transition-colors duration-700 text-slate-900">العمليات الأخيرة</h3>
                <p className="text-gray-500 text-sm font-bold mt-1">تتبع آخر المبيعات والطلبات</p>
              </div>
              <button className="px-6 py-2.5 border rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest bg-slate-50 border-slate-200 hover:bg-slate-100">
                عرض الكل
              </button>
            </div>
            <RecentSalesTable orders={orders} loading={ordersLoading} />
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
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-2 px-3 py-1 bg-white/10 rounded-full w-fit">Overview</p>
                  <h3 className="text-4xl font-black text-white tracking-tighter">أداء المبيعات</h3>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                  <TrendingUp size={24} className="text-white" />
                </div>
              </div>

              <SalesChart />

              <div className="mt-12 grid grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl border backdrop-blur-md transition-all duration-700 bg-white/20 border-white/30 shadow-inner">
                  <p className="text-[10px] font-black uppercase mb-1 text-indigo-100">Total Sales</p>
                  <p className="text-2xl font-black text-white">450+</p>
                </div>
                <div className="p-5 rounded-3xl border backdrop-blur-md transition-all duration-700 bg-white/20 border-white/30 shadow-inner">
                  <p className="text-[10px] font-black uppercase mb-1 text-indigo-100">Growth</p>
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
          background: rgba(0,0,0,0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.08);
          border-radius: 20px;
          border: 2px solid transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.15);
        }
      `}} />
    </div>
  );
};

export default ElectroMartDashboard;
