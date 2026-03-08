import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Award, Download, AlertTriangle, Calendar, Clock } from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

export default function Dashboard({ items, orders }) {
    const [dateFilter, setDateFilter] = useState('all'); // all, today, 7days, month
    const [exporting, setExporting] = useState(false);

    // 0. Filter orders by date
    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        const sevenDaysStr = sevenDaysAgo.toISOString().slice(0, 10);

        const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

        return orders.filter(o => {
            const d = (o.order_date || o.created_at || '').slice(0, 10);
            if (!d) return true; // Keep old orders with no date string
            if (dateFilter === 'today') return d === todayStr;
            if (dateFilter === '7days') return d >= sevenDaysStr && d <= todayStr;
            if (dateFilter === 'month') return d.startsWith(currentMonthPrefix);
            return true; // all
        });
    }, [orders, dateFilter]);

    // 1. Calculate General KPIs
    const kpis = useMemo(() => {
        if (!filteredOrders || filteredOrders.length === 0) {
            return { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
        }

        const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const totalOrders = filteredOrders.length;
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        return { totalRevenue, totalOrders, avgOrderValue };
    }, [orders]);

    // 2. Prepare Top Sellers
    const topSellers = useMemo(() => {
        if (!filteredOrders) return [];
        const counts = {};
        filteredOrders.forEach(o => {
            (o.items || []).forEach(val => {
                const itemCode = val.barcode || val.name || 'Unknown';
                if (!counts[itemCode]) {
                    counts[itemCode] = { name: val.name || itemCode, qty: 0, revenue: 0 };
                }
                counts[itemCode].qty += (val.qty || 1);
                counts[itemCode].revenue += (val.total || 0);
            });
        });

        return Object.values(counts)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 3);
    }, [orders]);

    // 3. Prepare Bar Chart Data (Last 7 Days Revenue regardless of filter, to always show a trend)
    const barChartData = useMemo(() => {
        if (!orders) return []; // Notice: We use ALL orders for trend line to avoid empty charts if filter is "today"

        // Get last 7 days dates
        const dataMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            dataMap[dateStr] = { date: dateStr, revenue: 0 };
        }

        orders.forEach(o => {
            // Order date might be stored in order_date or created_at
            const dateStr = (o.order_date || o.created_at || '').slice(0, 10);
            if (dataMap[dateStr]) {
                dataMap[dateStr].revenue += (o.total_amount || 0);
            }
        });

        return Object.values(dataMap);
    }, [orders]);

    // 4. Prepare Pie Chart Data (Revenue by Category/Group)
    const pieChartData = useMemo(() => {
        if (!filteredOrders) return [];
        const groupRev = {};

        filteredOrders.forEach(o => {
            (o.items || []).forEach(val => {
                // We try to find the group of the item
                // First check if it's saved in the order line
                let groupName = val.group || 'Other';

                // If not, try to look it up from current items database
                if (groupName === 'Other' && val.barcode) {
                    const liveItem = items.find(i => String(i.barcode) === String(val.barcode));
                    if (liveItem && liveItem.group) {
                        groupName = liveItem.group;
                    }
                }

                // Simplify into "Electrical" vs "Household" or keep original groups if you prefer
                // For simplicity, let's keep original groups but merge small ones into "Other" if too many

                if (!groupRev[groupName]) {
                    groupRev[groupName] = 0;
                }
                groupRev[groupName] += (val.total || 0);
            });
        });

        return Object.entries(groupRev)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredOrders, items]);

    // 5. Low Stock Alerts
    const lowStockItems = useMemo(() => {
        if (!items) return [];
        return items
            .filter(i => {
                // If it's explicitly tracked and > 0 but < 3
                const s = Number(i.stock_count);
                if (isNaN(s)) return false; // Infinite/Unlimited
                return s >= 0 && s <= 3;
            })
            .sort((a, b) => Number(a.stock_count) - Number(b.stock_count));
    }, [items]);

    // 6. Peak Hours Analysis (Orders by Time of Day)
    const peakHoursData = useMemo(() => {
        if (!filteredOrders) return [];
        // Initialize 24 hours
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
            revenue: 0,
            count: 0
        }));

        filteredOrders.forEach(o => {
            // Must have a valid timestamp to extract time
            const ts = o.created_at || o.timestamp;
            if (ts) {
                const dateObj = new Date(ts);
                if (!isNaN(dateObj.getTime())) {
                    const h = dateObj.getHours();
                    hours[h].revenue += (o.total_amount || 0);
                    hours[h].count += 1;
                }
            }
        });

        // Optionally, filter out hours with zero activity to make chart cleaner, or keep all to show true gaps
        return hours.filter(h => h.revenue > 0 || h.count > 0);
    }, [filteredOrders]);

    // Export Logic
    const handleExportReport = async () => {
        setExporting(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Sales Report', { views: [{ rightToLeft: true, showGridLines: false }] });

            // Title
            ws.mergeCells('A1', 'E1');
            const titleCell = ws.getCell('A1');
            titleCell.value = `تقرير المبيعات - ${dateFilter === 'today' ? 'اليوم' : dateFilter === '7days' ? 'آخر 7 أيام' : dateFilter === 'month' ? 'هذا الشهر' : 'الكل'}`;
            titleCell.font = { name: 'Arial', size: 16, bold: true };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            ws.addRow([]);

            // KPI Table
            ws.addRow(['إجمالي الإيرادات', 'عدد الطلبات', 'متوسط الفاتورة']);
            ws.addRow([kpis.totalRevenue, kpis.totalOrders, kpis.avgOrderValue]);
            ws.getRow(3).font = { bold: true };
            ws.addRow([]);

            // Orders Table
            ws.addRow(['رقم الطلب', 'التاريخ', 'اسم العميل', 'الإجمالي']);
            ws.getRow(6).font = { bold: true };

            filteredOrders.forEach(o => {
                ws.addRow([
                    o.id || o.created_at,
                    (o.order_date || o.created_at || '').slice(0, 10),
                    o.customer_name || '—',
                    o.total_amount
                ]);
            });

            ws.columns = [
                { width: 20 }, { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }
            ];

            const buf = await wb.xlsx.writeBuffer();
            const blob = new Blob([buf], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Report_${dateFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Excel Export failed:', e);
            alert('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 bg-slate-50 min-h-screen">

            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Supervisor Dashboard</h2>
                    <p className="text-slate-500 font-medium">Overview of your sales performance and metrics.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                        <Calendar size={18} className="text-slate-400 mx-2" />
                        <select
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 py-2 pr-6 border-none outline-none cursor-pointer focus:ring-0"
                            dir="rtl"
                        >
                            <option value="today">اليوم</option>
                            <option value="7days">آخر 7 أيام</option>
                            <option value="month">هذا الشهر</option>
                            <option value="all">كل الأوقات</option>
                        </select>
                    </div>

                    <button
                        onClick={handleExportReport}
                        disabled={exporting}
                        className="flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-4 py-2.5 rounded-xl font-bold transition-colors border border-emerald-200 shadow-sm"
                    >
                        <Download size={18} />
                        {exporting ? 'تصدير...' : 'تصدير التقرير (Excel)'}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-emerald-600 shadow-inner">
                        <DollarSign size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Revenue</p>
                        <h3 className="text-3xl font-black text-slate-800">₪{Math.round(kpis.totalRevenue).toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-600 shadow-inner">
                        <ShoppingCart size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Orders</p>
                        <h3 className="text-3xl font-black text-slate-800">{kpis.totalOrders}</h3>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
                        <TrendingUp size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Order Value</p>
                        <h3 className="text-3xl font-black text-slate-800">₪{Math.round(kpis.avgOrderValue).toLocaleString()}</h3>
                    </div>
                </div>

                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-800 to-slate-900 rounded-3xl p-6 shadow-[0_8px_30px_rgb(99,102,241,0.25)] text-white flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(99,102,241,0.35)]">
                    {/* Glass highlight effect on the dark card */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

                    <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-indigo-300">
                        <Award size={24} strokeWidth={2.5} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-indigo-200/80 uppercase tracking-wider mb-1">Top Seller</p>
                        <h3 className="text-lg font-bold truncate" title={topSellers[0]?.name || 'N/A'}>
                            {topSellers[0]?.name || 'N/A'}
                        </h3>
                        <p className="text-sm text-indigo-200 mt-1">{topSellers[0]?.qty || 0} units sold</p>
                    </div>
                </div>

            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Bar Chart (7 Days) */}
                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] lg:col-span-2 flex flex-col gap-6 transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-slate-800">Revenue (Last 7 Days)</h3>
                        <p className="text-sm text-slate-500">Daily breakdown of total sales</p>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} tickFormatter={(str) => str.slice(5)} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(val) => `₪${val}`} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`₪${value}`, 'Revenue']}
                                    labelFormatter={(label) => `Date: ${label}`}
                                />
                                <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart (Categories) */}
                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col gap-6 transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-slate-800">Sales by Category</h3>
                        <p className="text-sm text-slate-500">Revenue distribution</p>
                    </div>
                    <div className="h-72 w-full flex items-center justify-center">
                        {pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => [`₪${value}`, 'Revenue']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-sm text-slate-400 font-medium">No category data available</div>
                        )}
                    </div>
                </div>

            </div>

            {/* Charts Row 2: Peak Hours */}
            <div className="bg-white/70 backdrop-blur-2xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col gap-6 mt-6 transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]">
                <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Clock size={20} className="text-indigo-500" />
                        ساعات الذروة (Peak Hours)
                    </h3>
                    <p className="text-sm text-slate-500">متى يقوم الزبائن بالشراء أكثر؟ (الإيرادات حسب ساعة اليوم)</p>
                </div>
                <div className="h-72 w-full">
                    {peakHoursData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={peakHoursData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(val) => `₪${val}`} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={10} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                    formatter={(value, name) => [name === 'revenue' ? `₪${value}` : value, name === 'revenue' ? 'الإيرادات' : 'عدد الطلبات']}
                                    labelFormatter={(label) => `الساعة: ${label}`}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Bar yAxisId="left" name="revenue" dataKey="revenue" fill="#ec4899" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                <Bar yAxisId="right" name="count" dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <Clock size={48} className="mb-4 opacity-20" />
                            <p>لا يوجد بيانات أوقات كافية لعرض ساعات الذروة</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Low Stock Alerts */}
            {lowStockItems.length > 0 && (
                <div className="bg-rose-50/70 backdrop-blur-xl border border-rose-100 rounded-3xl p-6 shadow-[0_8px_30px_rgb(225,29,72,0.06)] transition-all duration-300 hover:shadow-[0_12px_40px_rgb(225,29,72,0.12)]">
                    <div className="flex items-center gap-2 mb-4 text-rose-700">
                        <AlertTriangle size={24} strokeWidth={2.5} />
                        <h3 className="text-lg font-bold">تنبيه المخزون المنخفض (أقل من 3 قطع)</h3>
                    </div>
                    <div className="bg-white rounded-2xl overflow-hidden border border-rose-100">
                        <table className="w-full text-sm text-right" dir="rtl">
                            <thead className="bg-rose-50/50 text-rose-800 border-b border-rose-100">
                                <tr>
                                    <th className="py-3 px-4 font-bold w-20">صورة</th>
                                    <th className="py-3 px-4 font-bold">الصنف</th>
                                    <th className="py-3 px-4 font-bold">الكمية المتبقية</th>
                                    <th className="py-3 px-4 font-bold text-left">الباركود</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowStockItems.map(item => (
                                    <tr key={item.id} className="border-b border-rose-50 last:border-0 hover:bg-rose-50/30 transition-colors text-slate-700">
                                        <td className="py-3 px-4">
                                            {item.image ? (
                                                <img src={item.image.startsWith('http') ? item.image : `https://hytncdomjctqihrqfswh.supabase.co/storage/v1/object/public/item-images/${item.image}`} alt={item.name} loading="lazy" className="w-10 h-10 object-contain mix-blend-multiply rounded-md bg-slate-50 border border-slate-100 p-0.5" />
                                            ) : (
                                                <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-300">
                                                    <ShoppingCart size={16} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 font-semibold">{item.name || item.group || '—'}</td>
                                        <td className="py-3 px-4 font-black">
                                            <span className={`px-2.5 py-1 rounded-md ${Number(item.stock_count) === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {item.stock_count} قطع
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-left font-mono text-slate-500">{item.barcode}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}
