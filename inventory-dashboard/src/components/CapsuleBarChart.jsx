import { motion } from 'framer-motion';
import { getCategoryEmoji } from '../utils/categoryEmoji';

const PASTELS = [
  'bg-[#99D6FF]',  // pending blue
  'bg-[#99E6B3]',  // completed green
  'bg-[#E6B3F5]',  // lavender
  'bg-[#FFE699]',  // soft yellow
  'bg-[#99E6E6]',  // teal
  'bg-[#FFB399]',  // peach
];

export default function CapsuleBarChart({ items, maxBars = 10, title = 'Stock Distribution' }) {
  const sorted = [...(items || [])]
    .filter(i => i.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, maxBars);
  const maxQty = Math.max(1, ...sorted.map(i => i.qty));

  return (
    <motion.div
      className="rounded-card bg-white p-6 shadow-soft border border-white/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
      <div className="space-y-3">
        {sorted.map((item, i) => (
          <motion.div
            key={item.id}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * i }}
          >
            <span className="text-xl w-8 shrink-0" title={item.engName}>
              {getCategoryEmoji(item.engName)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{item.engName}</p>
              <div className="h-6 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                <motion.div
                  className={`h-full rounded-full ${PASTELS[i % PASTELS.length]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (item.qty / maxQty) * 100)}%` }}
                  transition={{ duration: 0.6, delay: 0.15 * i }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-600 w-10 text-right shrink-0">
              {item.qty}
            </span>
          </motion.div>
        ))}
      </div>
      {sorted.length === 0 && (
        <p className="text-slate-400 text-sm py-4 text-center">No quantity data to show.</p>
      )}
    </motion.div>
  );
}
