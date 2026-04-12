import React, { useState, useEffect, useCallback, useRef } from 'react';
import ExcelJS from 'exceljs';
import {
  Search,
  Plus,
  Pencil,
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
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { BARCODE_ORDER, sortByBarcodeOrder } from './BARCODE_ORDER_NEW';

const BUCKET = 'Pic_of_items';
const PAGE_SIZE = 80;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;


/** إرجاع رابط عام ثابت للصورة عبر getPublicUrl (لا يستخدم Signed URLs). يُرجع null عند عدم وجود صورة. */
function getPublicImageUrl(imageValue) {
  if (!imageValue) return null;
  if (String(imageValue).startsWith('http')) return imageValue;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imageValue);
  return data?.publicUrl || null;
}

const ELECTRICAL_GROUPS = [
  'Tefal Electric', 'Tefal', 'Moulinex', 'Mounliex', 'Babyliss', 'Babyliss Pro', 'Kenwood', 'Braun',
  'KMG midea SDA', 'KMG midea VC', 'KMG ACE', 'KMG midea MWO',
].map((s) => s.trim().toLowerCase());

const isElectricalGroup = (g) =>
  g && ELECTRICAL_GROUPS.some((eg) => String(g).trim().toLowerCase() === eg);

/** تحويل المبلغ إلى كتابة عربية (شيقل وأغورة) */
function amountToArabicWords(amount) {
  const n = Math.max(0, Number(amount));
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  function toWords(num) {
    if (num === 0) return 'صفر';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const o = num % 10;
      if (o === 0) return tens[t];
      return ones[o] + ' و' + tens[t];
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      if (rest === 0) return hundreds[h];
      return hundreds[h] + ' و' + toWords(rest);
    }
    if (num < 1000000) {
      const th = Math.floor(num / 1000);
      const rest = num % 1000;
      const thWord = th === 1 ? 'ألف' : th === 2 ? 'ألفان' : th < 11 ? ones[th] + ' آلاف' : toWords(th) + ' ألف';
      if (rest === 0) return thWord;
      return thWord + ' و' + toWords(rest);
    }
    if (num < 1000000000) {
      const m = Math.floor(num / 1000000);
      const rest = num % 1000000;
      const mWord = m === 1 ? 'مليون' : m === 2 ? 'مليونان' : m < 11 ? ones[m] + ' ملايين' : toWords(m) + ' مليون';
      if (rest === 0) return mWord;
      return mWord + ' و' + toWords(rest);
    }
    return String(num);
  }
  let str = toWords(intPart) + ' شيقل';
  if (decPart > 0) str += ' و' + toWords(decPart) + ' أغورة';
  return str + ' فقط';
}

const ITEMS_SELECT = 'barcode, eng_name, brand_group, box_count, full_price, price_after_disc, stock_count, image_url';

function normalizeItemFromSupabase(row) {
  if (!row) return null;
  return {
    id: row.barcode ?? '',
    barcode: row.barcode ?? '',
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
  const [syncingStock, setSyncingStock] = useState(false);

  const setOrderInfoField = (key, value) =>
    setOrderInfo((prev) => ({ ...prev, [key]: value }));

  const fetchItems = useCallback(
    async (reset = false) => {
      const from = reset ? 0 : page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
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
        } else {
          setItems((prev) => [...prev, ...normalized]);
        }
        setHasMore((data?.length || 0) === PAGE_SIZE);
      } catch (err) {
        console.error('Supabase fetch error:', err);
        setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [page, search]
  );

  useEffect(() => {
    const debounce = setTimeout(() => fetchItems(true), 100);
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

  /** فوق 1 = موجود، تحت 1 = غير موجود */
  const getStockStatus = (item) => {
    const s = item?.stock;
    if (s == null || s === '') return 'غير موجود';
    const n = Number(s);
    if (isNaN(n)) return 'غير موجود';
    return n > 1 ? 'موجود' : 'غير موجود';
  };

  /** عرض المخزون حسب الصناديق. فوق 1 = موجود، تحت 1 = غير موجود */
  const getStockByBoxes = (item) => {
    const s = item?.stock;
    const box = item?.box;
    if (s == null || s === '') return { text: '—', hasStock: false };
    const stockNum = Number(s);
    if (isNaN(stockNum)) return { text: '—', hasStock: false };
    const hasStock = stockNum > 1;
    if (stockNum <= 0) return { text: '—', hasStock: false };
    const boxNum = box != null && String(box).trim() !== '' && !isNaN(Number(box)) ? Math.max(1, Math.round(Number(box))) : null;
    if (boxNum != null && boxNum > 0) {
      const boxesCount = Math.floor(stockNum / boxNum);
      const plural = boxesCount === 1 ? 'صندوق' : boxesCount === 2 ? 'صندوقان' : 'صناديق';
      return { text: `${boxesCount} ${plural}`, hasStock };
    }
    return { text: `${stockNum} قطعة`, hasStock };
  };

  const getImage = (item) => getPublicImageUrl(item?.image);

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

  const getPrintHtml = useCallback(() => {
    const rows = orderLines
      .map((o) => {
        const unitPrice = getLineUnitPrice(o);
        const total = getLineTotal(o);
        const price = Number(o.item?.price) ?? 0;
        const discPercent = getLineDiscountPercent(o);
        const imgSrc = getImage(o.item);
        const imgHtml = imgSrc
          ? `<img src="${String(imgSrc).replace(/"/g, '&quot;')}" alt="" loading="lazy" style="width:40px;height:40px;object-fit:contain;" />`
          : '';
        return `<tr><td>${imgHtml}</td><td dir="ltr" lang="en">${(o.item?.barcode || '').replace(/</g, '&lt;')}</td><td dir="ltr" lang="en">${o.qty}</td><td dir="ltr" lang="en">₪${price}</td><td dir="ltr" lang="en">₪${unitPrice}</td><td dir="ltr" lang="en">${discPercent}%</td><td dir="ltr" lang="en">₪${total.toFixed(2)}</td></tr>`;
      })
      .join('');
    const infoRows = [
      ['اسم الشركة', orderInfo.companyName],
      ['رقم الزبون', orderInfo.customerNumber],
      ['اسم التاجر', orderInfo.merchantName],
      ['التلفون', orderInfo.phone],
      ['العنوان', orderInfo.address],
      ['التاريخ', orderInfo.orderDate],
      ['طريقة الدفع', orderInfo.paymentMethod],
    ]
      .map(
        ([l, v]) =>
          `<tr><td class="info-label">${l}</td><td class="info-value" dir="ltr" lang="en">${(v || '').replace(/</g, '&lt;')}</td></tr>`
      )
      .join('');
    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>اتفاقية بيع طلبية</title>
<style>body{font-family:system-ui;padding:24px;max-width:800px;margin:0 auto}.print-title{font-size:2rem;font-weight:800;text-align:center;color:#c2410c}.section-title{font-weight:700;padding:8px 12px;background:#fff7ed;border:1px solid #ea580c;border-radius:6px;color:#c2410c;margin:1rem 0 0.5rem}.info-table{width:100%;border-collapse:collapse}.info-table td{padding:8px 12px;border:1px solid #d1d5db}.info-label{font-weight:600;background:#fff7ed;width:40%}.info-value{background:#fff}table.data-table{width:100%;border-collapse:collapse;margin-top:1rem}table.data-table th,table.data-table td{padding:10px;border:1px solid #d1d5db;text-align:right}table.data-table th{background:#ea580c;color:#fff}.total-row{font-weight:700;background:#fff7ed}</style></head><body>
<h1 class="print-title">اتفاقية بيع طلبية</h1>
<div class="section-title">معلومات المشتري</div>
<table class="info-table"><tbody>${infoRows}</tbody></table>
<div class="section-title">تفاصيل الأصناف</div>
<table class="data-table"><thead><tr><th>صورة</th><th>الباركود</th><th>الكمية</th><th>السعر</th><th>بعد الخصم</th><th>نسبة الخصم</th><th>المجموع</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="5"></td><td>الإجمالي</td><td dir="ltr" lang="en">₪${orderTotal.toFixed(2)}</td></tr></tbody></table></body></html>`;
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
          ? `<div class="inv-img"><img src="${safeSrc(imgSrc)}" alt="" loading="lazy" /></div>`
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
              ${discPercent > 0 ? `<span class="inv-disc" dir="ltr" lang="en">خصم ${discPercent}%</span>` : ''}
            </div>
          </div>
          <div class="inv-total" dir="ltr" lang="en">₪${total.toFixed(2)}</div>
        </article>`;
      })
      .join('');
    const cust = (orderInfo.companyName || orderInfo.merchantName || '—').replace(/</g, '&lt;');
    const date = (orderInfo.orderDate || '—').replace(/</g, '&lt;');
    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>المنتجات المختارة</title>
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
  <div class="inv-header"><h1 class="inv-title">المنتجات المختارة</h1><p class="inv-sub">Selected Products</p></div>
  <div class="inv-info"><span>الزبون:</span> ${cust} &nbsp;|&nbsp; <span>رقم الهاتف:</span> <span dir="ltr" lang="en">${(orderInfo.phone || '—').replace(/</g, '&lt;')}</span> &nbsp;|&nbsp; <span>التاريخ:</span> <span dir="ltr" lang="en">${date}</span>${orderInfo.paymentMethod === 'شيكات' && orderInfo.checksCount ? ` &nbsp;|&nbsp; <span>عدد الشيكات:</span> <span dir="ltr" lang="en">${String(orderInfo.checksCount).replace(/</g, '&lt;')}</span>` : ''}</div>
  <div class="inv-cards">${cards}</div>
  <div class="inv-total-card"><span>الإجمالي</span><span dir="ltr" lang="en">₪${orderTotal.toFixed(2)}</span></div>
  <button class="btn-print" onclick="window.print()">طباعة</button>
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
    const ws = wb.addWorksheet('اتفاقية بيع طلبية', { views: [{ rightToLeft: true }] });
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
    ws.addRow(['اتفاقية بيع طلبية']);
    ws.getCell(1, 1).font = { bold: true, size: 20, color: { argb: colors.white } };
    ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(1, 1, 1, 7);
    ws.getRow(1).height = 36;
    let r = 3;
    ws.getCell(r, 1).value = 'معلومات المشتري';
    ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: colors.primary } };
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    ws.mergeCells(r, 1, r, 7);
    ws.getCell(r, 1).alignment = { horizontal: 'right' };
    border(ws.getCell(r, 1));
    r++;
    const excelInfoRows = [['اسم الشركة', orderInfo.companyName], ['اسم التاجر', orderInfo.merchantName], ['التلفون', orderInfo.phone], ['العنوان', orderInfo.address], ['التاريخ', orderInfo.orderDate], ['طريقة الدفع', orderInfo.paymentMethod], ...(orderInfo.paymentMethod === 'شيكات' && orderInfo.checksCount ? [['عدد الشيكات', orderInfo.checksCount]] : [])];
    excelInfoRows.forEach(([l, v], i) => {
      ws.getCell(r, 1).value = l;
      ws.getCell(r, 2).value = v || '';
      styleCell(ws.getCell(r, 1), { fill: i % 2 === 0 ? colors.light : colors.lightAlt, font: { bold: true, color: { argb: colors.textDark } }, alignment: { horizontal: 'right' } });
      styleCell(ws.getCell(r, 2), { fill: colors.white, font: { color: { argb: colors.textDark } }, alignment: { horizontal: 'right' } });
      ws.mergeCells(r, 2, r, 7);
      r++;
    });
    r += 1;
    ws.getCell(r, 1).value = 'تفاصيل الأصناف';
    ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: colors.primary } };
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    ws.mergeCells(r, 1, r, 7);
    ws.getCell(r, 1).alignment = { horizontal: 'right' };
    border(ws.getCell(r, 1));
    r++;
    const headers = ['الاسم', 'الباركود', 'الكمية', 'السعر', 'بعد الخصم', 'نسبة الخصم %', 'المجموع'];
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
          alignment: c <= 2 ? { horizontal: 'right' } : { horizontal: 'center' },
        });
      }
      r++;
    });
    ws.getCell(r, 1).value = '';
    ws.getCell(r, 5).value = 'الإجمالي';
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
    a.download = `اتفاقية-${(orderInfo.companyName || orderInfo.merchantName || 'طلب').replace(/[/\\:*?"<>|]/g, '')}-${orderInfo.orderDate || new Date().toISOString().slice(0, 10)}.xlsx`;
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

  // مزامنة المخزون من Google Sheet → Supabase مباشرة
  const handleSyncStockFromSheet = async () => {
    const SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_EXPORT_URL || 'https://docs.google.com/spreadsheets/d/1RNk812KPn54ZuUYQToSN2Vfm4JTtd1Rz1-Lig7j3JVw/export?format=xlsx&gid=1316215926';
    if (!confirm('سيتم تحديث المخزون من Google Sheet. هل أنت متأكد؟')) return;
    setSyncingStock(true);
    try {
      const res = await fetch(SHEET_URL, { redirect: 'follow' });
      if (!res.ok) throw new Error(`فشل تحميل الجدول: HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const sample = new TextDecoder().decode(buf.slice(0, 200)).trimStart();
      if (sample.startsWith('<!') || sample.toLowerCase().startsWith('<html'))
        throw new Error('الجدول يعيد HTML. تأكد من مشاركة الجدول للعموم.');
      const XLSX = (await import('xlsx')).default || (await import('xlsx'));
      const wb = XLSX.read(buf, { type: 'array' });
      const BKEYS = ['barcode', 'الباركود', 'باركود', 'code'];
      const SKEYS = ['stock', 'المخزون', 'inventory', 'qty stock', 'الكمية', 'qty', 'quantity'];
      const findIdx = (hdr, keys) => { for (let i = 0; i < hdr.length; i++) { const h = String(hdr[i] ?? '').toLowerCase().trim(); if (keys.some(k => h === k || h.includes(k.split(' ')[0]))) return i; } return -1; };
      const toN = v => { if (v == null || v === '') return 0; const n = Number(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : Math.max(0, Math.round(n)); };
      const canon = s => { if (!s) return ''; let x = String(s).trim().replace(/\s/g, ''); if (/^\d+$/.test(x)) x = x.replace(/^0+/, '') || '0'; return x; };
      const stockMap = {};
      let found = false;
      for (const sn of (wb.SheetNames || [])) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
        if (!rows || rows.length < 2) continue;
        const bi = findIdx(rows[0], BKEYS), si = findIdx(rows[0], SKEYS);
        if (bi < 0 || si < 0) continue;
        found = true;
        for (let r = 1; r < rows.length; r++) {
          const rawBc = String(rows[r][bi] ?? '').trim();
          if (!rawBc) continue;
          const stock = toN(rows[r][si]);
          stockMap[canon(rawBc)] = stock;
          stockMap[rawBc.replace(/\s/g, '')] = stock;
        }
      }
      if (!found) throw new Error('لم يُعثر على أعمدة الباركود/المخزون في الجدول.');
      let allItems = [], from = 0;
      while (true) {
        const { data, error } = await supabase.from('items').select('barcode, stock_count').range(from, from + 999);
        if (error) throw error;
        if (!data || !data.length) break;
        allItems = allItems.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      const toUpdate = allItems.filter(item => {
        const rawBc = String(item.barcode || '').trim();
        const newStock = stockMap[rawBc] ?? stockMap[canon(rawBc)] ?? 0;
        return newStock !== (item.stock_count ?? 0);
      });
      if (!toUpdate.length) { alert('✅ المخزون محدّث بالفعل.'); setSyncingStock(false); return; }
      let updated = 0;
      for (let i = 0; i < toUpdate.length; i += 50) {
        const batch = toUpdate.slice(i, i + 50);
        const byStock = {};
        for (const item of batch) {
          const rawBc = String(item.barcode || '').trim();
          const s = String(stockMap[rawBc] ?? stockMap[canon(rawBc)] ?? 0);
          if (!byStock[s]) byStock[s] = { stock: Number(s), barcodes: [] };
          byStock[s].barcodes.push(rawBc);
        }
        for (const { stock, barcodes } of Object.values(byStock)) {
          const { error } = await supabase.from('items').update({ stock_count: stock }).in('barcode', barcodes);
          if (error) throw error;
          updated += barcodes.length;
        }
      }
      alert(`✅ تم تحديث مخزون ${updated} صنف من Google Sheet!`);
      fetchItems(true);
    } catch (err) { alert('❌ ' + (err?.message || err)); }
    finally { setSyncingStock(false); }
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
        stock_count: (formData.stock_count !== '' && formData.stock_count !== null && formData.stock_count !== undefined) ? parseInt(formData.stock_count, 10) : 0,
        image_url: formData.image_url.trim() || null,
      };
      if (editingItem) {
        const { error: updateError } = await supabase.from('items').update(payload).eq('barcode', editingItem.barcode);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('items').insert(payload);
        if (insertError) throw insertError;
      }
      setModalOpen(false);
      fetchItems(true);
    } catch (err) {
      alert(err.message || 'فشل الحفظ');
    }
  };

  const handleDelete = async (barcode) => {
    if (!confirm('حذف هذا الصنف؟')) return;
    try {
      await supabase.from('items').delete().eq('barcode', barcode);
      setItems((prev) => prev.filter((i) => i.barcode !== barcode));
    } catch (err) {
      alert(err.message || 'فشل الحذف');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !formData.barcode) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${formData.barcode.trim()}.${ext}`;
      await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setFormData((p) => ({ ...p, image_url: publicUrl }));
      if (editingItem) {
        await supabase.from('items').update({ image_url: publicUrl }).eq('barcode', editingItem.barcode);
        setItems((prev) =>
          prev.map((i) => (i.barcode === editingItem.barcode ? { ...i, image: publicUrl } : i))
        );
        setEditingItem((prev) => (prev ? { ...prev, image: publicUrl } : null));
      }
    } catch (err) {
      alert(err.message || 'فشل رفع الصورة');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`font-sans flex h-screen overflow-hidden ${showOrderPanel ? 'flex-row min-h-0' : 'flex-col'}`}
      style={{ background: 'linear-gradient(180deg, #fdf2f8 0%, #fce7f3 20%, #f5f3ff 50%, #eff6ff 80%, #f0fdf4 100%)' }}
    >
      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden ${showOrderPanel ? 'p-3 sm:p-4' : 'p-4 sm:p-6 lg:p-8'}`}
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 py-2.5 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8 bg-white/80 backdrop-blur-sm shadow-[0_1px_4px_rgba(0,0,0,0.04)] z-20 border-b border-teal-100">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-lg font-bold text-violet-900 shrink-0">نظام إدارة المخازن</h1>
            <span className="text-slate-500 text-xs shrink-0 hidden sm:inline">
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="w-px h-4 bg-slate-200 shrink-0 hidden sm:block" aria-hidden />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedGroup(selectedGroup === '__electrical__' ? null : '__electrical__')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[12px] border text-xs font-medium transition-all ${
                  selectedGroup === '__electrical__'
                    ? 'bg-violet-100 border-violet-400 text-violet-800'
                    : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300'
                }`}
              >
                <Zap size={14} className="shrink-0" />
                <span className="hidden sm:inline">Electrical</span>
                <span className="text-slate-400 text-[10px]">({items.filter((i) => isElectricalGroup(i.group)).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup(selectedGroup === '__home__' ? null : '__home__')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[12px] border text-xs font-medium transition-all ${
                  selectedGroup === '__home__'
                    ? 'bg-sky-100 border-sky-400 text-sky-800'
                    : 'bg-white border-violet-200 text-violet-700 hover:bg-sky-50 hover:border-sky-300'
                }`}
              >
                <Home size={14} className="shrink-0" />
                <span className="hidden sm:inline">Kitchenware</span>
                <span className="text-slate-400 text-[10px]" dir="ltr" lang="en">({items.filter((i) => !isElectricalGroup(i.group)).length})</span>
              </button>
            </div>
            {(selectedGroup === '__electrical__' || (selectedGroup && electricalGroupsSorted.includes(selectedGroup))) && electricalGroupsSorted.length > 0 && (
              <>
                <span className="w-px h-4 bg-slate-200 shrink-0" aria-hidden />
                <div className="flex items-center gap-1 flex-wrap min-w-0">
                  {electricalGroupsSorted.map((g, idx) => {
                    const isActive = selectedGroup === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedGroup(isActive ? '__electrical__' : g)}
                        className={`shrink-0 px-2 py-1 rounded-[10px] text-[11px] font-medium border transition-all ${
                          isActive ? 'bg-violet-100 border-violet-400 text-violet-800' : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {(selectedGroup === '__home__' || (selectedGroup && kitchenwareGroupsSorted.includes(selectedGroup))) && kitchenwareGroupsSorted.length > 0 && (
              <>
                <span className="w-px h-4 bg-slate-200 shrink-0" aria-hidden />
                <div className="flex items-center gap-1 flex-wrap min-w-0">
                  {kitchenwareGroupsSorted.map((g) => {
                    const isActive = selectedGroup === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedGroup(isActive ? '__home__' : g)}
                        className={`shrink-0 px-2 py-1 rounded-[10px] text-[11px] font-medium border transition-all ${
                          isActive ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-violet-200 text-violet-700 hover:bg-sky-50 hover:border-sky-300'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div className="flex-1 min-w-[120px] max-w-[280px] sm:max-w-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-400 shrink-0" size={14} />
                <input
                  type="text"
                  placeholder="بحث لحظي بالاسم أو الباركود..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-[16px] border border-violet-200/70 focus:ring-2 focus:ring-violet-200 outline-none bg-white/95 placeholder:text-violet-300 shadow-[0_1px_4px_rgba(139,92,246,0.04)]"
                />
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[16px] bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600 transition-colors shadow-[0_2px_8px_rgba(139,92,246,0.25)]"
            >
              <Plus size={14} />
              Add Item
            </button>
            <button
              onClick={handleSyncStockFromSheet}
              disabled={syncingStock}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[16px] bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors shadow-[0_2px_8px_rgba(16,185,129,0.25)] disabled:opacity-60"
            >
              <Loader2 size={14} className={syncingStock ? 'animate-spin' : 'hidden'} />
              {syncingStock ? 'جاري...' : '🔄 مزامنة المخزون'}
            </button>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pt-4">
          {loading ? (
            <div className="flex justify-center py-24" key="loading">
              <Loader2 className="animate-spin text-violet-500" size={40} />
            </div>
          ) : (
            <div key={`products-${showOrderPanel}`} className="pb-6 space-y-10">
              {[
                { title: 'Electrical Appliances', items: filteredItems.filter((i) => isElectricalGroup(i.group)), color: 'indigo' },
                { title: 'Kitchenware', items: filteredItems.filter((i) => !isElectricalGroup(i.group)), color: 'amber' },
              ].map(({ title, items: sectionItems, color }) => {
                const sorted = sortByBarcodeOrder(sectionItems, BARCODE_ORDER);
                return (
                <section key={title}>
                  <h2 className="text-lg font-bold text-violet-900 mb-4 flex items-center gap-2">
                    <span className={`w-1 h-6 rounded-full ${color === 'indigo' ? 'bg-violet-500' : 'bg-sky-500'}`} />
                    {title}
                    <span className="text-slate-500 font-normal text-sm" dir="ltr" lang="en">({sorted.length})</span>
                  </h2>
                  <div
                    className={`grid items-stretch ${showOrderPanel ? 'gap-4' : 'gap-6'}`}
                    style={{
                      gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${showOrderPanel ? 220 : 280}px), 1fr))`,
                    }}
                  >
                    {sorted.map((item) => (
                <div
                  key={item.id}
                  className="relative flex flex-col h-full min-h-[420px] bg-white rounded-[32px] border border-violet-100/80 shadow-[0_2px_16px_rgba(139,92,246,0.06)] overflow-hidden hover:shadow-[0_8px 32px_rgba(167,139,250,0.12)] transition-all duration-300"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                    className="absolute top-3 left-3 z-10 w-9 h-9 flex items-center justify-center rounded-[12px] bg-white/95 shadow-[0_2px_8px_rgba(139,92,246,0.15)] hover:bg-violet-50 hover:shadow-[0_4px_12px_rgba(139,92,246,0.2)] text-violet-600 transition-all"
                    title="تعديل السعر والكمية"
                  >
                    <Pencil size={16} />
                  </button>
                  {item.group && (
                    <div
                      className={`shrink-0 px-4 py-3.5 text-center rounded-t-[32px] transition-all duration-200 ${
                        isElectricalGroup(item.group)
                          ? 'bg-gradient-to-r from-violet-50 via-fuchsia-50/80 to-pink-50 border-b border-violet-100'
                          : 'bg-gradient-to-r from-sky-50 via-cyan-50/80 to-teal-50 border-b border-sky-100'
                      }`}
                    >
                      <p className={`text-base font-bold tracking-wide line-clamp-1 ${
                        isElectricalGroup(item.group) ? 'text-violet-800' : 'text-sky-800'
                      }`}>{item.group}</p>
                    </div>
                  )}
                  <div
                    role="button"
                    onClick={() => setSelectedItem(item)}
                    className="flex flex-col flex-1 min-h-0"
                  >
                    <div className="w-full h-[180px] shrink-0 bg-gradient-to-b from-violet-50/40 via-pink-50/20 to-white flex items-center justify-center">
                      {getImage(item) ? (
                        <img
                          src={getImage(item)}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-contain p-2"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      ) : (
                        <Package className="text-violet-200" size={48} />
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col min-h-[140px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToOrder(item, 1);
                        }}
                        className="w-full py-2 rounded-[16px] border border-violet-200/80 text-violet-800 text-sm font-medium hover:bg-violet-50/80 shrink-0 transition-colors"
                      >
                        🛒 إضافة للسلة
                      </button>
                      <p className="mt-2 font-bold text-slate-800 line-clamp-2 min-h-[2.5rem]">{item.name || '—'}</p>
                      <p className="mt-2 text-slate-600 shrink-0 text-lg font-semibold">السعر: <span dir="ltr" lang="en">₪{item.price ?? 0}</span></p>
                      <p className="font-bold text-emerald-600 shrink-0 text-xl">السعر بعد الخصم: <span dir="ltr" lang="en">₪{Math.round(item.priceAfterDiscount ?? item.price ?? 0)}</span></p>
                      <p className="mt-1.5 text-slate-500 text-sm shrink-0"><span className="font-semibold">الكمية:</span> <span dir="ltr" lang="en" className={getStockStatus(item) === 'موجود' ? 'text-emerald-600 font-medium' : 'text-slate-500'}>{item.stock != null && item.stock !== '' ? Number(item.stock) : '—'}</span></p>
                    </div>
                  </div>
                  <div className="shrink-0 px-3 py-2 bg-violet-50/50 border-t border-violet-100 flex items-center justify-center min-h-[2.75rem]">
                    <span className="text-violet-700 text-sm font-mono font-semibold tracking-wide break-all text-center" dir="ltr" lang="en">{item.barcode || '—'}</span>
                  </div>
                  <div className="p-2 flex gap-2 border-t border-violet-100 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[12px] border border-violet-200/80 text-violet-700 text-xs font-medium hover:bg-violet-50/80"
                    >
                      <Pencil size={12} /> تعديل السعر والكمية
                    </button>
                    <button
                      onClick={() => handleDelete(item.barcode)}
                      className="p-1.5 rounded-[12px] border border-rose-200/80 text-rose-600 hover:bg-rose-50"
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
              {loadingMore && <Loader2 className="animate-spin text-violet-500" size={32} />}
            </div>
          )}
        </div>
        </div>
      </div>

      {!showOrderPanel && (
        <button
          onClick={() => setShowOrderPanel(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 py-8 px-4 rounded-l-2xl bg-gradient-to-b from-orange-500 to-orange-600 text-white text-xl font-bold shadow-[0_0_24px_-4px_rgba(249,115,22,0.4)] hover:from-orange-600 hover:to-orange-700 transition-all"
          style={{ writingMode: 'vertical-rl' }}
        >
          اتفاقية بيع طلبية
        </button>
      )}

      {showOrderPanel && (
        <aside className="flex-shrink-0 min-h-0 w-[min(520px,42vw)] min-w-[320px] flex flex-col overflow-hidden rounded-l-2xl bg-gradient-to-b from-white to-slate-50/80 shadow-[0_0_40px_-12px_rgba(0,0,0,0.15),-4px_0_24px_-8px_rgba(0,0,0,0.08)] border-l border-slate-200/60">
          <div className="flex-shrink-0 px-4 py-3 flex justify-between items-center bg-white/80 backdrop-blur-sm border-b border-slate-200/60">
            <h2 className="text-base font-bold text-slate-800">سلة الطلبية <span className="text-orange-500" dir="ltr" lang="en">({orderLines.length})</span></h2>
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
                تعبئة بيانات المشتري
              </button>
            </div>
          ) : (
            <div className="relative p-4 mx-3 mt-3 rounded-3xl bg-gradient-to-br from-white via-white to-orange-50/30 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_20px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] overflow-hidden space-y-3">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 opacity-80" />
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-2 pt-0.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]" /> بيانات المشتري
                </p>
                <button
                  type="button"
                  onClick={() => setShowCustomerForm(false)}
                  className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2.5 py-1.5 rounded-xl transition-colors"
                >
                  انتهيت — إغلاق
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">اسم الشركة (المشتري)</span><input type="text" value={orderInfo.companyName} onChange={(e) => setOrderInfoField('companyName', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">اسم التاجر (المشتري)</span><input type="text" value={orderInfo.merchantName} onChange={(e) => setOrderInfoField('merchantName', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">التلفون</span><input type="tel" value={orderInfo.phone} onChange={(e) => setOrderInfoField('phone', e.target.value)} dir="ltr" lang="en" className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">التاريخ</span><input type="date" value={orderInfo.orderDate} onChange={(e) => setOrderInfoField('orderDate', e.target.value)} dir="ltr" lang="en" className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">العنوان</span><input type="text" value={orderInfo.address} onChange={(e) => setOrderInfoField('address', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                <label className="block col-span-2"><span className="text-[10px] text-slate-500 block mb-0.5">رقم الزبون (في الشركة)</span><input type="text" value={orderInfo.customerNumber} onChange={(e) => setOrderInfoField('customerNumber', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">طريقة الدفع</span><select value={orderInfo.paymentMethod} onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)} className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none"><option value="">—</option><option value="نقدي">نقدي</option><option value="شيكات">شيكات</option></select></label>
                {orderInfo.paymentMethod === 'شيكات' && (
                  <label className="block"><span className="text-[10px] text-slate-500 block mb-0.5">عدد الشيكات</span><input type="number" min="1" value={orderInfo.checksCount} onChange={(e) => setOrderInfoField('checksCount', e.target.value)} placeholder="3" className="w-full text-xs rounded-2xl border border-slate-200/90 px-2.5 py-1.5 bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:ring-2 focus:ring-orange-200/80 focus:border-orange-300 transition-all outline-none" /></label>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerForm(false)}
                className="w-full py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
              >
                انتهيت من التعبئة — إغلاق
              </button>
            </div>
          )}
          <div className="p-3 space-y-2.5">
            {orderLines.length === 0 ? (
              <div className="text-center py-14 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100/80 border-2 border-dashed border-slate-200/80 text-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <Package className="mx-auto text-slate-400 mb-2" size={40} />
                <p className="text-sm font-medium">الأصناف المضافة ستظهر هنا</p>
              </div>
            ) : (
              orderLinesByBox.map((o, idx) => {
                const prevBox = idx > 0 ? getLineBox(orderLinesByBox[idx - 1]) : null;
                const box = getLineBox(o);
                const showBox = prevBox !== box;
                return (
                  <div key={`order-line-${String(o.id ?? idx)}-${idx}`} className="space-y-1.5">
                    {showBox && (
                      <div className="text-[11px] font-semibold text-orange-600 bg-gradient-to-r from-orange-100 to-amber-100 text-center py-1.5 rounded-full px-4 w-fit shadow-[0_1px_3px_rgba(249,115,22,0.2)]">صندوق {box}</div>
                    )}
                    <div className="group relative rounded-3xl p-3.5 bg-gradient-to-br from-white via-white to-orange-50/20 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300 border border-slate-100/80">
                      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-orange-300 to-amber-300 opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="flex gap-3 items-start pr-1">
                        <div className="w-12 h-12 shrink-0 rounded-2xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center justify-center">
                          {getImage(o.item) ? (
                            <img src={getImage(o.item)} alt="" loading="lazy" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} />
                          ) : (
                            <Package size={24} className="text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-slate-400 tracking-wide mb-0.5">المنتج والموديل</p>
                          <p className="text-sm font-bold text-slate-800 line-clamp-2">{o.item?.name || '—'} {o.item?.group ? ` / ${o.item.group}` : ''}</p>
                          <p className="text-[10px] font-medium text-slate-400 tracking-wide mt-1.5 mb-0.5">الباركود</p>
                          <span className="text-xs font-mono font-semibold text-slate-600 break-all" dir="ltr">{o.item?.barcode || '—'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">الكمية</span>
                          <div className="flex items-center gap-1">
                            <input type="number" min={1} value={o.qty} onChange={(e) => setOrderQty(o.id, e.target.value)} dir="ltr" className="w-14 rounded-xl border border-slate-200/80 px-1.5 py-1.5 text-center text-sm font-semibold bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-orange-200 outline-none transition-all" />
                            <span className="text-[10px] text-slate-400">وحدة</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">السعر الأصلي</span>
                          <span className="text-sm font-bold text-slate-700" dir="ltr">₪{getLineOriginalPrice(o)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">نسبة الخصم</span>
                          <span className="text-sm font-bold text-emerald-600" dir="ltr">{getLineDiscountPercent(o)}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">السعر النهائي</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-slate-700">₪</span>
                            <input type="number" value={getLineUnitPrice(o)} onChange={(e) => setOrderLinePrice(o.id, e.target.value)} dir="ltr" className="w-16 rounded-xl border border-slate-200/80 px-1.5 py-1 text-sm font-bold bg-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-orange-200 outline-none transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 tracking-wide block mb-0.5">المبلغ الإجمالي (شامل الضريبة)</span>
                          <span className="font-bold text-orange-500 text-lg" dir="ltr">₪{getLineTotal(o).toFixed(2)}</span>
                        </div>
                        <button onClick={() => removeFromOrder(o.id)} className="text-[10px] text-rose-500 hover:bg-rose-50 py-1.5 px-2.5 rounded-xl transition-colors self-end">حذف</button>
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
                <span className="text-xs font-medium text-slate-400 tracking-wide">المبلغ الإجمالي (شامل الضريبة)</span>
                <span className="font-bold text-lg text-orange-500" dir="ltr" lang="en">₪{orderTotal.toFixed(2)}</span>
              </div>
              <p className="text-sm text-slate-500 py-2 border-b border-slate-200/70">
                <span className="text-[10px] font-medium text-slate-400 tracking-wide">المبلغ الإجمالي كتابة</span>
                <span className="block mt-1 text-slate-700 font-medium">{amountToArabicWords(orderTotal)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleOpenInventory} className="flex-1 min-w-[120px] py-2.5 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-sm font-bold shadow-[0_2px_8px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_14px_rgba(245,158,11,0.4)] hover:-translate-y-0.5 transition-all">المنتجات المختارة</button>
                <button onClick={handlePrintOrder} className="flex-1 min-w-[80px] py-2.5 rounded-2xl bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-bold shadow-[0_2px_8px_rgba(249,115,22,0.35)] hover:shadow-[0_4px_14px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 transition-all">طباعة</button>
                <button onClick={handleExportExcel} className="flex-1 min-w-[80px] py-2.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-bold shadow-[0_2px_8px_rgba(5,150,105,0.35)] hover:shadow-[0_4px_14px_rgba(5,150,105,0.4)] hover:-translate-y-0.5 transition-all">Excel</button>
                <button onClick={() => handlePrintOrder()} className="flex-1 min-w-[80px] py-2.5 rounded-2xl bg-gradient-to-b from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white text-sm font-bold shadow-[0_2px_8px_rgba(71,85,105,0.3)] hover:shadow-[0_4px_14px_rgba(71,85,105,0.35)] hover:-translate-y-0.5 transition-all">PDF</button>
              </div>
              <button onClick={clearOrder} className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-all hover:shadow-inner">تفريغ الطلبية</button>
            </div>
          )}
          </div>
        </aside>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="font-bold">تفاصيل المنتج</h3>
              <button onClick={() => setSelectedItem(null)} className="p-2 rounded-lg bg-slate-100">✕</button>
            </div>
            <div className="aspect-square max-h-48 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
              {getImage(selectedItem) ? <img src={getImage(selectedItem)} alt="" loading="lazy" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} /> : <Package size={64} className="text-slate-300" />}
            </div>
            <p className="text-slate-700 mb-2">{selectedItem.name}</p>
            {selectedItem.group && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">{selectedItem.group}</span>}
            <p className="mt-2">السعر: <span dir="ltr" lang="en">₪{selectedItem.price ?? 0}</span> | السعر بعد الخصم: <span dir="ltr" lang="en">₪{Math.round(selectedItem.priceAfterDiscount ?? selectedItem.price ?? 0)}</span></p>
            <p className="mt-1 text-slate-600 text-sm">المخزون: <span className={getStockStatus(selectedItem) === 'موجود' ? 'text-emerald-600 font-medium' : ''}>{getStockStatus(selectedItem)}</span></p>
            <button onClick={() => { addToOrder(selectedItem, 1); setSelectedItem(null); }} className="w-full mt-4 py-3 rounded-xl bg-orange-500 text-white font-bold">إضافة لاتفاقية البيع</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-[32px] p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-[0_24px_48px_rgba(139,92,246,0.15)] border border-violet-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="font-bold text-violet-900">{editingItem ? 'تعديل السعر والكمية' : 'إضافة صنف'}</h2>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-[12px] bg-violet-100 hover:bg-violet-200 text-violet-700 flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label><span className="text-xs block text-violet-800 font-medium">الباركود</span><input required value={formData.barcode} onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))} disabled={!!editingItem} dir="ltr" lang="en" className="w-full rounded-[12px] border border-violet-200/80 px-3 py-2 focus:ring-2 focus:ring-violet-200" /></label>
              <label><span className="text-xs block">الاسم</span><input value={formData.eng_name} onChange={(e) => setFormData((p) => ({ ...p, eng_name: e.target.value }))} className="w-full rounded-lg border px-3 py-2" /></label>
              <label><span className="text-xs block">المجموعة</span><input value={formData.brand_group} onChange={(e) => setFormData((p) => ({ ...p, brand_group: e.target.value }))} className="w-full rounded-lg border px-3 py-2" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="text-xs block text-violet-800 font-medium">الكمية (المخزون)</span><input type="number" value={formData.stock_count} onChange={(e) => setFormData((p) => ({ ...p, stock_count: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-[12px] border border-violet-200/80 px-3 py-2 focus:ring-2 focus:ring-violet-200" /></label>
                <label><span className="text-xs block text-violet-800 font-medium">صندوق</span><input type="number" value={formData.box_count} onChange={(e) => setFormData((p) => ({ ...p, box_count: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-[12px] border border-violet-200/80 px-3 py-2 focus:ring-2 focus:ring-violet-200" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="text-xs block text-violet-800 font-medium">السعر</span><input type="number" step="0.01" value={formData.full_price} onChange={(e) => setFormData((p) => ({ ...p, full_price: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-[12px] border border-violet-200/80 px-3 py-2 focus:ring-2 focus:ring-violet-200" /></label>
                <label><span className="text-xs block text-violet-800 font-medium">بعد الخصم</span><input type="number" step="0.01" value={formData.price_after_disc} onChange={(e) => setFormData((p) => ({ ...p, price_after_disc: e.target.value }))} dir="ltr" lang="en" className="w-full rounded-[12px] border border-violet-200/80 px-3 py-2 focus:ring-2 focus:ring-violet-200" /></label>
              </div>
              <div className="space-y-2">
                <span className="text-xs block text-violet-800 font-medium">الصورة</span>
                <div className="flex gap-3 items-start">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-violet-100">
                    {(formData.image_url && getPublicImageUrl(formData.image_url)) ? (
                      <img src={getPublicImageUrl(formData.image_url)} alt="" loading="lazy" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} />
                    ) : (
                      <Package size={28} className="text-slate-300" />
                    )}
                  </div>
                  <label className={`flex-1 min-w-0 cursor-pointer ${!formData.barcode || uploading ? 'opacity-70' : ''}`}>
                    <input type="file" accept="image/*" disabled={uploading || !formData.barcode} onChange={handleImageUpload} className="sr-only" />
                    <span className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-violet-200 hover:border-violet-400 hover:bg-violet-50/50 text-violet-700 text-sm font-medium transition-colors ${!formData.barcode ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {uploading ? <Loader2 size={18} className="animate-spin shrink-0" /> : <Upload size={18} className="shrink-0" />}
                      {uploading ? 'جاري الرفع…' : formData.image_url ? 'استبدال الصورة' : 'رفع صورة جديدة'}
                    </span>
                  </label>
                </div>
                {!formData.barcode && <p className="text-[11px] text-amber-600">أدخل الباركود أولاً لتمكين رفع الصورة</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-[16px] border border-violet-200 text-violet-700 hover:bg-violet-50">إلغاء</button>
                <button type="submit" className="flex-1 py-2 rounded-[16px] bg-violet-500 text-white font-semibold hover:bg-violet-600 shadow-[0_4px_12px_rgba(139,92,246,0.3)]">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
