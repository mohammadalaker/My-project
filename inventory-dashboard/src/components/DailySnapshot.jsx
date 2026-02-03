import { motion } from 'framer-motion';

export default function DailySnapshot({ totalValue, totalQty, dateLabel = 'Today' }) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalValue);

  return (
    <motion.div
      className="rounded-card bg-white p-6 shadow-soft-lg border border-white/80"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="text-sm font-medium text-slate-500 mb-1">Daily Snapshot</p>
      <p className="text-2xl font-bold text-primary">{formatted}</p>
      <p className="text-sm text-slate-400 mt-1">
        {totalQty.toLocaleString()} parts · {dateLabel}
      </p>
    </motion.div>
  );
}
