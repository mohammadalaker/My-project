import React, { useMemo } from 'react';
import { Search, Wallet, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';

/**
 * ذمم العملاء — قائمة بالرصيد والسقف وتجاوز الائتمان
 */
export default function CustomerArPanel({
  customers,
  loading,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onOpenLedger,
}) {
  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    let list = Array.isArray(customers) ? [...customers] : [];
    if (q) {
      list = list.filter((c) => {
        const name = `${c.company_name || ''} ${c.name || ''}`.toLowerCase();
        const phone = String(c.phone || '');
        return name.includes(q) || phone.includes(q);
      });
    }
    if (filter === 'debt') {
      list = list.filter((c) => Number(c.outstanding_debt || 0) > 0);
    } else if (filter === 'over') {
      list = list.filter((c) => {
        const debt = Number(c.outstanding_debt || 0);
        const lim = c.credit_limit;
        return lim != null && Number(lim) > 0 && debt > Number(lim);
      });
    }
    return list.sort((a, b) => Number(b.outstanding_debt || 0) - Number(a.outstanding_debt || 0));
  }, [customers, search, filter]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Wallet size={26} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">ذمم العملاء</h2>
            <p className="text-sm text-slate-600">Accounts Receivable — رصيد مديونية ودفعات</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:mr-auto">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'debt', label: 'عليهم رصيد' },
            { id: 'over', label: 'تجاوز السقف' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onFilterChange(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === t.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف..."
          className="w-full pr-12 pl-5 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-base"
        />
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
        {loading ? (
          <div className="p-16 flex items-center justify-center">
            <Loader2 size={40} className="animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((c) => {
                const debt = Number(c.outstanding_debt || 0);
                const lim = c.credit_limit != null ? Number(c.credit_limit) : null;
                const overLimit = lim != null && lim > 0 && debt > lim;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenLedger(c)}
                    className="text-right w-full rounded-2xl border-2 border-slate-100 bg-white p-4 sm:p-5 shadow-sm hover:shadow-lg hover:border-emerald-200 hover:bg-emerald-50/40 transition-all flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 font-black text-lg">
                      {(c.company_name || c.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{c.company_name || c.name || '—'}</p>
                      <p className="text-slate-500 text-sm font-mono">{c.phone || '—'}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold">
                          رصيد ₪{debt.toFixed(2)}
                        </span>
                        {lim != null && lim > 0 && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                            سقف ₪{lim.toFixed(0)}
                          </span>
                        )}
                        {overLimit && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
                            <AlertTriangle size={14} /> تجاوز السقف
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
            {!loading && filtered.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                لا يوجد عملاء مطابقون للفلتر الحالي.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
