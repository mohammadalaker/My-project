import React, { useState, useEffect, useCallback, useRef } from 'react';
import ExcelJS from 'exceljs';
import {
  Search,
  Plus,
  Trash2,
  Upload,
  X,
  Package,
  Loader2,
  Zap,
  Home,
  Plug,
  Power,
  Cable,
  Battery,
  BatteryCharging,
  PlugZap,
  Cpu,
  Utensils,
  UtensilsCrossed,
  ChefHat,
  Wine,
  Flame,
  Cookie,
  FileText,
  Grid,
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { BARCODE_ORDER, sortByBarcodeOrder } from './barcodeOrder';

const BUCKET = 'Pic_of_items';
const PAGE_SIZE = 250;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Returns public URL for image from bucket Pic_of_items; external http(s) URLs returned as-is. */
function getPublicImageUrl(imageValue) {
  if (!imageValue || typeof imageValue !== 'string') return null;
  const img = String(imageValue).trim();
  if (!img) return null;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const path = img.replace(/^\//, '');
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : img);
}

const ELECTRICAL_GROUPS = [
  'Tefal Electric', 'Tefal', 'Moulinex', 'Mounliex', 'Babyliss', 'Babyliss Pro', 'Kenwood', 'Braun',
  'KMG midea SDA', 'KMG midea VC', 'KMG ACE', 'KMG midea MWO',
].map((s) => s.trim().toLowerCase());

const isElectricalGroup = (g) =>
  g && ELECTRICAL_GROUPS.some((eg) => String(g).trim().toLowerCase() === eg);

/** Convert amount to English words (Shekels and Agoras) */
function amountToEnglishWords(amount) {
  const n = Math.max(0, Number(amount));
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function toWords(num) {
    if (num === 0) return '';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const o = num % 10;
      return tens[t] + (o > 0 ? '-' + ones[o] : '');
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      return ones[h] + ' Hundred' + (rest > 0 ? ' and ' + toWords(rest) : '');
    }
    if (num < 1000000) {
      const th = Math.floor(num / 1000);
      const rest = num % 1000;
      return toWords(th) + ' Thousand' + (rest > 0 ? ' ' + toWords(rest) : '');
    }
    if (num < 1000000000) {
      const m = Math.floor(num / 1000000);
      const rest = num % 1000000;
      return toWords(m) + ' Million' + (rest > 0 ? ' ' + toWords(rest) : '');
    }
    return String(num);
  }

  if (n === 0) return 'Zero Shekels';

  let str = toWords(intPart) + ' Shekel' + (intPart !== 1 ? 's' : '');
  if (decPart > 0) {
    str += ' and ' + toWords(decPart) + ' Agora' + (decPart !== 1 ? 's' : '');
  }
  return str + ' Only';
}

const ITEMS_SELECT = 'barcode, eng_name, brand_group, box_count, full_price, price_after_disc, stock_count, image_url';

function normalizeItemFromSupabase(row) {
  if (!row) return null;
  const barcodeStr = String(row.barcode ?? '').trim();
  return {
    id: barcodeStr,
    barcode: barcodeStr,
    name: (row.eng_name ?? '').toString().trim(),
    group: (row.brand_group ?? '').toString().trim(),
    box: row.box_count != null && row.box_count !== '' ? String(row.box_count) : '',
    price: Number(row.full_price) || 0,
    priceAfterDiscount: Number(row.price_after_disc) || Number(row.full_price) || 0,
    stock: row.stock_count,
    image: (row.image_url ?? '').toString().trim() || null,
  };
}

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showCatalogPanel, setShowCatalogPanel] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [orderInfo, setOrderInfo] = useState(() => ({
    companyName: '',
    merchantName: '',
    phone: '',
    address: '',
    orderDate: new Date().toISOString().slice(0, 10),
    customerNumber: '',
    paymentMethod: '',
    checksCount: '',
  }));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    barcode: '',
    brand_group: '',
    eng_name: '',
    box_count: '',
    full_price: '',
    price_after_disc: '',
    stock_count: '',
    image_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const setOrderInfoField = (key, value) =>
    setOrderInfo((prev) => ({ ...prev, [key]: value }));

  const fetchItems = useCallback(
    async (reset = false) => {
      const from = reset ? 0 : page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      if (!reset && fetchingFromRef.current === from) return;
      fetchingFromRef.current = from;

      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        let query = supabase
          .from('items')
          .select(ITEMS_SELECT)
          .order('brand_group', { ascending: true })
          .order('eng_name', { ascending: true })
          .range(from, to);
        if (search.trim()) {
          query = query.or(
            `eng_name.ilike.%${search.trim()}%,barcode.ilike.%${search.trim()}%`
          );
        }
        const { data, error } = await query;
        if (error) throw error;
        const normalized = (data || []).map(normalizeItemFromSupabase).filter(Boolean);
        if (reset) {
          setItems(normalized);
          setPage(0);
          fetchingFromRef.current = null;
        } else {
          setItems((prev) => {
            const existingIds = new Set((prev || []).map((i) => String(i.barcode || i.id || '').trim()));
            const newItems = normalized.filter((n) => !existingIds.has(String(n.barcode || n.id || '').trim()));
            return newItems.length ? [...prev, ...newItems] : prev;
          });
        }
        const more = (data?.length || 0) === PAGE_SIZE;
        setHasMore(more);
        if (more) setPage((p) => p + 1);
      } catch (err) {
        console.error('Supabase fetch error:', err);
        setItems([]);
      } finally {
        fetchingFromRef.current = null;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [page, search]
  );

  useEffect(() => {
    const debounce = setTimeout(() => fetchItems(true), 80);
    return () => clearTimeout(debounce);
  }, [search]);

  useEffect(() => {
    if (!search && page === 0) fetchItems(true);
  }, []);

  useEffect(() => {
    if (page > 0) fetchItems(false);
  }, [page]);

  const loadMore = () => {
    if (!loadingMore && hasMore) setPage((p) => p + 1);
  };

  const loadMoreRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fetchingFromRef = useRef(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!el || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: root || null, rootMargin: '200px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, items.length]);

  const filteredByGroup =
    selectedGroup == null
      ? items
      : selectedGroup === '__electrical__'
        ? items.filter((i) => isElectricalGroup(i.group))
        : selectedGroup === '__home__'
          ? items.filter((i) => !isElectricalGroup(i.group))
          : items.filter((i) => i.group === selectedGroup);

  const filteredItems = search.trim()
    ? filteredByGroup.filter(
      (i) =>
        (i.name || '').toLowerCase().includes(search.trim().toLowerCase()) ||
        (i.barcode || '').toString().includes(search.trim())
    )
    : filteredByGroup;

  const allGroups = [...new Set(items.map((i) => i.group).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
  const electricalGroups = allGroups.filter(isElectricalGroup);
  const electricalGroupsSorted = [...electricalGroups].sort((a, b) => {
    const ia = ELECTRICAL_GROUPS.indexOf(String(a).trim().toLowerCase());
    const ib = ELECTRICAL_GROUPS.indexOf(String(b).trim().toLowerCase());
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return String(a).localeCompare(String(b));
  });
  const electricalIcons = [Zap, Plug, Power, Cable, Battery, BatteryCharging, PlugZap, Cpu];
  const kitchenwareGroups = allGroups.filter((g) => !isElectricalGroup(g));
  const kitchenwareGroupsSorted = [...kitchenwareGroups];
  const kitchenwareIcons = [Home, Utensils, UtensilsCrossed, ChefHat, Wine, Flame, Cookie, Package];

  /** In stock if qty > 0, else Out of Stock */
  const getStockStatus = (item) => {
    const s = item?.stock;
    if (s == null || s === '') return 'Out of Stock';
    const n = Number(s);
    if (isNaN(n) || n <= 0) return 'Out of Stock';
    return 'In Stock';
  };

  const getStockByBoxes = (item) => {
    const s = item?.stock;
    const box = item?.box;
    if (s == null || s === '') return { text: '—', hasStock: false };
    const stockNum = Number(s);
    if (isNaN(stockNum)) return { text: '—', hasStock: false };
    const hasStock = stockNum >= 1;
    if (stockNum <= 0) return { text: '—', hasStock: false };
    const boxNum = box != null && String(box).trim() !== '' && !isNaN(Number(box)) ? Math.max(1, Math.round(Number(box))) : null;
    if (boxNum != null && boxNum > 0) {
      const boxesCount = Math.floor(stockNum / boxNum);
      const plural = boxesCount === 1 ? 'Box' : 'Boxes';
      return { text: `${boxesCount} ${plural}`, hasStock };
    }
    return { text: `${stockNum} Pcs`, hasStock };
  };

  const getImage = (item) => getPublicImageUrl(item?.image);

  /* Catalog Helpers */


  const addToOrder = useCallback((item, qty = 1) => {
    setOrderItems((prev) => {
      const unitPrice = Math.round(item.priceAfterDiscount ?? item.price ?? 0);
      const box = item.box != null && String(item.box).trim() ? String(item.box).trim() : null;
      const qtyFromBox =
        box && !isNaN(Number(box)) ? Math.max(1, Math.round(Number(box))) : 1;
      const i = prev.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [
        ...prev,
        { id: item.id, qty: qtyFromBox, unitPrice, box, item },
      ];
    });
  }, []);

  const removeFromOrder = (itemId) =>
    setOrderItems((prev) => prev.filter((x) => x.id !== itemId));

  const setOrderQty = (itemId, qty) => {
    const n = Math.max(0, parseInt(qty, 10) || 0);
    if (n === 0) setOrderItems((prev) => prev.filter((x) => x.id !== itemId));
    else setOrderItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, qty: n } : x)));
  };

  const setOrderLinePrice = (itemId, value) => {
    const n = parseFloat(String(value).replace(',', '.')) || 0;
    setOrderItems((prev) =>
      prev.map((x) =>
        x.id === itemId ? { ...x, unitPrice: Math.max(0, Math.round(n)) } : x
      )
    );
  };

  const clearOrder = () => setOrderItems([]);

  const orderLines = orderItems
    .map((o) => ({ ...o, item: items.find((i) => i.id === o.id) }))
    .filter((o) => o.item);

  const getLineBox = (o) =>
    o.box ?? (o.item?.box != null ? String(o.item.box) : '—');
  const getLineUnitPrice = (o) =>
    o.unitPrice ?? Math.round(o.item?.priceAfterDiscount ?? o.item?.price ?? 0);
  const getLineOriginalPrice = (o) =>
    Number(o.item?.price) ?? 0;
  const getLineDiscountPercent = (o) => {
    const orig = getLineOriginalPrice(o);
    const after = getLineUnitPrice(o);
    if (orig <= 0 || after >= orig) return 0;
    return Math.round(((orig - after) / orig) * 100);
  };
  const getLineTotal = (o) =>
    Math.max(0, getLineUnitPrice(o) * (o.qty || 0));
  const orderTotal = orderLines.reduce((s, o) => s + getLineTotal(o), 0);

  const orderLinesByBox = [...orderLines].sort((a, b) =>
    String(getLineBox(a)).localeCompare(String(getLineBox(b)), undefined, {
      numeric: true,
    })
  );

  /* Catalog State */
  const [mode, setMode] = useState('order'); // 'order' or 'catalog'


  const getPrintHtml = useCallback(() => {
    const rows = orderLines
      .map((o) => {
        const unitPrice = getLineUnitPrice(o);
        const total = getLineTotal(o);
        const price = Number(o.item?.price) ?? 0;
        const discPercent = getLineDiscountPercent(o);
        const imgSrc = getImage(o.item);
        const imgHtml = imgSrc
          ? `<img src="${String(imgSrc).replace(/"/g, '&quot;')}" alt="" style="width:40px;height:40px;object-fit:contain;" />`
          : '';
        return `<tr><td>${imgHtml}</td><td dir="ltr" lang="en">${(o.item?.barcode || '').replace(/</g, '&lt;')}</td><td dir="ltr" lang="en">${o.qty}</td><td dir="ltr" lang="en">₪${price}</td><td dir="ltr" lang="en">₪${unitPrice}</td><td dir="ltr" lang="en">${discPercent}%</td><td dir="ltr" lang="en">₪${total.toFixed(2)}</td></tr>`;
      })
      .join('');
    const infoRows = [
      ['Company Name', orderInfo.companyName],
      ['Customer No.', orderInfo.customerNumber],
      ['Merchant Name', orderInfo.merchantName],
      ['Phone', orderInfo.phone],
      ['Address', orderInfo.address],
      ['Date', orderInfo.orderDate],
      ['Payment Method', orderInfo.paymentMethod],
    ]
      .map(
        ([l, v]) =>
          `<tr><td class="info-label">${l}</td><td class="info-value" dir="ltr" lang="en">${(v || '').replace(/</g, '&lt;')}</td></tr>`
      )
      .join('');
    return `<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><title>Sales Order Agreement</title>
<style>body{font-family:system-ui;padding:24px;max-width:800px;margin:0 auto}.print-title{font-size:2rem;font-weight:800;text-align:center;color:#c2410c}.section-title{font-weight:700;padding:8px 12px;background:#fff7ed;border:1px solid #ea580c;border-radius:6px;color:#c2410c;margin:1rem 0 0.5rem}.info-table{width:100%;border-collapse:collapse}.info-table td{padding:8px 12px;border:1px solid #d1d5db}.info-label{font-weight:600;background:#fff7ed;width:40%}.info-value{background:#fff}table.data-table{width:100%;border-collapse:collapse;margin-top:1rem}table.data-table th,table.data-table td{padding:10px;border:1px solid #d1d5db;text-align:left}table.data-table th{background:#ea580c;color:#fff}.total-row{font-weight:700;background:#fff7ed}</style></head><body>
<h1 class="print-title">Sales Order Agreement</h1>
<div class="section-title">Customer Information</div>
<table class="info-table"><tbody>${infoRows}</tbody></table>
<div class="section-title">Item Details</div>
<table class="data-table"><thead><tr><th>Image</th><th>Barcode</th><th>Qty</th><th>Price</th><th>Discounted</th><th>Discount %</th><th>Total</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="5"></td><td>Total</td><td dir="ltr" lang="en">₪${orderTotal.toFixed(2)}</td></tr></tbody></table></body></html>`;
  }, [orderLines, orderTotal, orderInfo]);

  const getInventoryHtml = useCallback(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const safeSrc = (s) => {
      if (!s) return '';
      const str = String(s);
      return str.startsWith('data:')
        ? str
        : str.startsWith('/')
          ? origin + str
          : str;
    };
    const sortedLines = sortByBarcodeOrder(orderLines, BARCODE_ORDER);
    const cards = sortedLines
      .map((o, idx) => {
        const total = getLineTotal(o);
        const unitPrice = getLineUnitPrice(o);
        const discPercent = getLineDiscountPercent(o);
        const imgSrc = getImage(o.item);
        const imgHtml = imgSrc
          ? `<div class="inv-img"><img src="${safeSrc(imgSrc)}" alt="" /></div>`
          : '<div class="inv-img"><span class="inv-no-img">📦</span></div>';
        const name = (o.item?.name || '').replace(/</g, '&lt;').slice(0, 40);
        return `<article class="inv-card">
          <span class="inv-num" dir="ltr" lang="en">${idx + 1}</span>
          ${imgHtml}
          <div class="inv-details">
            ${name ? `<div class="inv-name">${name}</div>` : ''}
            <div class="inv-barcode">${(o.item?.barcode || '—').replace(/</g, '&lt;')}</div>
            <div class="inv-meta">
              <span class="inv-price" dir="ltr" lang="en">₪${unitPrice}</span>
              <span class="inv-qty" dir="ltr" lang="en">× ${o.qty}</span>
              ${discPercent > 0 ? `<span class="inv-disc" dir="ltr" lang="en">Discount ${discPercent}%</span>` : ''}
            </div>
          </div>
          <div class="inv-total" dir="ltr" lang="en">₪${total.toFixed(2)}</div>
        </article>`;
      })
      .join('');
    const cust = (orderInfo.companyName || orderInfo.merchantName || '—').replace(/</g, '&lt;');
    const date = (orderInfo.orderDate || '—').replace(/</g, '&lt;');
    return `<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Selected Items</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;padding:28px;max-width:720px;margin:0 auto;background:linear-gradient(160deg,#f8faff 0%,#f1f5f9 50%,#e2e8f0 100%);min-height:100vh}
.inv-wrap{background:#fff;border-radius:24px;box-shadow:0 20px 60px -15px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.04);padding:32px;overflow:hidden}
.inv-header{background:linear-gradient(135deg,#ea580c 0%,#f97316 50%,#fb923c 100%);color:#fff;padding:28px 24px;text-align:center;border-radius:16px;margin-bottom:24px;box-shadow:0 10px 30px -5px rgba(234,88,12,.4)}
.inv-title{font-size:1.75rem;font-weight:800;margin:0;letter-spacing:-0.02em}
.inv-sub{font-size:.9rem;opacity:.9;margin-top:6px}
.inv-info{display:flex;gap:16px;flex-wrap:wrap;padding:16px 20px;background:#f8fafc;border-radius:12px;margin-bottom:24px;font-size:.95rem;color:#475569;border:1px solid #e2e8f0}
.inv-info span{font-weight:600;color:#334155}
.inv-cards{display:flex;flex-direction:column;gap:14px}
.inv-card{display:flex;align-items:center;gap:16px;padding:16px 20px;background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:box-shadow .2s}
.inv-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
.inv-num{min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);color:#64748b;font-weight:700;font-size:.8rem;border-radius:8px}
.inv-img{width:64px;height:64px;flex-shrink:0;border-radius:12px;overflow:hidden;background:linear-gradient(145deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center}
.inv-img img{width:100%;height:100%;object-fit:contain;padding:4px}
.inv-no-img{font-size:1.8rem;opacity:.5}
.inv-details{flex:1;min-width:0}
.inv-name{font-weight:600;color:#1e293b;font-size:.95rem;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inv-barcode{font-family:ui-monospace,monospace;font-size:.8rem;color:#64748b;font-weight:600}
.inv-meta{display:flex;gap:12px;align-items:center;margin-top:8px;flex-wrap:wrap}
.inv-price{font-weight:700;color:#ea580c;font-size:1rem}
.inv-qty{font-size:.85rem;color:#64748b}
.inv-disc{font-size:.75rem;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-weight:600}
.inv-total{font-weight:800;font-size:1.15rem;color:#ea580c;white-space:nowrap}
.inv-total-card{background:linear-gradient(135deg,#fff7ed,#ffedd5);border:2px solid #ea580c;border-radius:16px;padding:20px 24px;margin-top:24px;display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:1.25rem;color:#c2410c;box-shadow:0 4px 12px rgba(234,88,12,.15)}
.btn-print{padding:14px 32px;background:linear-gradient(135deg,#ea580c,#f97316);color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:1rem;margin-top:20px;display:block;margin-left:auto;margin-right:auto;box-shadow:0 4px 14px rgba(234,88,12,.35);transition:transform .15s,box-shadow .15s}
.btn-print:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(234,88,12,.4)}
@media print{body{background:#fff;padding:16px}.inv-wrap{box-shadow:none;border:1px solid #e2e8f0}.btn-print{display:none}.inv-card:hover{box-shadow:none}}
</style></head><body>
<div class="inv-wrap">
  <div class="inv-header"><h1 class="inv-title">Selected Items</h1><p class="inv-sub">Selected Products</p></div>
  <div class="inv-info"><span>Client:</span> ${cust} &nbsp;|&nbsp; <span>Phone:</span> <span dir="ltr" lang="en">${(orderInfo.phone || '—').replace(/</g, '&lt;')}</span> &nbsp;|&nbsp; <span>Date:</span> <span dir="ltr" lang="en">${date}</span>${orderInfo.paymentMethod === 'Checks' && orderInfo.checksCount ? ` &nbsp;|&nbsp; <span>Checks:</span> <span dir="ltr" lang="en">${String(orderInfo.checksCount).replace(/</g, '&lt;')}</span>` : ''}</div>
  <div class="inv-cards">${cards}</div>
  <div class="inv-total-card"><span>Total</span><span dir="ltr" lang="en">₪${orderTotal.toFixed(2)}</span></div>
  <button class="btn-print" onclick="window.print()">Print</button>
</div></body></html>`;
  }, [orderLines, orderTotal, orderInfo]);

  const handlePrintOrder = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(getPrintHtml());
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  const handleExportExcel = useCallback(async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sales Order', { views: [{ rightToLeft: false }] });
    const colors = {
      primary: 'FFea580c',
      primaryDark: 'FFc2410c',
      light: 'FFfff7ed',
      lightAlt: 'FFffedd5',
      border: 'FFe2e8f0',
      borderDark: 'FFcbd5e1',
      white: 'FFFFFFFF',
      textDark: 'FF1e293b',
      textMuted: 'FF64748b',
      success: 'FFdcfce7',
      successText: 'FF15803d',
    };
    const thin = { style: 'thin', color: { argb: colors.border } };
    const border = (c) => {
      c.border = { top: thin, left: thin, bottom: thin, right: thin };
    };
    const styleCell = (cell, opts = {}) => {
      if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
      if (opts.font) cell.font = opts.font;
      if (opts.alignment) cell.alignment = opts.alignment;
      border(cell);
    };
    ws.addRow(['Sales Order Agreement']);
    ws.getCell(1, 1).font = { bold: true, size: 20, color: { argb: colors.white } };
    ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(1, 1, 1, 7);
    ws.getRow(1).height = 36;
    let r = 3;
    ws.getCell(r, 1).value = 'Customer Customer';
    ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: colors.primary } };
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    ws.mergeCells(r, 1, r, 7);
    ws.getCell(r, 1).alignment = { horizontal: 'left' };
    border(ws.getCell(r, 1));
    r++;
    const excelInfoRows = [['Company Name', orderInfo.companyName], ['Merchant Name', orderInfo.merchantName], ['Phone', orderInfo.phone], ['Address', orderInfo.address], ['Date', orderInfo.orderDate], ['Payment Method', orderInfo.paymentMethod], ...(orderInfo.paymentMethod === 'Checks' && orderInfo.checksCount ? [['Checks Count', orderInfo.checksCount]] : [])];
    excelInfoRows.forEach(([l, v], i) => {
      ws.getCell(r, 1).value = l;
      ws.getCell(r, 2).value = v || '';
      styleCell(ws.getCell(r, 1), { fill: i % 2 === 0 ? colors.light : colors.lightAlt, font: { bold: true, color: { argb: colors.textDark } }, alignment: { horizontal: 'left' } });
      styleCell(ws.getCell(r, 2), { fill: colors.white, font: { color: { argb: colors.textDark } }, alignment: { horizontal: 'left' } });
      ws.mergeCells(r, 2, r, 7);
      r++;
    });
    r += 1;
    ws.getCell(r, 1).value = 'Item Details';
    ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: colors.primary } };
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    ws.mergeCells(r, 1, r, 7);
    ws.getCell(r, 1).alignment = { horizontal: 'left' };
    border(ws.getCell(r, 1));
    r++;
    const headers = ['Name', 'Barcode', 'Qty', 'Price', 'Discounted', 'Discount %', 'Total'];
    headers.forEach((h, c) => {
      ws.getCell(r, c + 1).value = h;
      styleCell(ws.getCell(r, c + 1), { fill: colors.primary, font: { bold: true, color: { argb: colors.white }, size: 11 }, alignment: { horizontal: 'center', vertical: 'middle' } });
    });
    ws.getRow(r).height = 24;
    r++;
    const sortedLines = sortByBarcodeOrder(orderLines, BARCODE_ORDER);
    sortedLines.forEach((o, i) => {
      const discPct = getLineDiscountPercent(o);
      ws.getCell(r, 1).value = (o.item?.name || '').slice(0, 50);
      ws.getCell(r, 2).value = o.item?.barcode || '';
      ws.getCell(r, 3).value = o.qty;
      ws.getCell(r, 4).value = Number(o.item?.price) ?? 0;
      ws.getCell(r, 5).value = getLineUnitPrice(o);
      ws.getCell(r, 6).value = discPct > 0 ? discPct + '%' : '—';
      ws.getCell(r, 7).value = parseFloat(getLineTotal(o).toFixed(2));
      const rowFill = i % 2 === 0 ? colors.white : 'FFF8fafc';
      for (let c = 1; c <= 7; c++) {
        const cell = ws.getCell(r, c);
        styleCell(cell, {
          fill: rowFill,
          font: c === 7 ? { bold: true, color: { argb: colors.primary } } : { color: { argb: colors.textDark } },
          alignment: c <= 2 ? { horizontal: 'left' } : { horizontal: 'center' },
        });
      }
      r++;
    });
    ws.getCell(r, 1).value = '';
    ws.getCell(r, 5).value = 'Total';
    ws.getCell(r, 7).value = parseFloat(orderTotal.toFixed(2));
    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(r, c);
      styleCell(cell, {
        fill: colors.light,
        font: c >= 5 ? { bold: true, size: 12, color: { argb: colors.primary } } : {},
        alignment: c === 5 ? { horizontal: 'right' } : c === 7 ? { horizontal: 'center' } : {},
      });
    }
    ws.getRow(r).height = 28;
    ws.getColumn(1).width = 32;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 10;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 12;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 14;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Order-${(orderInfo.companyName || orderInfo.merchantName || 'Order').replace(/[/\\:*?"<>|]/g, '')}-${orderInfo.orderDate || new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [orderLines, orderTotal, orderInfo]);

  const handleOpenInventory = () => {
    const html = getInventoryHtml();
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      barcode: '',
      brand_group: '',
      eng_name: '',
      box_count: '',
      full_price: '',
      price_after_disc: '',
      stock_count: '',
      image_url: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      barcode: item.barcode || '',
      brand_group: item.group || '',
      eng_name: item.name || '',
      box_count: item.box ?? '',
      full_price: item.price ?? '',
      price_after_disc: item.priceAfterDiscount ?? '',
      stock_count: item.stock ?? '',
      image_url: item.image || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        barcode: formData.barcode.trim(),
        brand_group: formData.brand_group.trim() || null,
        eng_name: formData.eng_name.trim() || null,
        box_count: formData.box_count ? parseInt(formData.box_count, 10) : null,
        full_price: formData.full_price ? parseFloat(formData.full_price) : null,
        price_after_disc: formData.price_after_disc
          ? parseFloat(formData.price_after_disc)
          : null,
        stock_count: formData.stock_count ? parseInt(formData.stock_count, 10) : 0,
        image_url: formData.image_url.trim() || null,
      };
      if (editingItem) {
        await supabase.from('items').update(payload).eq('barcode', editingItem.barcode);
      } else {
        await supabase.from('items').insert(payload);
      }
      setModalOpen(false);
      fetchItems(true);
    } catch (err) {
      alert(err.message || 'Save failed');
    }
  };

  const handleDelete = async (barcode) => {
    if (!confirm('Delete this item?')) return;
    try {
      await supabase.from('items').delete().eq('barcode', barcode);
      setItems((prev) => prev.filter((i) => i.barcode !== barcode));
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  const fileInputRef = useRef(null);

  const handleImageUpload = async (e, item) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!item.barcode) {
      alert('الباركود مفقود!');
      return;
    }

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${item.barcode}.${ext}`;
      const filePath = `${fileName}`;

      setUploading(true); // Assuming you have this state

      // 1. Upload/Upsert the file
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get Public URL (Force cache bust by appending timestamp)
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const publicUrl = `${data.publicUrl}?t=${new Date().getTime()}`;

      // 3. Update Item in DB
      const { error: dbError } = await supabase
        .from('items')
        .update({ image_url: fileName }) // Store filename, or publicUrl if you prefer
        .eq('barcode', item.barcode);

      if (dbError) throw dbError;

      // 4. Update Local State
      setItems((prev) =>
        prev.map((i) =>
          i.barcode === item.barcode ? { ...i, image: fileName } : i
        )
      );

      // Force UI refresh if needed (rarely needed if state updates correctly)
    } catch (err) {
      console.error('Upload Error:', err);
      alert('فشل رفع الصورة: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      e.target.value = '';
    }
  };

  const getCatalogHtml = useCallback((items) => {
    const cards = items.map(item => {
      const imgUrl = getPublicImageUrl(item.image);
      const img = imgUrl
        ? `<div class="cat-img"><img src="${imgUrl}" alt="${item.name}" /></div>`
        : `<div class="cat-img"><div class="cat-no-img">📦</div></div>`;

      return `
        <div class="cat-card">
          ${img}
          <div class="cat-info">
            <div class="cat-name">${item.name}</div>
            <div class="cat-barcode">${item.barcode}</div>
            <div class="cat-price">₪${item.price ?? 0}</div>
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
<meta charset="utf-8">
<title>Product Catalog</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; background: #fff; }
  .cat-header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
  .cat-title { font-size: 2.5rem; color: #1e293b; margin: 0; }
  .cat-sub { font-size: 1.1rem; color: #64748b; margin-top: 5px; }
  
  .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
  
  .cat-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; page-break-inside: avoid; background: #fff; }
  .cat-img { height: 200px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px; }
  .cat-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .cat-no-img { font-size: 3rem; opacity: 0.3; }
  
  .cat-info { padding: 16px; text-align: center; }
  .cat-name { font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 8px; line-height: 1.4; height: 2.8em; overflow: hidden; }
  .cat-barcode { font-family: monospace; color: #64748b; font-size: 0.9rem; margin-bottom: 8px; }
  .cat-price { color: #ea580c; font-weight: 700; font-size: 1.2rem; }

  @media print {
    body { padding: 0; }
    .cat-grid { gap: 16px; }
    .cat-card { border: 1px solid #ddd; }
  }
</style>
</head>
<body>
  <div class="cat-header">
    <h1 class="cat-title">Product Catalog</h1>
    <p class="cat-sub">${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
  <div class="cat-grid">
    ${cards}
  </div>
    <script>window.print();</script>
</body>
</html>`;
  }, []);

  const addToCatalog = (item) => {
    setCatalogItems(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeFromCatalog = (id) => {
    setCatalogItems(prev => prev.filter(i => i.id !== id));
  };

  const clearCatalog = () => {
    if (window.confirm('Clear all items from catalog?')) {
      setCatalogItems([]);
    }
  };

  const handlePrintCatalog = useCallback(() => {
    if (catalogItems.length === 0) return;
    const html = getCatalogHtml(catalogItems);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }, [catalogItems, getCatalogHtml]);

  const handleRemoveImage = async () => {
    if (!formData.image_url) return;
    if (!confirm('Are you sure you want to permanently delete this image?')) return;

    try {
      const urlObj = new URL(formData.image_url);
      const pathPart = urlObj.pathname.split(`/${BUCKET}/`)[1];
      const probablePath = `${formData.barcode.trim()}.${formData.image_url.split('.').pop()?.split('?')[0]}`;
      if (probablePath) {
        await supabase.storage.from(BUCKET).remove([probablePath]);
      }
    } catch (e) {
      console.warn('Could not delete file from storage', e);
    }
    setFormData((p) => ({ ...p, image_url: '' }));
    if (editingItem?.barcode) {
      try {
        await supabase.from('items').update({ image_url: null }).eq('barcode', editingItem.barcode);
        setItems((prev) =>
          prev.map((i) => (i.barcode === editingItem.barcode ? { ...i, image: null } : i))
        );
        setEditingItem((prev) => (prev ? { ...prev, image: null } : null));
      } catch (err) {
        alert(err?.message || 'Failed to delete image');
      }
    }
  };

  return (
    <div
      className={`font-sans flex h-screen overflow-hidden ${showOrderPanel ? 'flex-row min-h-0' : 'flex-col'}`}
    >
      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden ${showOrderPanel ? 'p-3 sm:p-4' : 'p-4 sm:p-6 lg:p-8'}`}
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8 bg-[var(--header-bg)] backdrop-blur-xl border-b border-slate-200/60 z-20 shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset]">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${mode === 'catalog' ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-rose-500/25' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/25'}`}>
                  {mode === 'catalog' ? <Grid className="text-white" size={22} /> : <Package className="text-white" size={22} />}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">{mode === 'catalog' ? 'Catalog Creator' : 'Warehouse Management System'}</h1>
                  <p className="text-slate-500 text-xs mt-0.5 hidden sm:block">
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <span className="w-px h-8 bg-slate-200/80 shrink-0 hidden sm:block" aria-hidden />

            </div>
          </header>
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pt-6 scroll-smooth">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="animate-spin text-indigo-500" size={44} />
                <p className="text-slate-500 text-sm font-medium">Loading items...</p>
              </div>
            ) : (
              <div className="pb-8 space-y-12">
                {[
                  { title: 'Electrical Appliances', items: filteredItems.filter((i) => isElectricalGroup(i.group)), color: 'indigo' },
                  { title: 'Kitchenware', items: filteredItems.filter((i) => !isElectricalGroup(i.group)), color: 'sky' },
                ].map(({ title, items: sectionItems, color }) => {
                  const sorted = sortByBarcodeOrder(sectionItems, BARCODE_ORDER);
                  if (sorted.length === 0) return null;
                  return (
                    <section key={title}>
                      <h2 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-3 px-1">
                        <span className={`w-1.5 h-7 rounded-full ${color === 'indigo' ? 'bg-indigo-500' : 'bg-sky-500'}`} />
                        <span>{title}</span>
                        <span className="text-slate-400 font-normal text-sm">({sorted.length})</span>
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-1">
                        {sorted.map((item) => (
                          <div key={item.id} className="group relative bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                            <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors z-10" />
                              {getImage(item) ? (
                                <img
                                  src={getImage(item)}
                                  alt={item.name}
                                  className="w-full h-full object-contain p-6 transition-transform duration-500 group-hover:scale-110 mix-blend-multiply"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`absolute inset-0 flex items-center justify-center ${getImage(item) ? 'hidden' : ''}`}>
                                <Package size={48} className="text-slate-300/80" />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); document.getElementById(`file-${item.barcode}`).click(); }}
                                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-xl bg-white/90 backdrop-blur-sm shadow-sm border border-slate-200/60 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-200"
                              >
                                <Camera size={16} />
                              </button>
                              {item.image && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteImage(item); }}
                                  className="absolute top-3 left-3 z-20 w-8 h-8 rounded-xl bg-white/90 backdrop-blur-sm shadow-sm border border-slate-200/60 flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-200 delay-75"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              <input
                                type="file"
                                id={`file-${item.barcode}`}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, item)}
                              />
                              <div className={`absolute bottom-3 right-3 z-10 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm backdrop-blur-md ${getStockStatus(item) === 'In Stock'
                                ? 'bg-emerald-500/90 text-white'
                                : 'bg-slate-900/60 text-white'
                                }`}>
                                {getStockStatus(item)}
                              </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col min-h-[140px]">
                              {mode === 'catalog' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (catalogItems.some((i) => i.id === item.id)) {
                                      removeFromCatalog(item.id);
                                    } else {
                                      addToCatalog(item);
                                    }
                                  }}
                                  className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold shrink-0 transition-all duration-200 flex items-center justify-center gap-2 ${catalogItems.some((i) => i.id === item.id)
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                    : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                    }`}
                                >
                                  {catalogItems.some((i) => i.id === item.id) ? (
                                    <>
                                      <Trash2 size={16} />
                                      Remove from Catalog
                                    </>
                                  ) : (
                                    <>
                                      <FileText size={16} />
                                      Add to Catalog
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToOrder(item, 1);
                                  }}
                                  className="w-full py-2.5 rounded-xl border-2 border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-300 shrink-0 transition-all duration-200"
                                >
                                  Add to Cart
                                </button>
                              )}
                              <p className="mt-2.5 font-bold text-slate-800 line-clamp-2 min-h-[2.5rem] text-[15px]">{item.name || '—'}</p>
                              <p className="mt-2 text-slate-500 shrink-0 text-base">Price: <span className="font-semibold text-slate-700">₪{item.price ?? 0}</span></p>
                              <p className="font-bold text-emerald-600 shrink-0 text-lg">Discounted: <span>₪{Math.round(item.priceAfterDiscount ?? item.price ?? 0)}</span></p>
                              <p className="mt-1.5 text-slate-500 text-sm shrink-0"><span className="font-medium">Stock:</span> <span className={getStockStatus(item) === 'In Stock' ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>{getStockStatus(item)}</span></p>
                            </div>

                            <div className="shrink-0 px-3 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-center min-h-[2.75rem]">
                              <span className="text-slate-600 text-lg font-mono font-bold tracking-wide break-all text-center">{item.barcode || '—'}</span>
                            </div>

                            <div className="p-2.5 flex gap-2 border-t border-slate-100 shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                                className="flex-1 flex items-center justify-center py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(item.barcode)}
                                className="p-2 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {hasMore && items.length > 0 && (
              <div ref={loadMoreRef} className="flex justify-center py-8 min-h-[60px]">
                {loadingMore && <Loader2 className="animate-spin text-indigo-500" size={32} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {!showOrderPanel && mode === 'order' && (
        <button
          onClick={() => setShowOrderPanel(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 py-8 px-4 rounded-l-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white text-lg font-bold shadow-[0_0_32px_-8px_rgba(249,115,22,0.45)] hover:shadow-[0_0_40px_-4px_rgba(249,115,22,0.5)] hover:from-orange-600 hover:to-amber-700 transition-all duration-300 border-l-4 border-amber-400/80"
          style={{ writingMode: 'vertical-rl' }}
        >
          Sales Order
        </button>
      )}

      {!showCatalogPanel && mode === 'catalog' && (
        <button
          onClick={() => setShowCatalogPanel(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 py-8 px-4 rounded-l-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-lg font-bold shadow-[0_0_32px_-8px_rgba(244,63,94,0.45)] hover:shadow-[0_0_40px_-4px_rgba(244,63,94,0.5)] hover:from-rose-600 hover:to-pink-700 transition-all duration-300 border-l-4 border-pink-400/80"
          style={{ writingMode: 'vertical-rl' }}
        >
          Product Catalog
        </button>
      )}

      {
        showOrderPanel && (
          <aside className="flex-shrink-0 min-h-0 w-[min(520px,42vw)] min-w-[320px] flex flex-col overflow-hidden rounded-l-2xl bg-gradient-to-b from-white to-slate-50/80 shadow-[0_0_40px_-12px_rgba(0,0,0,0.15),-4px_0_24px_-8px_rgba(0,0,0,0.08)] border-l border-slate-200/60">
            <div className="flex-shrink-0 px-4 py-3 flex justify-between items-center bg-white/80 backdrop-blur-sm border-b border-slate-200/60">
              <h2 className="text-base font-bold text-slate-800">Order Cart <span className="text-orange-500" dir="ltr">({orderLines.length})</span></h2>
              <button onClick={() => setShowOrderPanel(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors flex items-center justify-center text-sm font-medium">✕</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {!showCustomerForm ? (
                <div className="mx-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomerForm(true)}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-dashed border-orange-200 text-orange-700 font-semibold text-sm hover:from-orange-100 hover:to-amber-100 hover:border-orange-300 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    Fill Customer Details
                  </button>
                </div>
              ) : (
                <div className="relative p-4 mx-3 mt-3 rounded-3xl bg-gradient-to-br from-white via-white to-orange-50/30 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_20px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] overflow-hidden space-y-3">
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 opacity-80" />
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-2 pt-0.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]" /> Customer Details
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCustomerForm(false)}
                      className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2.5 py-1.5 rounded-xl transition-colors"
                    >
                      Done — Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">Company Name</span><input type="text" value={orderInfo.companyName} onChange={(e) => setOrderInfoField('companyName', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                    <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">Merchant Name</span><input type="text" value={orderInfo.merchantName} onChange={(e) => setOrderInfoField('merchantName', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                    <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">Phone</span><input type="tel" value={orderInfo.phone} onChange={(e) => setOrderInfoField('phone', e.target.value)} dir="ltr" className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                    <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">Date</span><input type="date" value={orderInfo.orderDate} onChange={(e) => setOrderInfoField('orderDate', e.target.value)} dir="ltr" className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                    <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">Address</span><input type="text" value={orderInfo.address} onChange={(e) => setOrderInfoField('address', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                    <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">Customer Number</span><input type="text" value={orderInfo.customerNumber} onChange={(e) => setOrderInfoField('customerNumber', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                    <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">Payment Method</span><select value={orderInfo.paymentMethod} onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none"><option value="">—</option><option value="Cash">Cash</option><option value="Checks">Checks</option></select></label>
                    {orderInfo.paymentMethod === 'Checks' && (
                      <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">Checks Count</span><input type="number" min="1" value={orderInfo.checksCount} onChange={(e) => setOrderInfoField('checksCount', e.target.value)} placeholder="3" className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomerForm(false)}
                    className="w-full py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
                  >
                    Done — Close
                  </button>
                </div>
              )}
              <div className="p-3 space-y-2.5">
                {orderLines.length === 0 ? (
                  <div className="text-center py-14 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100/80 border-2 border-dashed border-slate-200/80 text-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <Package className="mx-auto text-slate-400 mb-2" size={40} />
                    <p className="text-sm font-medium">Added items will appear here</p>
                  </div>
                ) : (
                  orderLinesByBox.map((o, idx) => {
                    const prevBox = idx > 0 ? getLineBox(orderLinesByBox[idx - 1]) : null;
                    const box = getLineBox(o);
                    const showBox = prevBox !== box;
                    return (
                      <div key={o.id} className="space-y-1.5">
                        {showBox && (
                          <div className="text-[11px] font-semibold text-orange-600 bg-gradient-to-r from-orange-100 to-amber-100 text-center py-1.5 rounded-full px-4 w-fit shadow-[0_1px_3px_rgba(249,115,22,0.2)]">Box {box}</div>
                        )}
                        <div className="group relative rounded-3xl p-3.5 bg-gradient-to-br from-white via-white to-orange-50/20 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300 border border-slate-100/80">
                          <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-orange-300 to-amber-300 opacity-60 group-hover:opacity-100 transition-opacity" />
                          <div className="flex gap-3 items-start pr-1">
                            <div className="w-12 h-12 shrink-0 rounded-2xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center justify-center">
                              {getImage(o.item) && <img src={getImage(o.item)} alt="" className="w-full h-full object-contain" loading="lazy" decoding="async" onError={(e) => (e.target.style.display = 'none')} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium text-slate-400 tracking-wide mb-0.5">Product & Model</p>
                              <p className="text-sm font-bold text-slate-800 line-clamp-2">{o.item?.name || '—'} {o.item?.group ? ` / ${o.item.group}` : ''}</p>
                              <p className="text-[10px] font-medium text-slate-400 tracking-wide mt-1.5 mb-0.5">Barcode</p>
                              <span className="text-xs font-mono font-semibold text-slate-600 break-all" dir="ltr">{o.item?.barcode || '—'}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                            <div>
                              <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">Qty</span>
                              <div className="flex items-center gap-1">
                                <input type="number" min={1} value={o.qty} onChange={(e) => setOrderQty(o.id, e.target.value)} dir="ltr" className="w-14 rounded-xl border border-slate-200/80 px-1.5 py-1.5 text-center text-sm font-semibold bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-orange-200 outline-none transition-all" />
                                <span className="text-[10px] text-slate-400">Unit</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">Original Price</span>
                              <span className="text-sm font-bold text-slate-700" dir="ltr">₪{getLineOriginalPrice(o)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">Discount %</span>
                              <span className="text-sm font-bold text-emerald-600" dir="ltr">{getLineDiscountPercent(o)}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">Final Price</span>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-slate-700">₪</span>
                                <input type="number" value={getLineUnitPrice(o)} onChange={(e) => setOrderLinePrice(o.id, e.target.value)} dir="ltr" className="w-16 rounded-xl border border-slate-200/80 px-1.5 py-1 text-sm font-bold bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-orange-200 outline-none transition-all" />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">Total Amount (Inc. Tax)</span>
                              <span className="font-bold text-orange-500 text-lg" dir="ltr">₪{getLineTotal(o).toFixed(2)}</span>
                            </div>
                            <button onClick={() => removeFromOrder(o.id)} className="text-[10px] text-rose-500 hover:bg-rose-50 py-1.5 px-2.5 rounded-xl transition-colors self-end">Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {orderLines.length > 0 && (
                <div className="relative mx-3 mb-3 p-4 rounded-3xl bg-gradient-to-br from-white via-white to-orange-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_20px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] overflow-hidden space-y-3">
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 opacity-90" />
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/70">
                    <span className="text-xs font-medium text-slate-400 tracking-wide">Total Amount (Inc. Tax)</span>
                    <span className="font-bold text-lg text-orange-500" dir="ltr" lang="en">₪{orderTotal.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-slate-500 py-2 border-b border-slate-200/70">
                    <span className="text-[10px] font-medium text-slate-400 tracking-wide">Total Amount in Words</span>
                    <span className="block mt-1 text-slate-700 font-medium">{amountToEnglishWords(orderTotal)}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleOpenInventory} className="flex-1 min-w-[120px] py-2.5 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-sm font-bold shadow-[0_2px_8px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_14px_rgba(245,158,11,0.4)] hover:-translate-y-0.5 transition-all">Selected Items</button>
                    <button onClick={handlePrintOrder} className="flex-1 min-w-[80px] py-2.5 rounded-2xl bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-bold shadow-[0_2px_8px_rgba(249,115,22,0.35)] hover:shadow-[0_4px_14px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 transition-all">Print</button>
                    <button onClick={handleExportExcel} className="flex-1 min-w-[80px] py-2.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-bold shadow-[0_2px_8px_rgba(5,150,105,0.35)] hover:shadow-[0_4px_14px_rgba(5,150,105,0.4)] hover:-translate-y-0.5 transition-all">Excel</button>
                    <button onClick={() => handlePrintOrder()} className="flex-1 min-w-[80px] py-2.5 rounded-2xl bg-gradient-to-b from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white text-sm font-bold shadow-[0_2px_8px_rgba(71,85,105,0.3)] hover:shadow-[0_4px_14px_rgba(71,85,105,0.35)] hover:-translate-y-0.5 transition-all">PDF</button>
                  </div>
                  <button onClick={clearOrder} className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-all hover:shadow-inner">Clear Order</button>
                </div>
              )}
            </div>
          </aside>
        )
      }

      {
        showCatalogPanel && (
          <aside className="flex-shrink-0 min-h-0 w-[min(520px,42vw)] min-w-[320px] flex flex-col overflow-hidden rounded-l-2xl bg-gradient-to-b from-white to-slate-50/80 shadow-[0_0_40px_-12px_rgba(0,0,0,0.15),-4px_0_24px_-8px_rgba(0,0,0,0.08)] border-l border-slate-200/60 transition-all duration-300">
            <div className="flex-shrink-0 px-4 py-3 flex justify-between items-center bg-white/80 backdrop-blur-sm border-b border-slate-200/60">
              <h2 className="text-base font-bold text-slate-800">Catalog <span className="text-rose-500" dir="ltr">({catalogItems.length})</span></h2>
              <button onClick={() => setShowCatalogPanel(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors flex items-center justify-center text-sm font-medium">✕</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
              {catalogItems.length === 0 ? (
                <div className="text-center py-14 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100/80 border-2 border-dashed border-slate-200/80 text-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <FileText className="mx-auto text-slate-400 mb-2" size={40} />
                  <p className="text-sm font-medium">Selected items will appear here</p>
                </div>
              ) : (
                catalogItems.map(item => (
                  <div key={item.id} className="group relative rounded-3xl p-3.5 bg-gradient-to-br from-white via-white to-rose-50/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100/80 flex gap-3 items-center">
                    <div className="w-12 h-12 shrink-0 rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                      {getImage(item) && <img src={getImage(item)} alt="" className="w-full h-full object-contain" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.barcode}</p>
                    </div>
                    <button onClick={() => removeFromCatalog(item.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {catalogItems.length > 0 && (
              <div className="p-3 border-t border-slate-200/60 bg-white/50 backdrop-blur-sm space-y-2">
                <button onClick={handlePrintCatalog} className="w-full py-2.5 rounded-2xl bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-sm font-bold shadow-lg shadow-rose-500/25 transition-all">Print / View Catalog</button>
                <button onClick={clearCatalog} className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-all">Clear Catalog</button>
              </div>
            )}
          </aside>
        )
      }

      {
        selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Product Details</h3>
                <button onClick={() => setSelectedItem(null)} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">✕</button>
              </div>
              <div className="aspect-square max-h-48 rounded-xl bg-slate-50 flex items-center justify-center mb-4 overflow-hidden">
                {getImage(selectedItem) ? <img src={getImage(selectedItem)} alt="" className="w-full h-full object-contain p-4" onError={(e) => (e.target.style.display = 'none')} /> : <Package size={64} className="text-slate-300" />}
              </div>
              <p className="text-slate-800 font-semibold mb-2">{selectedItem.name}</p>
              {selectedItem.group && <span className="inline-block text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-medium">{selectedItem.group}</span>}
              <p className="mt-3 text-slate-600">Price: <span dir="ltr" lang="en" className="font-semibold text-slate-800">₪{selectedItem.price ?? 0}</span> — Discounted: <span dir="ltr" lang="en" className="font-semibold text-emerald-600">₪{Math.round(selectedItem.priceAfterDiscount ?? selectedItem.price ?? 0)}</span></p>
              <p className="mt-1 text-slate-500 text-sm">Stock: <span className={getStockStatus(selectedItem) === 'In Stock' ? 'text-emerald-600 font-semibold' : ''}>{getStockStatus(selectedItem)}</span></p>
              <button onClick={() => { addToOrder(selectedItem, 1); setSelectedItem(null); }} className="w-full mt-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all">Add to Cart</button>
            </div>
          </div>
        )
      }

      {
        modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">{editingItem ? 'Edit Price & Qty' : 'Add Item'}</h2>
                <button onClick={() => setModalOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <label><span className="text-xs block text-slate-600 font-medium mb-1">Barcode</span><input required value={formData.barcode} onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))} disabled={!!editingItem} dir="ltr" lang="en" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none transition-shadow" /></label>
                <label><span className="text-xs block text-slate-600 font-medium mb-1">Name</span><input value={formData.eng_name} onChange={(e) => setFormData((p) => ({ ...p, eng_name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label><span className="text-xs block text-slate-600 font-medium mb-1">Group</span><input value={formData.brand_group} onChange={(e) => setFormData((p) => ({ ...p, brand_group: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="text-xs block text-slate-600 font-medium mb-1">Qty (Stock)</span><input type="number" value={formData.stock_count} onChange={(e) => setFormData((p) => ({ ...p, stock_count: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                  <label><span className="text-xs block text-slate-600 font-medium mb-1">Box</span><input type="number" value={formData.box_count} onChange={(e) => setFormData((p) => ({ ...p, box_count: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="text-xs block text-slate-600 font-medium mb-1">Price</span><input type="number" step="0.01" value={formData.full_price} onChange={(e) => setFormData((p) => ({ ...p, full_price: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                  <label><span className="text-xs block text-slate-600 font-medium mb-1">Discounted</span><input type="number" step="0.01" value={formData.price_after_disc} onChange={(e) => setFormData((p) => ({ ...p, price_after_disc: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                </div>
                <div className="space-y-2">
                  <span className="text-xs block text-slate-600 font-medium">Image</span>
                  <div className="flex gap-3 items-start">
                    <div className="relative w-20 h-20 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200">
                      {(formData.image_url && getPublicImageUrl(formData.image_url)) ? (
                        <img
                          key={formData.image_url}
                          src={getPublicImageUrl(formData.image_url)}
                          alt=""
                          className="w-full h-full object-contain"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      ) : (
                        <Package size={28} className="text-slate-300" />
                      )}
                      {formData.image_url ? (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute bottom-1 right-1 w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow"
                          title="Delete Image"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        type="url"
                        placeholder="Image URL (Optional)"
                        value={formData.image_url || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, image_url: e.target.value.trim() }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                        dir="ltr"
                      />
                      <label className={`block cursor-pointer ${uploading ? 'opacity-70' : ''}`}>
                        <input ref={fileInputRef} type="file" accept="image/*" disabled={uploading || !formData.barcode} onChange={handleImageUpload} className="sr-only" />
                        <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors ${!formData.barcode ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          {uploading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Upload size={14} className="shrink-0" />}
                          {uploading ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                    </div>
                  </div>
                  {!formData.barcode && <p className="text-[11px] text-amber-600">Enter barcode first to enable upload</p>}
                  <p className="text-[11px] text-slate-500">Paste an image URL above or upload from your device.</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 shadow-lg shadow-indigo-500/25 transition-all">Save</button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;
