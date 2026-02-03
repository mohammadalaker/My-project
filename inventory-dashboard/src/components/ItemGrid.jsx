<<<<<<< HEAD
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCategoryEmoji } from '../utils/categoryEmoji';

export default function ItemGrid({ items }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items || [];
    const q = search.toLowerCase().trim();
    return (items || []).filter(
      (i) =>
        (i.engName || '').toLowerCase().includes(q) ||
        String(i.qty).includes(q) ||
        String(i.price).includes(q)
    );
  }, [items, search]);

  return (
    <motion.div
      className="rounded-card bg-white p-6 shadow-soft border border-white/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-slate-700">Inventory items</h3>
        <input
          type="search"
          placeholder="Search by name, qty, price…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 hover:bg-white hover:shadow-soft transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{getCategoryEmoji(item.engName)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 truncate" title={item.engName}>
                    {item.engName}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Qty: {item.qty} × {typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : item.price} ={' '}
                    <span className="font-semibold text-primary">
                      ${(item.value ?? item.qty * (item.price || 0)).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {filtered.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">
          {items?.length ? 'No items match your search.' : 'Load an Excel/CSV or use sample data.'}
        </p>
      )}
    </motion.div>
  );
}
=======
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCategoryEmoji } from '../utils/categoryEmoji';

export default function ItemGrid({ items }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items || [];
    const q = search.toLowerCase().trim();
    return (items || []).filter(
      (i) =>
        (i.engName || '').toLowerCase().includes(q) ||
        String(i.qty).includes(q) ||
        String(i.price).includes(q)
    );
  }, [items, search]);

  return (
    <motion.div
      className="rounded-card bg-white p-6 shadow-soft border border-white/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-slate-700">Inventory items</h3>
        <input
          type="search"
          placeholder="Search by name, qty, price…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 hover:bg-white hover:shadow-soft transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{getCategoryEmoji(item.engName)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 truncate" title={item.engName}>
                    {item.engName}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Qty: {item.qty} × {typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : item.price} ={' '}
                    <span className="font-semibold text-primary">
                      ${(item.value ?? item.qty * (item.price || 0)).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {filtered.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">
          {items?.length ? 'No items match your search.' : 'Load an Excel/CSV or use sample data.'}
        </p>
      )}
    </motion.div>
  );
}
>>>>>>> fea0a82cfd606a9ad96144983f837e51af84636f
