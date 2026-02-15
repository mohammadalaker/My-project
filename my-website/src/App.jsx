import React, { useState, useEffect, useCallback, useRef, useMemo, useTransition, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  Minus,
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
  Lock,
  Utensils,
  UtensilsCrossed,
  ChefHat,
  Wine,
  Flame,
  Cookie,
  FileText,
  FileDown,
  Grid,
  Clock,
  ArrowUpDown,
  Star,
  Gift,
  Sparkles,
  Percent,
  ShoppingCart,
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { BARCODE_ORDER, sortByBarcodeOrder } from './barcodeOrder';

const BUCKET = 'Pic_of_items';
const PAGE_SIZE = 12;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Safe date format so changing browser language never crashes the app. */
function safeLocaleDate(options = {}) {
  try {
    return new Date().toLocaleDateString('en-GB', options);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

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

/** Electrical Appliances: Tefal Electric, Moulinex, Braun, Kenwood, Babyliss, Babyliss Pro, KMG midea SDA/VC/ACE/MWO */
const ELECTRICAL_GROUPS = [
  'Tefal Electric', 'Moulinex', 'Braun', 'Kenwood', 'Babyliss', 'Babyliss Pro',
  'KMG midea SDA', 'KMG midea VC', 'KMG ACE', 'KMG midea MWO',
].map((s) => s.trim().toLowerCase());

/** Household / Kitchenware: Tefal Cookware, Tefal kitchen, Pyrex, Pressure Cookers, Luminarc, KMG Desore */
const HOUSEHOLD_GROUPS = [
  'Tefal Cookware', 'Tefal kitchen', 'Pyrex Glass', 'Pyrex Zhejiang Better', 'Pyrex Kitchen',
  'Pressure Cookers', 'Luminarc', 'KMG Desore',
].map((s) => s.trim().toLowerCase());

const isElectricalGroup = (g) =>
  g && ELECTRICAL_GROUPS.some((eg) => String(g).trim().toLowerCase() === eg);
const isHouseholdGroup = (g) =>
  g && HOUSEHOLD_GROUPS.some((hg) => String(g).trim().toLowerCase() === hg);

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

const ITEMS_SELECT = 'barcode, eng_name, brand_group, box_count, full_price, price_after_disc, stock_count, image_url, is_offer';

const parsePrice = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/[^\d.-]/g, '');
  const num = Number(str);
  return isNaN(num) ? null : num;
};

function normalizeItemFromSupabase(row) {
  if (!row) return null;
  const barcodeStr = String(row.barcode ?? '').trim();
  const price = parsePrice(row.full_price) || 0;
  const disc = parsePrice(row.price_after_disc);
  // Prioritize discount price if it exists and is valid.
  // If price_after_disc is 0, it might mean "free" or "no discount data". 
  // Usually if no discount, it should be null or same as full price. 
  // We assume if it's explicitly set to a non-zero value different from price, it's the deal.
  // Safest: Use disc if Valid Number, else Price.
  const finalPrice = (disc !== null && !isNaN(disc) && disc !== 0) ? disc : price;

  return {
    id: barcodeStr,
    barcode: barcodeStr,
    name: (row.eng_name ?? '').toString().trim(),
    group: (row.brand_group ?? '').toString().trim(),
    box: row.box_count != null && row.box_count !== '' ? String(row.box_count) : '',
    price: price,
    priceAfterDiscount: finalPrice,
    stock: row.stock_count,
    image: (row.image_url ?? '').toString().trim() || null,
    isOffer: !!row.is_offer,
  };
}

const Login = lazy(() => import('./components/Login'));
const SkeletonGrid = lazy(() => import('./components/SkeletonLoader'));
import BottomNav from './components/BottomNav';
import OfferCard from './components/OfferCard';

function AddToOfferRow({ item, getImage, onAdd }) {
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(() => Math.round(item.priceAfterDiscount ?? item.price ?? 0));
  const [isFree, setIsFree] = useState(false);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-amber-300 transition-colors">
      {getImage(item) ? (
        <img src={getImage(item)} alt="" className="w-12 h-12 object-contain rounded-lg" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center"><Package size={20} className="text-slate-400" /></div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.name || item.barcode}</p>
        <p className="text-xs text-slate-500">₪{Math.round(item.price ?? 0)}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value || 1))} className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center" />
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="rounded" />
          <span className="text-emerald-600 font-medium">مجاناً</span>
        </label>
        {!isFree && (
          <input type="number" min={0} value={price} onChange={(e) => setPrice(+e.target.value || 0)} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-right" placeholder="السعر" />
        )}
        <button onClick={() => onAdd(item, qty, price, isFree)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">
          إضافة
        </button>
      </div>
    </div>
  );
}



function App() {


  /* Login State */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'customer'
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('sales_auth');
    const role = localStorage.getItem('sales_role');
    if (auth === 'true') {
      setIsAuthenticated(true);
      setUserRole(role || 'customer');
    }
    setHasCheckedAuth(true);
  }, []);

  const handleLogin = (username, password, setError) => {
    if (username === 'admin' && password === '123456') {
      localStorage.setItem('sales_auth', 'true');
      localStorage.setItem('sales_role', 'admin');
      setIsAuthenticated(true);
      setUserRole('admin');
    } else if (username === '123' && password === '321') {
      localStorage.setItem('sales_auth', 'true');
      localStorage.setItem('sales_role', 'customer');
      setIsAuthenticated(true);
      setUserRole('customer');
      setIsAuthenticated(true);
      setUserRole('customer');
    } else if (username === 'supervisor' && password === '123') {
      localStorage.setItem('sales_auth', 'true');
      localStorage.setItem('sales_role', 'supervisor');
      setIsAuthenticated(true);
      setUserRole('supervisor');
    } else {
      setError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('sales_auth');
      localStorage.removeItem('sales_role');
      setIsAuthenticated(false);
      setUserRole(null);
    }
  };

  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'customer'
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
  const [submittedOrders, setSubmittedOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderActionLoading, setOrderActionLoading] = useState(false);
  const [mode, setMode] = useState('order'); // 'order' | 'catalog' | 'submitted' | 'offers'
  const [sortMode, setSortMode] = useState('barcode'); // 'barcode' | 'name'

  // Custom offers: [{ id, title, items: [{ barcode, quantity, offerPrice, isFree }] }]
  const [customOffers, setCustomOffers] = useState(() => {
    try {
      const s = localStorage.getItem('sales_custom_offers');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerSearch, setOfferSearch] = useState('');
  const [offersLoaded, setOffersLoaded] = useState(false);

  const fetchCustomOffers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('custom_offers').select('id, title, items, created_at').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        const parsed = data.map((r) => ({ id: r.id, title: r.title || 'عرض', items: Array.isArray(r.items) ? r.items : [] }));
        setCustomOffers(parsed);
        try { localStorage.setItem('sales_custom_offers', JSON.stringify(parsed)); } catch (_) { }
      } else if (!error && (!data || data.length === 0)) {
        const local = (() => { try { const s = localStorage.getItem('sales_custom_offers'); return s ? JSON.parse(s) : []; } catch { return []; } })();
        if (local.length > 0) {
          for (const o of local) {
            try {
              await supabase.from('custom_offers').upsert({ id: o.id, title: o.title || 'عرض', items: o.items || [], updated_at: new Date().toISOString() }, { onConflict: 'id' });
            } catch (_) { }
          }
        }
      }
    } catch (e) { console.warn('fetchCustomOffers:', e); }
    setOffersLoaded(true);
  }, []);

  useEffect(() => {
    fetchCustomOffers();
  }, [fetchCustomOffers]);

  useEffect(() => {
    if (!offersLoaded) return;
    try {
      localStorage.setItem('sales_custom_offers', JSON.stringify(customOffers));
    } catch (e) { console.warn('Could not save offers:', e); }
  }, [customOffers, offersLoaded]);

  const fetchSubmittedOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: false });
    setOrdersLoading(false);
    setOrdersLoading(false);
    if (error) {
      console.error('Orders fetch error:', error);
      const msg = error.message || '';

      // Fallback: If 'status' column missing, retry without filter
      if (msg.includes('column orders.status does not exist')) {
        console.warn('Status column missing, fetching all orders...');
        const { data: retryData, error: retryError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!retryError) {
          setSubmittedOrders(retryData ?? []);
          return;
        }
      }

      setSubmittedOrders([]);
      const tableNotFound = /schema cache|could not find.*table.*orders/i.test(msg);
      setOrdersError(tableNotFound
        ? "جدول الطلبات غير موجود في Supabase. أنشئ الجدول أولاً: SQL Editor → شغّل الـ SQL الموجود في ملف ORDERS_SUPABASE.md في المشروع."
        : (msg || 'Could not load orders. Check Supabase: table "orders" must exist and allow SELECT (see ORDERS_SUPABASE.md).'));
      return;
    }
    setSubmittedOrders(data ?? []);
  }, []);

  useEffect(() => {
    if (mode === 'submitted' && userRole === 'supervisor') fetchSubmittedOrders();
    else setOrdersError(null);
  }, [mode, userRole, fetchSubmittedOrders]);

  useEffect(() => {
    if (selectedOrder) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [selectedOrder]);

  const markOrderToPrepareLater = useCallback(async (order) => {
    if (!order?.id) return;
    setOrderActionLoading(true);
    try {
      const { error } = await supabase.from('orders').update({ status: 'to_prepare' }).eq('id', order.id);
      if (error) throw error;
      setSelectedOrder(null);
      fetchSubmittedOrders();
    } catch (e) {
      console.error(e);
      alert('تعذر تحديث الطلب: ' + (e.message || e));
    } finally {
      setOrderActionLoading(false);
    }
  }, [fetchSubmittedOrders]);

  const deleteOrder = useCallback(async (order) => {
    if (!order?.id || !confirm('حذف الطلب #' + order.id + '؟ لا يمكن التراجع.')) return;
    setOrderActionLoading(true);
    try {
      const { data, error } = await supabase.from('orders').delete().eq('id', order.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('لم يتم الحذف من قاعدة البيانات. تأكد من إضافة سياسة DELETE لجدول orders في Supabase (انظر ORDERS_SUPABASE.md).');
        return;
      }
      setSelectedOrder(null);
      setSubmittedOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (e) {
      console.error(e);
      alert('تعذر حذف الطلب: ' + (e.message || e));
    } finally {
      setOrderActionLoading(false);
    }
  }, []);

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

  // Quantity Modal State
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityItem, setQuantityItem] = useState(null);
  const [quantityValue, setQuantityValue] = useState(1);

  // Quick Name Edit State
  const [editingNameItem, setEditingNameItem] = useState(null);
  const [newName, setNewName] = useState('');

  const openNameEditModal = (item) => {
    setEditingNameItem(item);
    setNewName(item.name || '');
  };

  const saveNameEdit = async () => {
    if (!editingNameItem || !newName.trim()) return;
    try {
      const { error } = await supabase
        .from('items')
        .update({ eng_name: newName.trim() })
        .eq('barcode', editingNameItem.barcode);

      if (error) throw error;

      // Update local state
      setItems((prev) =>
        prev.map((i) =>
          i.barcode === editingNameItem.barcode ? { ...i, name: newName.trim() } : i
        )
      );
      setEditingNameItem(null);
      setNewName('');
    } catch (err) {
      alert('Failed to update name: ' + err.message);
    }
  };


  const [isPending, startTransition] = useTransition();

  const setOrderInfoField = (key, value) =>
    setOrderInfo((prev) => ({ ...prev, [key]: value }));



  const getItemByBarcode = (barcode) => items.find((i) => String(i.barcode) === String(barcode));

  const createNewOffer = () => {
    const id = 'o_' + Date.now();
    setCustomOffers((prev) => [...prev, { id, title: 'عرض جديد', items: [] }]);
    setEditingOffer({ id, title: 'عرض جديد', items: [] });
  };

  const addProductToOffer = (item, quantity, offerPrice, isFree) => {
    if (!editingOffer) return;
    const entry = { barcode: item.barcode, quantity: Math.max(1, Math.round(Number(quantity)) || 1), offerPrice: isFree ? 0 : (Number(offerPrice) || 0), isFree: !!isFree };
    setEditingOffer((prev) => ({
      ...prev,
      items: [...(prev.items.filter((x) => x.barcode !== item.barcode)), entry],
    }));
  };

  const removeFromEditingOffer = (barcode) => {
    setEditingOffer((prev) => prev ? { ...prev, items: prev.items.filter((x) => x.barcode !== barcode) } : null);
  };

  const saveOffer = async () => {
    if (!editingOffer || editingOffer.items.length === 0) {
      alert('أضف منتجاً واحداً على الأقل للعرض');
      return;
    }
    const offerData = { id: editingOffer.id, title: editingOffer.title || 'عرض', items: editingOffer.items, updated_at: new Date().toISOString() };
    setCustomOffers((prev) => {
      const next = prev.filter((o) => o.id !== editingOffer.id);
      next.push({ id: offerData.id, title: offerData.title, items: offerData.items });
      return next;
    });
    setEditingOffer(null);
    try {
      await supabase.from('custom_offers').upsert(offerData, { onConflict: 'id' });
    } catch (e) { console.warn('Supabase save offer:', e); }
  };

  const deleteOffer = async (id) => {
    if (!window.confirm('حذف هذا العرض؟')) return;
    setCustomOffers((prev) => prev.filter((o) => o.id !== id));
    if (editingOffer?.id === id) setEditingOffer(null);
    try {
      await supabase.from('custom_offers').delete().eq('id', id);
    } catch (e) { console.warn('Supabase delete offer:', e); }
  };

  const startEditOffer = (offer) => {
    setEditingOffer({ id: offer.id, title: offer.title, items: [...offer.items] });
  };

  const abortControllerRef = useRef(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let allItems = [];
    let errorToThrow = null;

    try {
      // First try with is_offer
      const { data, error } = await supabase
        .from('items')
        .select(ITEMS_SELECT);

      if (error) {
        // If column missing, fallback to base query
        if (error.message?.includes('column items.is_offer does not exist') || error.code === '42703') {
          console.warn('is_offer column missing, falling back to base items query...');
          const BASE_SELECT = 'barcode, eng_name, brand_group, box_count, full_price, price_after_disc, stock_count, image_url';
          const { data: retryData, error: retryError } = await supabase
            .from('items')
            .select(BASE_SELECT);

          if (retryError) throw retryError;
          allItems = retryData || [];
        } else {
          throw error;
        }
      } else {
        allItems = data || [];
      }

      const normalized = allItems.map(normalizeItemFromSupabase).filter(Boolean);
      const sorted = sortByBarcodeOrder(normalized, BARCODE_ORDER);
      setItems(sorted);
      setHasMore(false);
    } catch (err) {
      console.error('Supabase fetch error:', err);
      // Even on error, we don't want to crash. 
      // If items were already loaded, keep them? Or maybe show empty
      // But here we just log it.
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Removed pagination and server-side search effects
  const loadMore = () => { };
  const loadMoreRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const filteredByGroup = useMemo(
    () =>
      selectedGroup == null
        ? items
        : selectedGroup === '__electrical__'
          ? items.filter((i) => isElectricalGroup(i.group))
          : selectedGroup === '__home__'
            ? items.filter((i) => !isElectricalGroup(i.group))
            : items.filter((i) => i.group === selectedGroup),
    [items, selectedGroup]
  );

  const filteredItems = useMemo(
    () => {
      let list = filteredByGroup;
      // In offers mode, non-admins see only offers. Admins see all (to manage them).
      if (mode === 'offers' && userRole !== 'admin') {
        list = list.filter((i) => i.isOffer);
      }
      return search.trim()
        ? list.filter(
          (i) =>
            (i.name || '').toLowerCase().includes(search.trim().toLowerCase()) ||
            (i.barcode || '').toString().includes(search.trim())
        )
        : list;
    },
    [filteredByGroup, search, mode, userRole]
  );

  const allGroups = useMemo(
    () => [...new Set(items.map((i) => i.group).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))),
    [items]
  );
  const electricalGroupsSorted = useMemo(() => {
    const electrical = allGroups.filter(isElectricalGroup);
    return [...electrical].sort((a, b) => {
      const ia = ELECTRICAL_GROUPS.indexOf(String(a).trim().toLowerCase());
      const ib = ELECTRICAL_GROUPS.indexOf(String(b).trim().toLowerCase());
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return String(a).localeCompare(String(b));
    });
  }, [allGroups]);
  const electricalIcons = [Zap, Plug, Power, Cable, Battery, BatteryCharging, PlugZap, Cpu];
  const kitchenwareGroupsSorted = useMemo(() => {
    const kitchenware = allGroups.filter((g) => !isElectricalGroup(g));
    return [...kitchenware].sort((a, b) => {
      const ia = HOUSEHOLD_GROUPS.indexOf(String(a).trim().toLowerCase());
      const ib = HOUSEHOLD_GROUPS.indexOf(String(b).trim().toLowerCase());
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return String(a).localeCompare(String(b));
    });
  }, [allGroups]);
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
  const getImageFallback = (item) => {
    const primary = getPublicImageUrl(item?.image);
    if (primary) return primary;
    if (!item?.barcode) return null;
    const b = String(item.barcode).trim();
    if (!b) return null;
    const paths = [`electric/${b}.jpg`, `electric/${b}.jpeg`, `electric/${b}.png`, `${b}.jpg`, `${b}.jpeg`];
    for (const p of paths) {
      const url = getPublicImageUrl(p);
      if (url) return url;
    }
    return null;
  };

  /* Catalog Helpers */


  const addToOrder = useCallback((item, qty = 1) => {
    startTransition(() => {
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
          { id: item.id, qty: qty, unitPrice, box, item, customName: item.name },
        ];
      });
    });
  }, [startTransition]);

  const removeFromOrder = useCallback((itemId) => {
    startTransition(() => setOrderItems((prev) => prev.filter((x) => x.id !== itemId)));
  }, [startTransition]);

  const setOrderQty = useCallback((itemId, qty) => {
    const n = Math.max(0, parseInt(qty, 10) || 0);
    startTransition(() => {
      if (n === 0) setOrderItems((prev) => prev.filter((x) => x.id !== itemId));
      else setOrderItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, qty: n } : x)));
    });
  }, [startTransition]);

  const setOrderLinePrice = (itemId, value) => {
    const n = parseFloat(String(value).replace(',', '.')) || 0;
    setOrderItems((prev) =>
      prev.map((x) =>
        x.id === itemId ? { ...x, unitPrice: Math.max(0, Math.round(n)) } : x
      )
    );
  };

  const setOrderLineName = (itemId, value) => {
    setOrderItems((prev) =>
      prev.map((x) =>
        x.id === itemId ? { ...x, customName: value } : x
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
  const itemTotalWithTax = (lines) => (lines || orderLines).reduce((s, o) => s + getLineTotal(o), 0);

  const orderLinesByBox = [...orderLines].sort((a, b) =>
    String(getLineBox(a)).localeCompare(String(getLineBox(b)), undefined, {
      numeric: true,
    })
  );

  const getPrintHtml = useCallback((orderData) => {
    const isSubmitted = !!orderData;
    const lines = isSubmitted ? (orderData.items || []) : orderLines;
    const currentInfo = isSubmitted ? {
      companyName: orderData.customer_name || '',
      customerNumber: orderData.customer_number || '',
      merchantName: orderData.merchant_name || '', // Assuming merchant_name field or default
      phone: orderData.customer_phone || '',
      address: orderData.customer_address || '',
      orderDate: orderData.order_date || (orderData.created_at ? new Date(orderData.created_at).toISOString().slice(0, 10) : ''),
      paymentMethod: orderData.payment_method || '',
    } : orderInfo;
    const totalAmount = isSubmitted ? (orderData.total_amount || 0) : orderTotal;

    const rows = lines
      .map((o) => {
        const item = isSubmitted ? o : (o.item || {});
        // For submitted items, properties are direct. For cart items, they might be nested in item or direct
        const unitPrice = isSubmitted ? (o.unit_price || o.price || 0) : getLineUnitPrice(o);
        const total = isSubmitted ? (o.total || 0) : getLineTotal(o);
        const price = isSubmitted ? (o.consumer_price || 0) : (Number(intent?.item?.price) ?? 0);
        // fallback for consumer price: for cart items it's o.item.price. For submitted, it's consumer_price
        const consumerPrice = isSubmitted ? (o.consumer_price || 0) : (Number(o.item?.price) ?? 0);
        const discPercent = isSubmitted ? (o.discount_percent || 0) : getLineDiscountPercent(o);

        const displayName = (o.name || o.customName || item.name || '').replace(/</g, '&lt;');
        const barcode = (o.barcode || item.barcode || '').replace(/</g, '&lt;');

        return `<tr>
          <td>${displayName}</td>
          <td dir="ltr" lang="en">${barcode}</td>
          <td dir="ltr" lang="en">${o.qty}</td>
          <td dir="ltr" lang="en">₪${consumerPrice}</td>
          <td dir="ltr" lang="en">${discPercent}%</td>
          <td dir="ltr" lang="en">₪${unitPrice}</td>
          <td dir="ltr" lang="en">₪${total.toFixed(2)}</td>
        </tr>`;
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

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>Sales Order Agreement</title>
<style>
  body { font-family: system-ui; padding: 24px; max-width: 800px; margin: 0 auto; direction: rtl; }
  .print-title { font-size: 2rem; font-weight: 800; text-align: center; color: #c2410c; }
  .section-title { font-weight: 700; padding: 8px 12px; background: #fff7ed; border: 1px solid #ea580c; border-radius: 6px; color: #c2410c; margin: 1rem 0 0.5rem; }
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table td { padding: 8px 12px; border: 1px solid #d1d5db; }
  .info-label { font-weight: 600; background: #fff7ed; width: 30%; } /* Adjusted width */
  .info-value { background: #fff; }
  table.data-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  table.data-table th, table.data-table td { padding: 10px; border: 1px solid #d1d5db; text-align: right; }
  table.data-table th { background: #ea580c; color: #fff; font-size: 0.9rem; }
  table.data-table td { font-size: 0.9rem; }
  .total-row { font-weight: 700; background: #fff7ed; }
</style></head><body>
<h1 class="print-title">فاتورة مبيعات</h1>

<div class="section-title">بيانات العميل</div>
<table class="info-table"><tbody>${infoRows}</tbody></table>

<div class="section-title">تفاصيل المنتجات</div>
<table class="data-table">
  <thead>
    <tr>
      <th>وصف المنتج ورقم الموديل</th>
      <th>الرقم التسلسلي ( الباركود )</th>
      <th>العدد</th>
      <th>سعر المستهلك</th>
      <th>نسبة الخصم</th>
      <th>السعر بعد الخصم</th>
      <th>المبلغ الاجمالي ( شامل الضريبة )</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="5"></td>
      <td>المجموع</td>
      <td dir="ltr" lang="en">₪${Number(totalAmount).toFixed(2)}</td>
    </tr>
  </tbody>
</table>
</body></html>`;
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
        const name = (o.item?.name || '').replace(/</g, '&lt;');
        const group = (o.item?.group || '').replace(/</g, '&lt;');
        const box = (o.item?.box || '').replace(/</g, '&lt;');
        return `<article class="inv-card">
          <span class="inv-num" dir="ltr" lang="en">${idx + 1}</span>
          ${imgHtml}
          <div class="inv-details">
            ${name ? `<div class="inv-name">${name}</div>` : ''}
            <div class="inv-barcode">${(o.item?.barcode || '—').replace(/</g, '&lt;')}</div>
            ${group ? `<div class="inv-group">${group}</div>` : ''}
            <div class="inv-meta">
              <span class="inv-price" dir="ltr" lang="en">₪${unitPrice}</span>
              <span class="inv-qty" dir="ltr" lang="en">× ${o.qty}</span>
              ${box ? `<span class="inv-box" dir="ltr" lang="en">Box: ${box}</span>` : ''}
              ${discPercent > 0 ? `<span class="inv-disc" dir="ltr" lang="en">Discount ${discPercent}%</span>` : ''}
            </div>
          </div>
          <div class="inv-total" dir="ltr" lang="en">₪${total.toFixed(2)}</div>
        </article>`;
      })
      .join('');
    const cust = (orderInfo.companyName || orderInfo.merchantName || '—').replace(/</g, '&lt;');
    const date = (orderInfo.orderDate || '—').replace(/</g, '&lt;');
    const paymentInfo = orderInfo.paymentMethod
      ? ` &nbsp;|&nbsp; <span>Payment:</span> <span dir="ltr" lang="en">${orderInfo.paymentMethod}${orderInfo.paymentMethod === 'Checks' && orderInfo.checksCount ? ` (${orderInfo.checksCount})` : ''}</span>`
      : '';

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order Summary - PDF</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;padding:28px;max-width:720px;margin:0 auto;background:linear-gradient(160deg,#f8faff 0%,#f1f5f9 50%,#e2e8f0 100%);min-height:100vh}
.inv-wrap{background:#fff;border-radius:24px;box-shadow:0 20px 60px -15px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.04);padding:32px;overflow:hidden}
.inv-header{background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);color:#fff;padding:32px 28px;text-align:center;border-radius:20px;margin-bottom:24px;box-shadow:0 20px 40px -10px rgba(15,23,42,.4);border:1px solid rgba(255,255,255,.08)}
.inv-title{font-size:1.5rem;font-weight:800;margin:0;letter-spacing:0.05em;text-transform:uppercase;opacity:.95}
.inv-sub{font-size:.8rem;opacity:.7;margin-top:8px;letter-spacing:0.15em;font-weight:500}
.inv-info{display:flex;gap:16px;flex-wrap:wrap;padding:16px 20px;background:#f8fafc;border-radius:12px;margin-bottom:24px;font-size:.95rem;color:#475569;border:1px solid #e2e8f0}
.inv-info span{font-weight:600;color:#334155}
.inv-cards{display:flex;flex-direction:column;gap:14px}
.inv-card{display:flex;align-items:center;gap:16px;padding:16px 20px;background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:box-shadow .2s}
.inv-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
.inv-num{min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);color:#64748b;font-weight:700;font-size:.8rem;border-radius:8px}
.inv-img{width:80px;height:80px;flex-shrink:0;border-radius:12px;overflow:hidden;background:linear-gradient(145deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center}
.inv-img img{width:100%;height:100%;object-fit:contain;padding:4px}
.inv-no-img{font-size:1.8rem;opacity:.5}
.inv-details{flex:1;min-width:0}
.inv-name{font-weight:600;color:#1e293b;font-size:.95rem;margin-bottom:4px;line-height:1.4;word-break:break-word}
.inv-barcode{font-family:ui-monospace,monospace;font-size:.8rem;color:#64748b;font-weight:600}
.inv-group{font-size:.75rem;color:#6366f1;font-weight:600;margin-top:2px}
.inv-box{font-size:.75rem;color:#64748b}
.inv-meta{display:flex;gap:12px;align-items:center;margin-top:8px;flex-wrap:wrap}
.inv-price{font-weight:700;color:#ea580c;font-size:1rem}
.inv-qty{font-size:.85rem;color:#64748b}
.inv-disc{font-size:.75rem;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-weight:600}
.inv-total{font-weight:800;font-size:1.15rem;color:#ea580c;white-space:nowrap}
.inv-total-card{background:linear-gradient(135deg,#fff7ed,#ffedd5);border:2px solid #ea580c;border-radius:16px;padding:20px 24px;margin-top:24px;display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:1.25rem;color:#c2410c;box-shadow:0 4px 12px rgba(234,88,12,.15)}
.btn-print{padding:14px 32px;background:linear-gradient(135deg,#ea580c,#f97316);color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:1rem;margin-top:20px;display:block;margin-left:auto;margin-right:auto;box-shadow:0 4px 14px rgba(234,88,12,.35);transition:transform .15s,box-shadow .15s}
.btn-print:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(234,88,12,.4)}
.btn-save-order{padding:14px 32px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:1rem;margin-top:20px;display:block;width:100%;box-shadow:0 4px 14px rgba(16,185,129,.35);transition:transform .15s,box-shadow .15s}
.btn-save-order:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(16,185,129,.4)}
@media print{body{background:#fff;padding:16px}.inv-wrap{box-shadow:none;border:1px solid #e2e8f0}.btn-print,.btn-save-order{display:none}.inv-card:hover{box-shadow:none}}
</style></head><body>
<div class="inv-wrap">
  <div class="inv-header"><h1 class="inv-title">Order Summary</h1><p class="inv-sub">Products · Images · Details</p></div>
  <div class="inv-info"><span>العميل:</span> ${cust} &nbsp;|&nbsp; <span>الهاتف:</span> <span dir="ltr" lang="en">${(orderInfo.phone || '—').replace(/</g, '&lt;')}</span> &nbsp;|&nbsp; <span>التاريخ:</span> <span dir="ltr" lang="en">${date}</span>${paymentInfo}</div>
  <div class="inv-cards">${cards}</div>
  <div class="inv-total-card"><span>المجموع</span><span dir="ltr" lang="en">₪${orderTotal.toFixed(2)}</span></div>
  <button class="btn-print" onclick="window.print()">طباعة / حفظ PDF</button>
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

  const handleOpenPdfOrder = () => {
    if (orderLines.length === 0) {
      alert('السلة فارغة. أضف منتجات أولاً.');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) return;
    const html = getInventoryHtml();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const validateOrder = () => {
    if (userRole === 'customer') { // user 123
      if (!orderInfo.companyName?.trim()) return 'يرجى إدخال اسم الشركة (المشتري).';
      if (!orderInfo.merchantName?.trim()) return 'يرجى إدخال اسم التاجر (المشتري).';
      if (!orderInfo.phone?.trim()) return 'يرجى إدخال رقم الهاتف.';
      if (!orderInfo.address?.trim()) return 'يرجى إدخال العنوان.';
      if (!orderInfo.orderDate) return 'يرجى إدخال التاريخ.';
    }
    return null;
  };

  const saveOrderToSupabase = async () => {
    try {
      const orderData = {
        prepared_by: userRole === 'customer' ? '123' : userRole,
        customer_name: orderInfo.companyName,
        customer_phone: orderInfo.phone,
        customer_address: orderInfo.address,
        customer_number: orderInfo.customerNumber,
        order_date: orderInfo.orderDate,
        total_amount: orderTotal,
        items: orderLines.map(line => ({
          barcode: line.item.barcode,
          name: line.customName || line.item.name,
          qty: line.qty,
          consumer_price: Number(line.item?.price) ?? 0,
          discount_percent: getLineDiscountPercent(line),
          unit_price: getLineUnitPrice(line),
          price: getLineUnitPrice(line), // Keep for compatibility
          total: getLineTotal(line)
        })),
        details: orderInfo
      };

      const { error } = await supabase.from('orders').insert([orderData]);
      if (error) throw error;
      alert('Order submitted successfully to supervisor!');
      return true;
    } catch (err) {
      console.error('Error saving order:', err);
      alert('Note: Invoice saved locally, but failed to submit to supervisor (Database error: ' + err.message + ')');
      return false;
    }
  };



  const clearOrderAndInfo = () => {
    setOrderItems([]);
    setOrderInfo({
      companyName: '',
      merchantName: '',
      phone: '',
      address: '',
      orderDate: new Date().toISOString().slice(0, 10),
      customerNumber: '',
      paymentMethod: '',
      checksCount: '',
    });
  };

  const handleSaveInvoice = async () => {
    const error = validateOrder();
    if (error) {
      alert(error + '\nPlease fill in all required customer details.');
      setActiveTab('customer');
      return;
    }

    const saved = await saveOrderToSupabase();

    const html = getPrintHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${(orderInfo.companyName || orderInfo.merchantName || 'Order').replace(/[/\\:*?"<>|]/g, '')}-${orderInfo.orderDate || new Date().toISOString().slice(0, 10)}.html`;

    // Safer download trigger — avoid removeChild conflict with React portal on document.body
    a.style.display = 'none';
    a.setAttribute('aria-hidden', 'true');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode === document.body) document.body.removeChild(a);
      } catch (_) { /* ignore removeChild errors when React has updated body */ }
      URL.revokeObjectURL(url);
    }, 150);

    if (saved) clearOrderAndInfo();
  };

  const handleExportExcel = useCallback(async () => {
    const error = validateOrder();
    if (error) {
      alert(error + '\nPlease fill in all required customer details.');
      setActiveTab('customer');
      return;
    }
    const saved = await saveOrderToSupabase();

    const ExcelJS = (await import('exceljs')).default;
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
      ws.getCell(r, 1).value = (o.customName || o.item?.name || '').slice(0, 50);
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
    if (saved) clearOrderAndInfo();
  }, [orderLines, orderTotal, orderInfo]);

  const handleOpenInventory = () => {
    const html = getInventoryHtml();
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const openAddModal = () => {
    if (userRole !== 'admin') return;
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
    if (userRole !== 'admin') return;
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
    if (userRole !== 'admin') return;
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
    if (userRole !== 'admin') return;
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
    if (userRole !== 'admin') return;
    const file = e.target.files?.[0];
    if (!file) return;
    const barcode = item?.barcode || formData.barcode;
    if (!barcode) {
      alert('Barcode is required to upload an image.');
      return;
    }

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${barcode}_${Date.now()}.${ext}`;
      setUploading(true);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('items')
        .update({ image_url: fileName })
        .eq('barcode', barcode);
      if (dbError) throw dbError;

      setItems((prev) =>
        prev.map((i) => (i.barcode === barcode ? { ...i, image: fileName } : i))
      );
      if (editingItem && editingItem.barcode === barcode) {
        setEditingItem((p) => (p ? { ...p, image: fileName } : null));
        setFormData((p) => ({ ...p, image_url: fileName }));
      }
    } catch (err) {
      console.error('Upload Error:', err);
      alert('Failed to upload image: ' + (err?.message || err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cardUploadRef.current) cardUploadRef.current.value = '';
      e.target.value = '';
    }
  };

  const cardUploadRef = useRef(null);
  const cardUploadItemRef = useRef(null);
  const triggerCardImageUpload = (item) => {
    if (!item?.barcode) return;
    cardUploadItemRef.current = item;
    cardUploadRef.current?.click?.();
  };

  const handleOpenQuantityModal = (item) => {
    setQuantityItem(item);
    // Default to box count if available and valid number, otherwise 1
    const boxCount = item.box ? parseInt(item.box) : 1;
    setQuantityValue(boxCount > 0 ? boxCount : 1);
    setShowQuantityModal(true);
  };

  const handleConfirmQuantity = () => {
    if (quantityItem && quantityValue > 0) {
      addToOrder(quantityItem, quantityValue);
      setShowQuantityModal(false);
      setQuantityItem(null);
      setQuantityValue(1);
      setShowOrderPanel(true);
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
            <div class="cat-details">
              <span class="cat-group">${item.group || '—'}</span>
              <span class="cat-barcode">${item.barcode}</span>
            </div>
            <div class="cat-prices">
               ${item.priceAfterDiscount && item.priceAfterDiscount < item.price
          ? `<div class="price-row"><span class="lbl">Consumer:</span> <span class="val old">₪${item.price}</span></div>
                     <div class="price-row"><span class="lbl">Discount:</span> <span class="val new">₪${item.priceAfterDiscount}</span></div>`
          : `<div class="price-row"><span class="lbl">Price:</span> <span class="val">₪${item.price ?? 0}</span></div>`
        }
            </div>
          </div>
        </div>
      `;
    }).join('');

    const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>Maslamani Sales Catalog</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700;900&display=swap');
  body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; background: white; color: #1e293b; }
  
  /* Brand Header */
  .brand-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
  
  .brand-left { display: flex; align-items: center; gap: 16px; }
  .brand-logo { 
    width: 60px; height: 60px; 
    background: linear-gradient(135deg, #ec4899 0%, #e11d48 100%); 
    border-radius: 16px; 
    display: flex; align-items: center; justify-content: center;
    color: white; 
    box-shadow: 0 10px 20px rgba(225, 29, 72, 0.2);
  }
  .brand-text h1 { font-size: 1.8rem; font-weight: 900; margin: 0; line-height: 1; color: #1e293b; letter-spacing: -1px; }
  .brand-text h1 span { font-weight: 300; color: #64748b; }
  .brand-date { font-size: 0.75rem; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; margin-top: 6px; }

  /* Modern Title */
  .catalog-title { text-align: right; }
  .catalog-title h2 { font-size: 3rem; font-weight: 900; line-height: 0.8; color: #f1f5f9; text-transform: uppercase; margin: 0; letter-spacing: -2px; }
  .catalog-title h3 { font-size: 1.2rem; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 4px; margin-right: 4px; }

  .cat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .cat-card { border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; page-break-inside: avoid; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  
  .cat-img { height: 180px; display: flex; align-items: center; justify-content: center; background: #f8fafc; padding: 10px; }
  .cat-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .cat-no-img { font-size: 3rem; opacity: 0.3; }
  
  .cat-info { padding: 12px; text-align: center; }
  .cat-name { font-weight: 700; font-size: 0.95rem; color: #1e293b; margin-bottom: 8px; line-height: 1.3; height: 2.6em; overflow: hidden; }
  .cat-details { display: flex; justify-content: center; gap: 8px; font-size: 0.75rem; color: #64748b; margin-bottom: 8px; }
  .cat-group { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .cat-barcode { font-family: monospace; }
  .cat-prices { border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 8px; }
  .price-row { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 2px; }
  .lbl { color: #94a3b8; font-size: 0.75rem; }
  .val { font-weight: 700; color: #334155; }
  .val.old { text-decoration: line-through; color: #94a3b8; }
  .val.new { color: #ea580c; font-weight: 800; }

  @media print {
    body { padding: 0; }
    .cat-card { break-inside: avoid; }
  }
  </style>
</head>
<body>
  <div class="brand-header">
    <div class="brand-left">
        <div class="brand-logo">
            <!-- Grid Icon SVG -->
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        </div>
        <div class="brand-text">
            <h1>Maslamani<span>Sales</span></h1>
            <div class="brand-date">${dateStr}</div>
        </div>
    </div>
    <div class="catalog-title">
        <h3>Collection</h3>
        <h2>Catalog</h2>
    </div>
  </div>

  <div class="cat-grid">
    ${cards}
  </div>
    <script>
      // Wait for images to load before printing
      window.onload = function() {
        // Simple timeout to allow images to render if cached or fast
        setTimeout(function() {
          window.print();
        }, 800);
      };
    </script>
</body>
</html>`;
  }, []);

  const addToCatalog = (item) => {
    setCatalogItems(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
    setShowCatalogPanel(true); // Auto-open panel
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
    if (userRole !== 'admin') return;
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

  if (!hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-sm font-medium">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-pulse text-slate-400 text-sm font-medium">Loading…</div>
        </div>
      }>
        <Login onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
    <div
      className={`font-sans flex h-screen overflow-hidden text-slate-800 ${(showOrderPanel || showCatalogPanel) ? 'flex-row min-h-0' : 'flex-col'}`}
    >
      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden transition-all duration-500 ${(showOrderPanel || showCatalogPanel) ? 'p-3 sm:p-4' : 'p-0 sm:p-0'}`}
      >
        <div className={`flex-1 min-h-0 flex flex-col overflow-hidden relative ${(showOrderPanel || showCatalogPanel) ? 'rounded-3xl bg-white/40 shadow-xl border border-white/50' : ''}`}>

          {/* Header */}
          <header className={`flex-shrink-0 z-30 transition-all duration-300 ${(showOrderPanel || showCatalogPanel) ? 'rounded-t-3xl pt-4 px-6 pb-2' : 'glass-panel sticky top-0 px-6 py-4'}`}>
            <div className="flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto w-full">
              <div className="flex items-center gap-4 shrink-0">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${mode === 'catalog' ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-rose-500/30 rotate-3' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30 -rotate-3'}`}>
                  {mode === 'catalog' ? <Grid className="text-white drop-shadow-md" size={24} /> : <Package className="text-white drop-shadow-md" size={24} />}
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">Maslamani<span className="font-light">Sales</span></h1>
                  <p className="text-slate-500 text-xs font-medium tracking-wide uppercase">
                    {safeLocaleDate({ weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-auto shrink-0">
                <div className="hidden sm:flex bg-slate-100/50 p-1 rounded-xl border border-white/50 backdrop-blur-sm">
                  {userRole === 'supervisor' && (
                    <button
                      onClick={() => { setMode('submitted'); setShowOrderPanel(false); }}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'submitted' ? 'bg-white shadow-md text-emerald-600 scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Orders
                    </button>
                  )}
                  <button
                    onClick={() => { setMode('order'); setShowOrderPanel(false); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'order' ? 'bg-white shadow-md text-indigo-600 scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Sales
                  </button>
                  <button
                    onClick={() => { setMode('offers'); setShowOrderPanel(false); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'offers' ? 'bg-white shadow-md scale-105' : ''} ${customOffers.length > 0 ? 'text-amber-500 hover:text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Offers
                  </button>
                  {userRole !== 'customer' && (
                    <button
                      onClick={() => { setMode('catalog'); setShowOrderPanel(false); }}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'catalog' ? 'bg-white shadow-md text-rose-600 scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Catalog
                    </button>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-3 rounded-xl bg-white/50 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-all border border-white/60 hover:scale-105 active:scale-95"
                  title="Logout"
                >
                  <Power size={20} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </header>

          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
            <div className="max-w-7xl mx-auto w-full pb-20">

              {/* Hero Section */}
              {!loading && !showOrderPanel && mode !== 'submitted' && (
                <div className="px-6 py-8 sm:py-12 flex flex-col items-center text-center animate-fade-in">

                  <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                    Explore our premium collection of electrical appliances and kitchenware.
                    Select items to create a new order or manage your catalog.
                  </p>

                  {/* Search Bar & Sort */}
                  <div className="w-full max-w-2xl mt-8 flex flex-col sm:flex-row items-center gap-4 z-20">
                    <div className="relative group w-full flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
                      </div>
                      <input
                        type="text"
                        className="block w-full pl-11 pr-4 py-4 bg-white/80 border-0 ring-1 ring-slate-200/60 rounded-2xl text-slate-900 placeholder:text-slate-400 shadow-lg shadow-indigo-500/5 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-300 text-lg"
                        placeholder="Search product name or barcode..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                      />
                      {search && (
                        <button
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-rose-500 transition-colors"
                          onClick={() => setSearch('')}
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setSortMode(s => s === 'barcode' ? 'name' : 'barcode')}
                      className="px-6 py-4 rounded-2xl bg-white/80 hover:bg-white text-slate-600 font-bold shadow-lg shadow-indigo-500/5 hover:shadow-indigo-500/10 transition-all flex items-center gap-3 shrink-0 ring-1 ring-slate-200/60 hover:ring-indigo-500/50"
                    >
                      <ArrowUpDown size={20} className={sortMode === 'name' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>{sortMode === 'barcode' ? 'By Name' : 'By Barcode'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Submitted Orders View */}
              {!loading && mode === 'submitted' && (
                <div className="p-6 max-w-5xl mx-auto animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h2 className="text-3xl font-bold text-slate-800">Submitted Orders</h2>
                    <button
                      type="button"
                      onClick={fetchSubmittedOrders}
                      disabled={ordersLoading}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                    >
                      {ordersLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                      {ordersLoading ? 'Loading…' : 'Refresh'}
                    </button>
                  </div>
                  {ordersError && (
                    <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                      <p className="font-medium">{ordersError}</p>
                      <p className="mt-2 text-amber-700 text-xs">إذا ظهر &quot;table not found&quot;: أنشئ جدول orders من Supabase → SQL Editor ثم شغّل الـ SQL في ملف ORDERS_SUPABASE.md. إذا الجدول موجود ولا تظهر الطلبات: Table Editor → orders → RLS وأضف سياسة SELECT لـ anon.</p>
                      <button type="button" onClick={fetchSubmittedOrders} className="mt-3 px-4 py-2 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium text-sm">Retry</button>
                    </div>
                  )}
                  {ordersLoading && submittedOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                      <p className="text-slate-500 font-medium">Loading orders…</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {submittedOrders.map((order, i) => (
                        <div
                          key={order.id || i}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedOrder(order)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedOrder(order); } }}
                          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-slate-200 transition-all gap-4 cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">#{order.id || i + 1}</span>
                              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                                {new Date(order.created_at || order.order_date || Date.now()).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">{order.customer_name || 'Unknown Client'}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                              Prepared by: <span className="font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{order.prepared_by}</span>
                            </p>
                            {order.customer_phone && <p className="text-xs text-slate-400 mt-1">{order.customer_phone}</p>}
                            {order.customer_address && <p className="text-xs text-slate-400">{order.customer_address}</p>}
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <p className="text-2xl font-black text-slate-800">₪{Number(order.total_amount).toLocaleString()}</p>
                            <p className="text-xs text-slate-400 font-medium">{order.items?.length || 0} items</p>
                          </div>
                        </div>
                      ))}
                      {!ordersLoading && submittedOrders.length === 0 && !ordersError && (
                        <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                          <Package size={48} className="mx-auto text-slate-300 mb-4" />
                          <p className="text-slate-400 font-medium">No submitted orders found.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order detail modal — rendered in document.body so it always covers full viewport */}
                  {selectedOrder && createPortal(
                    <div
                      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                      onClick={() => !orderActionLoading && setSelectedOrder(null)}
                    >
                      <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                          <h2 className="text-xl font-bold text-slate-800">تفاصيل الطلب #{selectedOrder.id}</h2>
                          <button type="button" onClick={() => setSelectedOrder(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close"><X size={20} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <p><span className="text-slate-400 font-medium">العميل:</span> <span className="font-semibold text-slate-800">{selectedOrder.customer_name || '—'}</span></p>
                            {selectedOrder.customer_phone && <p><span className="text-slate-400 font-medium">الهاتف:</span> {selectedOrder.customer_phone}</p>}
                            {selectedOrder.customer_address && <p><span className="text-slate-400 font-medium">العنوان:</span> {selectedOrder.customer_address}</p>}
                            {selectedOrder.customer_number && <p><span className="text-slate-400 font-medium">رقم العميل:</span> {selectedOrder.customer_number}</p>}
                            <p><span className="text-slate-400 font-medium">أعدّه:</span> <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">{selectedOrder.prepared_by || '—'}</span></p>
                            <p><span className="text-slate-400 font-medium">التاريخ:</span> {selectedOrder.order_date || (selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : '—')}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">الأصناف ({selectedOrder.items?.length || 0})</h3>
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="text-right py-2 px-3 font-medium text-slate-600">الصنف</th>
                                    <th className="text-center py-2 px-2 font-medium text-slate-600">الكمية</th>
                                    <th className="text-left py-2 px-3 font-medium text-slate-600">السعر</th>
                                    <th className="text-left py-2 px-3 font-medium text-slate-600">الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selectedOrder.items || []).map((row, idx) => (
                                    <tr key={idx} className="border-t border-slate-100">
                                      <td className="py-2 px-3 text-slate-800">{row.name || row.barcode || '—'}</td>
                                      <td className="py-2 px-2 text-center text-slate-600">{row.qty ?? '—'}</td>
                                      <td className="py-2 px-3 text-slate-600">₪{Number(row.price ?? 0).toLocaleString()}</td>
                                      <td className="py-2 px-3 font-medium text-slate-800">₪{Number(row.total ?? 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <p className="text-lg font-black text-slate-800 pt-2">المجموع: ₪{Number(selectedOrder.total_amount ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex flex-wrap gap-3 shrink-0">

                          {/* Approve (Agree) Button -> PDF + Complete */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedOrder) return;
                              setOrderActionLoading(true);
                              try {
                                // 1. Generate HTML & Print
                                const html = getPrintHtml(selectedOrder);
                                const w = window.open('', '_blank');
                                if (w) {
                                  w.document.write(html);
                                  w.document.close();
                                  w.focus();
                                  // Give time for images to load if any, though here it's mostly text
                                  setTimeout(() => {
                                    w.print();
                                    // w.close(); // Optional: close after print
                                  }, 500);
                                }

                                // 2. Mark as completed in Supabase
                                const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', selectedOrder.id);
                                if (error) {
                                  if (error.message?.includes('column "status" of relation "orders" does not exist')) {
                                    throw new Error('Missing "status" column. Please checking ORDERS_SUPABASE.md and run the SQL migration.');
                                  }
                                  throw error;
                                }

                                // 3. Remove from UI
                                setSubmittedOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
                                setSelectedOrder(null);

                              } catch (e) {
                                console.error(e);
                                alert('Error processing order: ' + e.message);
                              } finally {
                                setOrderActionLoading(false);
                              }
                            }}
                            disabled={orderActionLoading}
                            className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {orderActionLoading ? <Loader2 size={18} className="animate-spin" /> : <div className="flex items-center gap-2"><span className="text-lg">✓</span> موافق</div>}
                          </button>

                          {/* Excel Export Button */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedOrder) return;
                              setOrderActionLoading(true);
                              try {
                                const ExcelJS = (await import('exceljs')).default;
                                const wb = new ExcelJS.Workbook();
                                const ws = wb.addWorksheet('Order Details', { views: [{ rightToLeft: true }] });

                                ws.columns = [
                                  { header: 'Item', key: 'name', width: 30 },
                                  { header: 'Barcode', key: 'barcode', width: 15 },
                                  { header: 'Qty', key: 'qty', width: 10 },
                                  { header: 'Price', key: 'price', width: 12 },
                                  { header: 'Total', key: 'total', width: 12 },
                                ];

                                (selectedOrder.items || []).forEach(item => {
                                  ws.addRow({
                                    name: item.name || item.customName,
                                    barcode: item.barcode,
                                    qty: item.qty,
                                    price: item.unit_price || item.price,
                                    total: item.total
                                  });
                                });

                                ws.addRow({});
                                ws.addRow({ name: 'Total Amount', total: selectedOrder.total_amount });

                                const buf = await wb.xlsx.writeBuffer();
                                const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Order_${selectedOrder.id}_${selectedOrder.customer_name || ''}.xlsx`;
                                a.click();
                                URL.revokeObjectURL(url);

                              } catch (e) {
                                console.error(e);
                                alert('Error exporting Excel: ' + e.message);
                              } finally {
                                setOrderActionLoading(false);
                              }
                            }}
                            disabled={orderActionLoading}
                            className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <FileText size={18} /> Excel
                          </button>

                          <button type="button" onClick={() => deleteOrder(selectedOrder)} disabled={orderActionLoading} className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                            {orderActionLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            حذف الطلب
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              )}

              {/* Categories */}
              {!loading && mode !== 'submitted' && (
                <div className={`sticky top-0 z-20 px-4 sm:px-6 py-4 transition-all duration-300 ${!showOrderPanel && 'backdrop-blur-md bg-white/30 border-y border-white/40'}`}>
                  <div className="flex flex-wrap justify-center gap-3">
                    {[
                      { key: null, label: 'All', count: items.length, icon: null, type: 'all' },
                      { key: '__electrical__', label: 'Electrical', count: items.filter((i) => isElectricalGroup(i.group)).length, icon: Zap, type: 'electrical' },
                      { key: '__home__', label: 'Kitchenware', count: items.filter((i) => !isElectricalGroup(i.group)).length, icon: UtensilsCrossed, type: 'household' },
                    ].map(({ key, label, count, icon: Icon, type }) => {
                      const isSelected = selectedGroup === key || (key === '__electrical__' && selectedGroup && isElectricalGroup(selectedGroup)) || (key === '__home__' && selectedGroup && !isElectricalGroup(selectedGroup));

                      let activeClass = 'bg-slate-100/80 text-slate-600 hover:bg-white hover:shadow-md';
                      if (isSelected) {
                        if (type === 'electrical') activeClass = 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 scale-105';
                        else if (type === 'household') activeClass = 'bg-gradient-to-r from-sky-400 to-cyan-500 text-white shadow-lg shadow-sky-500/30 scale-105';
                        else activeClass = 'bg-slate-800 text-white shadow-lg scale-105';
                      }

                      return (
                        <button
                          key={key ?? 'all'}
                          onClick={() => setSelectedGroup(key)}
                          className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border border-transparent ${activeClass}`}
                        >
                          {Icon && <Icon size={18} className={isSelected ? 'animate-pulse' : ''} />}
                          <span>{label}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isSelected ? 'bg-white/20' : 'bg-slate-200/50'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sub-categories */}
                  {(selectedGroup === '__electrical__' || (selectedGroup && isElectricalGroup(selectedGroup))) && electricalGroupsSorted.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4 animate-fade-in">
                      <button onClick={() => setSelectedGroup('__electrical__')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup === '__electrical__' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-white/60 text-slate-600 hover:bg-white'}`}>All</button>
                      {electricalGroupsSorted.map((g) => (
                        <button
                          key={g}
                          onClick={() => setSelectedGroup(g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup && String(selectedGroup).trim().toLowerCase() === g.trim().toLowerCase() ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-white/60 text-slate-600 hover:bg-white hover:text-indigo-600'}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                  {(selectedGroup === '__home__' || (selectedGroup && selectedGroup !== '__electrical__' && !isElectricalGroup(selectedGroup))) && kitchenwareGroupsSorted.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4 animate-fade-in">
                      <button onClick={() => setSelectedGroup('__home__')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup === '__home__' ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-200' : 'bg-white/60 text-slate-600 hover:bg-white'}`}>All</button>
                      {kitchenwareGroupsSorted.map((g) => (
                        <button
                          key={g}
                          onClick={() => setSelectedGroup(g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup && String(selectedGroup).trim().toLowerCase() === g.trim().toLowerCase() ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-white/60 text-slate-600 hover:bg-white hover:text-sky-600'}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Product Grid */}
              <input
                ref={cardUploadRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const it = cardUploadItemRef.current;
                  if (it) handleImageUpload(e, it);
                }}
              />

              <div className="px-4 sm:px-6 mt-6">
                {loading ? (
                  <Suspense fallback={<div className="min-h-[40vh] animate-pulse bg-slate-100/50 rounded-2xl" />}>
                    <SkeletonGrid />
                  </Suspense>
                ) : mode === 'offers' ? (
                  /* Custom Offers - اختيار المنتجات للعروض */
                  <div className="space-y-8 animate-fade-in">
                    {userRole === 'admin' && (
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          onClick={createNewOffer}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          <Plus size={22} /> إنشاء عرض جديد
                        </button>
                        {editingOffer && (
                          <button
                            onClick={() => setEditingOffer(null)}
                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium"
                          >
                            إلغاء
                          </button>
                        )}
                      </div>
                    )}

                    {/* Editing Offer Panel */}
                    {editingOffer && userRole === 'admin' && (
                      <div className="rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                          <input
                            type="text"
                            value={editingOffer.title}
                            onChange={(e) => setEditingOffer((p) => ({ ...p, title: e.target.value }))}
                            className="text-xl font-bold bg-transparent border-b-2 border-amber-300 outline-none py-1 px-2 text-slate-800"
                            placeholder="اسم العرض"
                          />
                          <div className="flex items-center gap-2">
                            <button onClick={saveOffer} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700">
                              حفظ العرض
                            </button>
                            <button onClick={() => setEditingOffer(null)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200">
                              <X size={20} />
                            </button>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Product picker */}
                          <div>
                            <p className="text-sm font-bold text-slate-600 mb-3">اختر المنتجات للإضافة:</p>
                            <input
                              type="text"
                              value={offerSearch}
                              onChange={(e) => setOfferSearch(e.target.value)}
                              placeholder="بحث بالاسم أو الباركود..."
                              className="w-full mb-4 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-400"
                            />
                            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                              {(offerSearch.trim()
                                ? items.filter(
                                  (i) =>
                                    (i.name || '').toLowerCase().includes(offerSearch.trim().toLowerCase()) ||
                                    (i.barcode || '').toString().includes(offerSearch.trim())
                                )
                                : items.slice(0, 50)
                              ).map((item) => (
                                <AddToOfferRow
                                  key={item.id}
                                  item={item}
                                  getImage={getImage}
                                  onAdd={addProductToOffer}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Items in offer */}
                          <div>
                            <p className="text-sm font-bold text-slate-600 mb-3">منتجات العرض:</p>
                            {editingOffer.items.length === 0 ? (
                              <div className="rounded-xl border-2 border-dashed border-amber-200 bg-white/50 py-12 text-center text-slate-500">
                                لم تضف منتجات بعد
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {editingOffer.items.map((entry) => {
                                  const it = getItemByBarcode(entry.barcode);
                                  return (
                                    <div
                                      key={entry.barcode}
                                      className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm"
                                    >
                                      {it && getImage(it) ? (
                                        <img src={getImage(it)} alt="" className="w-14 h-14 object-contain rounded-lg" />
                                      ) : (
                                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center">
                                          <Package size={24} className="text-slate-400" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 truncate">{it?.name || entry.barcode}</p>
                                        <p className="text-xs text-slate-500">الكمية: {entry.quantity}</p>
                                        <p className="text-sm font-bold text-emerald-600">
                                          {entry.isFree ? (
                                            <span className="inline-flex items-center gap-1"><Gift size={14} /> مجاناً</span>
                                          ) : (
                                            <>₪{entry.offerPrice} لكل قطعة</>
                                          )}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => removeFromEditingOffer(entry.barcode)}
                                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Offer cards - عرض للعملاء والأدمن */}
                    <div className="flex flex-col gap-12 max-w-7xl mx-auto px-4 sm:px-6">
                      {customOffers.filter(offer => offer.items && offer.items.length > 0).map((offer) => (
                        <OfferCard
                          key={offer.id}
                          offer={offer}
                          getItemByBarcode={getItemByBarcode}
                          getImage={getImage}
                          getImageFallback={getImageFallback}
                          getStockStatus={getStockStatus}
                          userRole={userRole}
                          onEdit={startEditOffer}
                          onDelete={deleteOffer}
                          addOfferToOrder={(o) => o.items.forEach((e) => {
                            const it = getItemByBarcode(e.barcode);
                            if (it) addToOrder({ ...it, priceAfterDiscount: e.isFree ? 0 : e.offerPrice }, e.quantity);
                          })}
                        />
                      ))}
                    </div>

                    {customOffers.length === 0 && !editingOffer && (
                      <div className="text-center py-20 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200">
                        <Gift size={64} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">لا توجد عروض حالياً</p>
                        {userRole === 'admin' && (
                          <p className="text-sm text-slate-400 mt-2">اضغط &quot;إنشاء عرض جديد&quot; لبدء الإضافة</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-12">
                    {[
                      { title: 'Electrical Appliances', items: filteredItems.filter((i) => isElectricalGroup(i.group)), color: 'indigo', icon: Zap },
                      { title: 'Kitchenware', items: filteredItems.filter((i) => !isElectricalGroup(i.group)), color: 'sky', icon: UtensilsCrossed },
                    ].map(({ title, items: sectionItems, color, icon: Icon }) => {
                      const sorted = sortMode === 'barcode'
                        ? sortByBarcodeOrder(sectionItems, BARCODE_ORDER)
                        : [...sectionItems].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar', { sensitivity: 'base' }));
                      if (sorted.length === 0) return null;
                      return (
                        <section key={title} className="animate-fade-in">
                          <div className="flex items-center gap-3 mb-6 ml-2">
                            <div className={`p-2 rounded-xl ${color === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-sky-100 text-sky-600'}`}>
                              <Icon size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                            <span className="px-2.5 py-1 rounded-full bg-slate-200/50 text-slate-500 text-xs font-bold">{sorted.length}</span>
                          </div>

                          <div className="product-grid">
                            {sorted.map((item, index) => (
                              <div
                                key={item.id}
                                className="glass-card group flex flex-col h-full"
                                style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                              >
                                {item.group && (
                                  <div className="absolute top-3 left-3 z-10">
                                    <span className="px-2.5 py-1 rounded-lg bg-white/95 text-[10px] font-bold text-slate-600 shadow-sm border border-slate-100 uppercase tracking-wide">
                                      {item.group}
                                    </span>
                                  </div>
                                )}

                                <div className="aspect-[4/3] p-6 relative flex items-center justify-center bg-gradient-to-b from-transparent to-slate-50/50">
                                  {getImage(item) ? (
                                    <img
                                      src={getImage(item)}
                                      alt={item.name}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-contain filter drop-shadow-xl transition-transform duration-500 group-hover:scale-110"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getImage(item) ? 'hidden' : ''}`}>
                                    <Package size={48} className="text-slate-200" />
                                  </div>

                                  {getStockStatus(item) === 'Out of Stock' && (
                                    <div className="absolute top-2 right-2 z-10">
                                      <div className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                                        Out of Stock
                                      </div>
                                    </div>
                                  )}

                                  {/* Offer Toggle (Admin Only in Offers Mode) */}
                                  {mode === 'offers' && userRole === 'admin' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleOffer(item); }}
                                      className={`absolute top-2 right-2 z-20 p-1.5 rounded-full shadow-md transition-all ${item.isOffer ? 'bg-amber-500 text-white' : 'bg-white text-slate-300 hover:bg-slate-50'}`}
                                      title="Toggle Offer"
                                    >
                                      <Star size={16} fill={item.isOffer ? 'currentColor' : 'none'} />
                                    </button>
                                  )}

                                  {/* Offer Badge (Visible when not in Offers mode or for non-admins) */}
                                  {item.isOffer && (mode !== 'offers' || userRole !== 'admin') && (
                                    <div className={`absolute right-2 z-10 ${getStockStatus(item) === 'Out of Stock' ? 'top-10' : 'top-2'}`}>
                                      <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                                        <Star size={10} fill="currentColor" /> Offer
                                      </span>
                                    </div>
                                  )}

                                  {userRole === 'admin' && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); triggerCardImageUpload(item); }}
                                      className="absolute bottom-3 right-3 p-2 rounded-full bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shadow-md transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300"
                                    >
                                      {uploading && cardUploadItemRef.current?.id === item.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                    </button>
                                  )}
                                </div>

                                <div className="p-5 flex-1 flex flex-col">
                                  <div className="flex justify-between items-start gap-2 mb-1">
                                    <h3 className="font-bold text-slate-800 leading-tight line-clamp-2 min-h-[2.5em]">{item.name || 'Unknown Product'}</h3>
                                    {userRole === 'admin' && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openNameEditModal(item); }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 -mt-1 -mr-1"
                                        title="Quick Edit Name"
                                      >
                                        <FileText size={16} />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-sm font-mono text-slate-500 mb-4">{item.barcode}</p>

                                  <div className="mt-auto space-y-3">
                                    <div className="flex items-end justify-between">
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Price</p>
                                        <p className="text-3xl font-black text-slate-800">₪{Math.round(item.priceAfterDiscount ?? item.price ?? 0)}</p>
                                      </div>
                                      {item.priceAfterDiscount && item.priceAfterDiscount < item.price && (
                                        <div className="text-right">
                                          <p className="text-sm text-slate-400">₪{item.price}</p>
                                          <p className="text-sm font-bold text-emerald-500">
                                            -{Math.round(((item.price - item.priceAfterDiscount) / item.price) * 100)}%
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Stock</span>
                                        <span className={`text-xs font-bold ${getStockStatus(item) === 'In Stock' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                          {getStockStatus(item)}
                                        </span>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Box</span>
                                        <span className="text-xs font-bold text-slate-700">{item.box || '-'}</span>
                                      </div>
                                    </div>

                                    {mode === 'catalog' ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (catalogItems.some((i) => i.id === item.id)) removeFromCatalog(item.id);
                                          else addToCatalog(item);
                                        }}
                                        className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all btn-modern ${catalogItems.some((i) => i.id === item.id)
                                          ? 'bg-rose-100 text-rose-600 border border-rose-200'
                                          : 'bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-600 border border-slate-200'
                                          }`}
                                      >
                                        {catalogItems.some((i) => i.id === item.id) ? (
                                          <><Trash2 size={16} /> Remove</>
                                        ) : (
                                          <><FileText size={16} /> Catalog</>
                                        )}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenQuantityModal(item);
                                        }}
                                        className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all btn-modern"
                                      >
                                        Add to Cart
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {userRole === 'admin' && (
                                  <div className="absolute top-3 right-3 flex gap-1 transform translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                                    <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="p-2 rounded-lg bg-white/90 shadow text-slate-600 hover:text-indigo-600"><FileText size={14} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.barcode); }} className="p-2 rounded-lg bg-white/90 shadow text-slate-600 hover:text-rose-600"><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}

                {hasMore && items.length > 0 && (
                  <div ref={loadMoreRef} className="flex justify-center py-12">
                    {loadingMore && <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {
        !showOrderPanel && mode === 'order' && (
          <button
            onClick={() => setShowOrderPanel(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 py-8 px-3 rounded-l-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white text-lg font-bold shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 border-l-2 border-white/20"
            style={{ writingMode: 'vertical-rl' }}
          >
            Open Cart
          </button>
        )
      }

      {
        !showCatalogPanel && mode === 'catalog' && (
          <button
            onClick={() => setShowCatalogPanel(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 py-8 px-3 rounded-l-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-lg font-bold shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 border-l-2 border-white/20"
            style={{ writingMode: 'vertical-rl' }}
          >
            View Catalog
          </button>
        )
      }

      {
        showOrderPanel && (
          <aside className="flex-shrink-0 min-h-0 w-[min(520px,100vw)] sm:w-[500px] flex flex-col overflow-hidden bg-white/95 backdrop-blur-2xl border-l border-slate-200 shadow-2xl z-50 transition-all duration-500 text-slate-800">
            {/* Header / Tabs */}
            <div className="flex-shrink-0 z-20">
              <div className="flex items-center justify-between px-8 py-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <span>POS</span>
                    <span className="text-orange-500">.</span>
                  </h2>
                  <div className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1 opacity-60">
                    <span>Order #</span><span>NEW-001</span>
                  </div>
                </div>
                <button onClick={() => setShowOrderPanel(false)} className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all hover:rotate-90">
                  <X size={24} />
                </button>
              </div>

              {/* Tabs - Modern Pills */}
              <div className="flex px-8 space-x-4 mb-4">
                <button
                  onClick={() => setActiveTab('items')}
                  className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all relative flex items-center justify-center gap-2 ${activeTab === 'items' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
                >
                  <span>Items</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] ${activeTab === 'items' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {orderLines.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('customer')}
                  className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all relative flex items-center justify-center gap-2 ${activeTab === 'customer' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
                >
                  <span>Customer</span>
                  {orderInfo.companyName && <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full" />}
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-slate-50/50">

              {/* TAB: ITEMS */}
              {activeTab === 'items' && (
                <div className="p-4 space-y-3">
                  {orderLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-32 text-center px-10 opacity-60">
                      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-dashed border-slate-200">
                        <Package className="text-slate-400" size={40} strokeWidth={1.5} />
                      </div>
                      <span className="text-lg font-bold text-slate-400 mb-2">Cart is Empty</span>
                      <span className="text-sm text-slate-500 max-w-[200px] leading-relaxed block">Start scanning or select items from the catalog.</span>
                      {userRole !== 'customer' && (
                        <button onClick={() => setMode('catalog')} className="mt-8 px-8 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">
                          Open Catalog
                        </button>
                      )}
                    </div>
                  ) : (
                    orderLinesByBox.map((o, idx) => {
                      const prevBox = idx > 0 ? getLineBox(orderLinesByBox[idx - 1]) : null;
                      const box = getLineBox(o);
                      const showBox = prevBox !== box;
                      return (
                        <div key={`order-${o.id}-${idx}`} className="animate-fade-in-right notranslate" style={{ animationDelay: `${idx * 40}ms` }}>
                          {showBox && box && (
                            <div className="flex items-center gap-3 my-6 px-1">
                              <div className="h-px flex-1 bg-slate-200"></div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Box {box}</span>
                              <div className="h-px flex-1 bg-slate-200"></div>
                            </div>
                          )}
                          <div className="group relative bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-3xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:scale-[1.02]">
                            <div className="flex gap-4">
                              <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 relative">
                                {getImage(o.item) ? (
                                  <img src={getImage(o.item)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
                                ) : (
                                  <Package size={24} className="text-slate-300" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-3">
                                  <input
                                    className="text-base font-bold text-slate-800 leading-snug w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-orange-500 outline-none transition-colors placeholder-slate-400"
                                    value={o.customName || o.item?.name || ''}
                                    onChange={(e) => setOrderLineName(o.id, e.target.value)}
                                    placeholder="Product Name"
                                  />
                                  <button onClick={() => removeFromOrder(o.id)} className="text-slate-400 hover:text-rose-500 transition-colors bg-transparent p-2.5 rounded-xl hover:bg-rose-50 -mt-2 -mr-2 flex-shrink-0">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                                <p className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-2">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">{o.item?.barcode}</span>
                                  {o.item?.group && <span className="text-slate-400">• {o.item?.group}</span>}
                                </p>

                                <div className="flex flex-col sm:flex-row items-stretch gap-4 mt-6 notranslate" dir="rtl">
                                  {/* Qty Control */}
                                  <div className="flex flex-col justify-center items-center bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm shrink-0 w-14" dir="ltr">
                                    <button
                                      onClick={() => setOrderQty(o.id, parseInt(o.qty || 0) + 1)}
                                      className="w-full h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                      <Plus size={18} strokeWidth={3} />
                                    </button>
                                    <input
                                      className="w-full bg-transparent text-center text-lg font-black text-slate-700 outline-none my-1"
                                      value={o.qty || ''}
                                      onChange={(e) => setOrderQty(o.id, e.target.value)}
                                    />
                                    <button
                                      onClick={() => setOrderQty(o.id, Math.max(1, (parseInt(o.qty || 0) - 1)))}
                                      className="w-full h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                      <Minus size={18} strokeWidth={3} />
                                    </button>
                                  </div>

                                  {/* Pricing Squares Grid */}
                                  <div className="flex-1 w-full grid grid-cols-2 gap-3">

                                    {/* Card 1: Consumer Price */}
                                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/80 rounded-2xl p-3 border border-slate-200/60 flex flex-col items-center justify-center gap-1 text-center shadow-sm">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">سعر المستهلك</span>
                                      <span className="font-bold text-slate-600 text-sm sm:text-base font-mono">₪{getLineOriginalPrice(o)}</span>
                                    </div>

                                    {/* Card 2: Discount */}
                                    <div className={`rounded-2xl p-3 border flex flex-col items-center justify-center gap-1 text-center shadow-sm transition-all ${getLineDiscountPercent(o) > 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${getLineDiscountPercent(o) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>نسبة الخصم</span>
                                      <span className={`font-bold text-sm sm:text-base font-mono ${getLineDiscountPercent(o) > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>{getLineDiscountPercent(o)}%</span>
                                    </div>

                                    {/* Card 3: Price After Discount (Input) */}
                                    <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 text-center relative focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all hover:border-indigo-200">
                                      <span className="text-[10px] font-bold text-indigo-500/80 uppercase tracking-wider">بعد الخصم</span>
                                      <div className="flex items-center justify-center gap-0.5" dir="ltr">
                                        <span className="text-slate-400 font-bold text-xs mb-0.5">₪</span>
                                        <input
                                          type="number"
                                          className="w-20 bg-transparent text-center font-black text-slate-800 outline-none text-lg sm:text-lg"
                                          value={getLineUnitPrice(o) || ''}
                                          onChange={(e) => setOrderLinePrice(o.id, e.target.value)}
                                          onFocus={(e) => e.target.select()}
                                        />
                                      </div>
                                    </div>

                                    {/* Card 4: Total */}
                                    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-3 border border-orange-200/60 flex flex-col items-center justify-center gap-1 text-center shadow-sm">
                                      <span className="text-[10px] font-bold text-orange-600/70 uppercase tracking-wider">المجموع</span>
                                      <span dir="ltr" className="font-black text-orange-600 text-lg sm:text-xl tracking-tight">₪{getLineTotal(o).toFixed(2)}</span>
                                    </div>

                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB: CUSTOMER */}
              {activeTab === 'customer' && (
                <div className="p-6 animate-fade-in space-y-8">
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-100 rounded-3xl p-6 flex items-start gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200 text-orange-600">
                      <span className="text-xl">👤</span>
                    </div>
                    <div className="relative z-10">
                      <p className="text-base font-bold text-orange-900">Customer Details</p>
                      <p className="text-xs text-orange-800/60 mt-1 leading-relaxed">Details entered here will appear on the final invoice/receipt.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* 1. اسم الشركة ( المشتري ) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 mr-1">اسم الشركة ( المشتري ) <span className="text-rose-500">*</span></label>
                      <input
                        value={orderInfo.companyName}
                        onChange={(e) => setOrderInfoField('companyName', e.target.value)}
                        className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                        placeholder="أدخل اسم الشركة..."
                        dir="rtl"
                      />
                    </div>

                    {/* 2. اسم التاجر ( المشتري ) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 mr-1">اسم التاجر ( المشتري ) <span className="text-rose-500">*</span></label>
                      <input
                        value={orderInfo.merchantName}
                        onChange={(e) => setOrderInfoField('merchantName', e.target.value)}
                        className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                        placeholder="أدخل اسم التاجر..."
                        dir="rtl"
                      />
                    </div>

                    {/* 3. التلفون */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 mr-1">التلفون <span className="text-rose-500">*</span></label>
                      <input
                        value={orderInfo.phone}
                        onChange={(e) => setOrderInfoField('phone', e.target.value)}
                        className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-mono shadow-sm"
                        placeholder="05..."
                        dir="rtl"
                      />
                    </div>

                    {/* 4. العنوان */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 mr-1">العنوان <span className="text-rose-500">*</span></label>
                      <input
                        value={orderInfo.address}
                        onChange={(e) => setOrderInfoField('address', e.target.value)}
                        className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                        placeholder="المدينة، الشارع..."
                        dir="rtl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* 5. التاريخ */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 mr-1">التاريخ <span className="text-rose-500">*</span></label>
                        <input
                          type="date"
                          value={orderInfo.orderDate}
                          onChange={(e) => setOrderInfoField('orderDate', e.target.value)}
                          className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                        />
                      </div>

                      {/* 6. رقم الزبون ( في الشركة ) */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 mr-1">رقم الزبون ( في الشركة )</label>
                        <input
                          value={orderInfo.customerNumber}
                          onChange={(e) => setOrderInfoField('customerNumber', e.target.value)}
                          className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                          placeholder="#"
                        />
                      </div>
                    </div>

                    {/* 7. Payment Method */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-slate-500">طريقة الدفع</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-xl px-4 py-3 flex-1 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 has-[:checked]:text-orange-700">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="Cash"
                            checked={orderInfo.paymentMethod === 'Cash'}
                            onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)}
                            className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="font-bold text-sm">نقدي (Cash)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-xl px-4 py-3 flex-1 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 has-[:checked]:text-orange-700">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="Checks"
                            checked={orderInfo.paymentMethod === 'Checks'}
                            onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)}
                            className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="font-bold text-sm">شيكات (Checks)</span>
                        </label>
                      </div>
                    </div>

                    {/* 8. Checks Count (Conditional) */}
                    {orderInfo.paymentMethod === 'Checks' && (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="text-[11px] font-bold text-slate-500 mr-1">عدد الشيكات</label>
                        <input
                          type="number"
                          min="1"
                          value={orderInfo.checksCount}
                          onChange={(e) => setOrderInfoField('checksCount', e.target.value)}
                          className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                          placeholder="أدخل عدد الشيكات..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Order Totals */}
            <div className="flex-shrink-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 p-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
              <div className="flex justify-between items-end mb-5">
                <div>
                  <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mb-1"><span>Total Amount</span></p>
                  <p className="text-4xl font-black text-slate-800 tracking-tighter drop-shadow-sm">
                    <span className="text-2xl text-slate-400 mr-1">₪</span>
                    <span>{itemTotalWithTax(orderLines).toFixed(2)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest mb-1">Items Included</p>
                  <div className="inline-flex items-center px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                    <span className="text-lg font-bold text-slate-700">{orderLines.length}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button onClick={handleOpenPdfOrder} disabled={orderLines.length === 0} className="py-4 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-rose-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                  <FileDown size={20} /> <span>PDF</span>
                </button>
                <button onClick={handlePrintOrder} disabled={orderLines.length === 0} className="py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                  <span className="text-xl">🖨️</span> <span>Print</span>
                </button>
                <button onClick={handleSaveInvoice} className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl border border-slate-200 transition-all hover:border-slate-300">
                  <span>Save</span>
                </button>
                <button onClick={() => setActiveTab(activeTab === 'items' ? 'customer' : 'items')} className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold rounded-2xl border border-slate-200 transition-all hover:border-slate-300">
                  <span>{activeTab === 'items' ? 'Next >' : '< Back'}</span>
                </button>
              </div>

              <div className="flex justify-between mt-4 px-1 opacity-90 hover:opacity-100 transition-opacity">
                <button onClick={clearOrder} className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase tracking-widest transition-colors flex items-center gap-2">
                  <Trash2 size={12} /> <span>Clear Order</span>
                </button>
                <button onClick={handleExportExcel} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-colors"><span>Export Excel</span></button>
              </div>
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
                      {getImage(item) && <img src={getImage(item)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 rounded">{item.barcode}</span>
                        {item.group && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded">{item.group}</span>}
                      </div>
                      <div className="mt-2 flex items-baseline gap-3">
                        {item.priceAfterDiscount && item.priceAfterDiscount < item.price ? (
                          <>
                            <span className="text-base font-black text-emerald-600">₪{item.priceAfterDiscount}</span>
                            <span className="text-xs text-slate-400 line-through font-medium">₪{item.price}</span>
                          </>
                        ) : (
                          <span className="text-base font-black text-slate-700">₪{item.price}</span>
                        )}
                      </div>
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
              <div className="aspect-square max-h-64 rounded-xl bg-slate-50 flex items-center justify-center mb-4 overflow-hidden">
                {getImage(selectedItem) ? <img src={getImage(selectedItem)} alt="" className="w-full h-full object-contain p-6" onError={(e) => (e.target.style.display = 'none')} /> : <Package size={80} className="text-slate-300" />}
              </div>
              {selectedItem.group && <p className="text-xs font-semibold text-indigo-600 mb-1">Group: {selectedItem.group}</p>}
              <p className="text-slate-800 font-bold text-base mb-3 leading-snug">{selectedItem.name}</p>
              <div className="space-y-2 text-sm">
                <p className="text-slate-600">Price: <span dir="ltr" className="font-bold text-slate-800 text-base">₪{selectedItem.price ?? 0}</span></p>
                <p className="text-slate-600">Discounted: <span dir="ltr" className="font-bold text-emerald-600 text-lg">₪{Math.round(selectedItem.priceAfterDiscount ?? selectedItem.price ?? 0)}</span></p>
                <p className="text-slate-600">Box: <span className="font-bold text-slate-800 text-base">{selectedItem.box || '—'}</span></p>
                <p className="text-slate-600">Stock: <span className={getStockStatus(selectedItem) === 'In Stock' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>{getStockStatus(selectedItem)}</span></p>
                <p className="text-slate-600 font-mono text-xs break-all">Barcode: <span dir="ltr" className="font-bold text-slate-800">{selectedItem.barcode || '—'}</span></p>
              </div>
              <div className="flex gap-2 mt-5">
                {userRole === 'admin' && (
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(selectedItem); setSelectedItem(null); }} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">Edit</button>
                )}
                {mode === 'catalog' ? (
                  <button onClick={() => { catalogItems.some((i) => i.id === selectedItem.id) ? removeFromCatalog(selectedItem.id) : addToCatalog(selectedItem); setSelectedItem(null); }} className={`flex-1 py-3 rounded-xl font-bold transition-all ${catalogItems.some((i) => i.id === selectedItem.id) ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'border-2 border-rose-200 text-rose-700 hover:bg-rose-50'}`}>
                    {catalogItems.some((i) => i.id === selectedItem.id) ? 'Remove from Catalog' : 'Add to Catalog'}
                  </button>
                ) : (
                  <button onClick={() => { handleOpenQuantityModal(selectedItem); setSelectedItem(null); }} className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all">إضافة إلى السلة</button>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Quantity Modal */}
      {
        showQuantityModal && quantityItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowQuantityModal(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Quantity</h3>
              <p className="text-slate-600 text-sm mb-4">{quantityItem.name}</p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Enter Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantityValue}
                  onChange={(e) => setQuantityValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center text-2xl font-bold py-3 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmQuantity();
                    }
                  }}
                />
                {quantityItem.box && (
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Box Count: <span className="font-semibold text-slate-700">{quantityItem.box}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowQuantityModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmQuantity}
                  className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all"
                >
                  Add to Cart
                </button>
              </div>
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
                        type="text"
                        placeholder="Image path or URL (Optional)"
                        value={formData.image_url || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, image_url: e.target.value.trim() }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                        dir="ltr"
                      />
                      <label className={`block cursor-pointer ${uploading ? 'opacity-70' : ''}`}>
                        <input ref={fileInputRef} type="file" accept="image/*" disabled={uploading || !formData.barcode} onChange={(e) => handleImageUpload(e, editingItem || { barcode: formData.barcode })} className="sr-only" />
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
      {
        editingNameItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditingNameItem(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Edit Product Name</h3>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all mb-6"
                placeholder="Enter product name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNameEdit();
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingNameItem(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNameEdit}
                  className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Mobile Bottom Nav */}
      <BottomNav
        mode={mode}
        setMode={setMode}
        cartCount={orderLines.length}
        onOpenCart={() => setShowOrderPanel(true)}
        hasOffers={customOffers.length > 0}
      />
    </div >
  );
}

export default App;
