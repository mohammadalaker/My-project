import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Award } from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

export default function Dashboard({ items, orders }) {
    // 1. Calculate General KPIs
    const kpis = useMemo(() => {
        if (!orders || orders.length === 0) {
            return { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
        }

        const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        return { totalRevenue, totalOrders, avgOrderValue };
    }, [orders]);

    // 2. Prepare Top Sellers
    const topSellers = useMemo(() => {
        if (!orders) return [];
        const counts = {};
        orders.forEach(o => {
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

    // 3. Prepare Bar Chart Data (Last 7 Days Revenue)
    const barChartData = useMemo(() => {
        if (!orders) return [];

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
        if (!orders) return [];
        const groupRev = {};

        orders.forEach(o => {
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
    }, [orders, items]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">

            {/* Header */}
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Supervisor Dashboard</h2>
                <p className="text-slate-500 font-medium">Overview of your sales performance and metrics.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <DollarSign size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
                        <h3 className="text-3xl font-black text-slate-800">₪{Math.round(kpis.totalRevenue).toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <ShoppingCart size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Orders</p>
                        <h3 className="text-3xl font-black text-slate-800">{kpis.totalOrders}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                        <TrendingUp size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Order Value</p>
                        <h3 className="text-3xl font-black text-slate-800">₪{Math.round(kpis.avgOrderValue).toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-900/20 text-white flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                        <Award size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Top Seller</p>
                        <h3 className="text-lg font-bold truncate" title={topSellers[0]?.name || 'N/A'}>
                            {topSellers[0]?.name || 'N/A'}
                        </h3>
                        <p className="text-sm text-slate-300 mt-1">{topSellers[0]?.qty || 0} units sold</p>
                    </div>
                </div>

            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Bar Chart (7 Days) */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/50 lg:col-span-2 flex flex-col gap-6">
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
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-6">
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

        </div>
    );
}
