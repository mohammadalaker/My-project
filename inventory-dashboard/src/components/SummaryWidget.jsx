<<<<<<< HEAD
import { motion } from 'framer-motion';

const STYLES = {
  blue: 'bg-pending/40 text-primary border-pending/30',
  green: 'bg-completed/40 text-green-700 border-completed/30',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function SummaryWidget({ label, value, trend, style = 'blue', delay = 0 }) {
  return (
    <motion.div
      className={`rounded-card border p-5 shadow-soft ${STYLES[style] || STYLES.blue}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <p className="text-sm font-medium opacity-90">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {trend && <p className="text-xs mt-1 opacity-80">{trend}</p>}
    </motion.div>
  );
}
=======
import { motion } from 'framer-motion';

const STYLES = {
  blue: 'bg-pending/40 text-primary border-pending/30',
  green: 'bg-completed/40 text-green-700 border-completed/30',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function SummaryWidget({ label, value, trend, style = 'blue', delay = 0 }) {
  return (
    <motion.div
      className={`rounded-card border p-5 shadow-soft ${STYLES[style] || STYLES.blue}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <p className="text-sm font-medium opacity-90">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {trend && <p className="text-xs mt-1 opacity-80">{trend}</p>}
    </motion.div>
  );
}
>>>>>>> fea0a82cfd606a9ad96144983f837e51af84636f
