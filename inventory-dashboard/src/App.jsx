<<<<<<< HEAD
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { parseFile } from './utils/parseInventory';
import { sampleItems, sampleTotals } from './data/sampleInventory';
import { fetchInventoryFromSupabase } from './services/inventorySupabase';
import { isSupabaseConfigured } from './lib/supabase';
import DailySnapshot from './components/DailySnapshot';
import SummaryWidget from './components/SummaryWidget';
import CapsuleBarChart from './components/CapsuleBarChart';
import ItemGrid from './components/ItemGrid';

function useInventory() {
  const [items, setItems] = useState(sampleItems);
  const [totalValue, setTotalValue] = useState(sampleTotals.totalValue);
  const [totalQty, setTotalQty] = useState(sampleTotals.totalQty);
  const [loadedFile, setLoadedFile] = useState(null);
  const [dataSource, setDataSource] = useState('sample'); // 'sample' | 'supabase' | 'file'
  const [loading, setLoading] = useState(!!isSupabaseConfigured());
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    setError(null);
    fetchInventoryFromSupabase()
      .then(({ items: next, totalValue: tv, totalQty: tq }) => {
        setItems(next);
        setTotalValue(tv);
        setTotalQty(tq);
        setDataSource('supabase');
        setLoadedFile(null);
      })
      .catch((e) => setError(e.message || 'فشل تحميل البيانات من Supabase'))
      .finally(() => setLoading(false));
  }, []);

  const loadFile = useCallback((file) => {
    setError(null);
    if (!file) return;
    parseFile(file)
      .then(({ items: next, totalValue: tv, totalQty: tq }) => {
        const withValue = next.map((i) => ({
          ...i,
          value: (i.value ?? (i.qty || 0) * (i.price || 0)),
        }));
        setItems(withValue);
        setTotalValue(tv);
        setTotalQty(tq);
        setLoadedFile(file.name);
        setDataSource('file');
      })
      .catch((e) => setError(e.message || 'Failed to parse file'));
  }, []);

  const useSample = useCallback(() => {
    setItems(sampleItems);
    setTotalValue(sampleTotals.totalValue);
    setTotalQty(sampleTotals.totalQty);
    setLoadedFile(null);
    setDataSource('sample');
    setError(null);
  }, []);

  return {
    items,
    totalValue,
    totalQty,
    loadedFile,
    dataSource,
    loading,
    error,
    loadFile,
    useSample,
  };
}

export default function App() {
  const {
    items,
    totalValue,
    totalQty,
    loadedFile,
    dataSource,
    loading,
    error,
    loadFile,
    useSample,
  } = useInventory();

  const trend =
    dataSource === 'supabase'
      ? 'From Supabase'
      : loadedFile
        ? 'From your file'
        : 'Sample data';
  const snapshotLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-lavender" style={{ backgroundColor: '#F7F9FF' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero */}
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-slate-800">Hello, Developer!</h1>
          <p className="text-slate-500 mt-1">Inventory Status for January 2026</p>
          {loading && (
            <p className="mt-2 text-sm text-slate-600 bg-slate-100 rounded-card px-3 py-2 inline-block">
              جاري تحميل البيانات من Supabase…
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="rounded-card cursor-pointer bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:opacity-95 transition-opacity">
              <span>📂 Load Excel / CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={useSample}
              className="rounded-card border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-soft hover:bg-slate-50 transition-colors"
            >
              Use sample data
            </button>
            {loadedFile && (
              <span className="rounded-card bg-completed/30 px-3 py-2 text-sm text-green-700">
                ✓ {loadedFile}
              </span>
            )}
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 bg-alert/20 rounded-card px-3 py-2 inline-block">
              {error}
            </p>
          )}
        </motion.header>

        {/* Daily Snapshot + Summary widgets */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <DailySnapshot
            totalValue={totalValue}
            totalQty={totalQty}
            dateLabel={snapshotLabel}
          />
          <SummaryWidget
            label="Total Parts Count"
            value={totalQty.toLocaleString()}
            trend={trend}
            style="blue"
            delay={0.05}
          />
          <SummaryWidget
            label="Inventory Health"
            value="Stable"
            trend="Neutral"
            style="neutral"
            delay={0.1}
          />
        </div>

        {/* Capsule chart + content */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <CapsuleBarChart items={items} title="Stock Distribution Trends" maxBars={8} />
          </div>
          <div className="lg:col-span-3">
            <ItemGrid items={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
=======
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { parseFile } from './utils/parseInventory';
import { sampleItems, sampleTotals } from './data/sampleInventory';
import DailySnapshot from './components/DailySnapshot';
import SummaryWidget from './components/SummaryWidget';
import CapsuleBarChart from './components/CapsuleBarChart';
import ItemGrid from './components/ItemGrid';

function useInventory() {
  const [items, setItems] = useState(sampleItems);
  const [totalValue, setTotalValue] = useState(sampleTotals.totalValue);
  const [totalQty, setTotalQty] = useState(sampleTotals.totalQty);
  const [loadedFile, setLoadedFile] = useState(null);
  const [error, setError] = useState(null);

  const loadFile = useCallback((file) => {
    setError(null);
    if (!file) return;
    parseFile(file)
      .then(({ items: next, totalValue: tv, totalQty: tq }) => {
        const withValue = next.map((i) => ({
          ...i,
          value: (i.value ?? (i.qty || 0) * (i.price || 0)),
        }));
        setItems(withValue);
        setTotalValue(tv);
        setTotalQty(tq);
        setLoadedFile(file.name);
      })
      .catch((e) => setError(e.message || 'Failed to parse file'));
  }, []);

  const useSample = useCallback(() => {
    setItems(sampleItems);
    setTotalValue(sampleTotals.totalValue);
    setTotalQty(sampleTotals.totalQty);
    setLoadedFile(null);
    setError(null);
  }, []);

  return {
    items,
    totalValue,
    totalQty,
    loadedFile,
    error,
    loadFile,
    useSample,
  };
}

export default function App() {
  const {
    items,
    totalValue,
    totalQty,
    loadedFile,
    error,
    loadFile,
    useSample,
  } = useInventory();

  const trend = loadedFile ? 'From your file' : 'Sample data';
  const snapshotLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-lavender" style={{ backgroundColor: '#F7F9FF' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero */}
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-slate-800">Hello, Developer!</h1>
          <p className="text-slate-500 mt-1">Inventory Status for January 2026</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="rounded-card cursor-pointer bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:opacity-95 transition-opacity">
              <span>📂 Load Excel / CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={useSample}
              className="rounded-card border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-soft hover:bg-slate-50 transition-colors"
            >
              Use sample data
            </button>
            {loadedFile && (
              <span className="rounded-card bg-completed/30 px-3 py-2 text-sm text-green-700">
                ✓ {loadedFile}
              </span>
            )}
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 bg-alert/20 rounded-card px-3 py-2 inline-block">
              {error}
            </p>
          )}
        </motion.header>

        {/* Daily Snapshot + Summary widgets */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <DailySnapshot
            totalValue={totalValue}
            totalQty={totalQty}
            dateLabel={snapshotLabel}
          />
          <SummaryWidget
            label="Total Parts Count"
            value={totalQty.toLocaleString()}
            trend={trend}
            style="blue"
            delay={0.05}
          />
          <SummaryWidget
            label="Inventory Health"
            value="Stable"
            trend="Neutral"
            style="neutral"
            delay={0.1}
          />
        </div>

        {/* Capsule chart + content */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <CapsuleBarChart items={items} title="Stock Distribution Trends" maxBars={8} />
          </div>
          <div className="lg:col-span-3">
            <ItemGrid items={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
>>>>>>> fea0a82cfd606a9ad96144983f837e51af84636f
