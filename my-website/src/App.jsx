import React, { useState, useEffect, useCallback, useRef, useMemo, useTransition, lazy, Suspense } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useSystemSounds } from './hooks/useSystemSounds';
import { LineChart, Line, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
// استيراد أيقونات محددة فقط من lucide-react (لا تستورد المكتبة كاملة) لتقليل حجم الـ bundle
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
  ShieldCheck,
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
  ArrowLeft,
  Star,
  Gift,
  Sparkles,
  Percent,
  ShoppingCart,
  Eye,
  EyeOff,
  Tag,
  Cloud,
  CloudOff,
  Printer,
  Smartphone,
  Mic,
  MonitorPlay, // For presentation mode
  Menu,
  User,
  ChevronRight,
  Settings,
  LayoutDashboard,
  LogOut,
  Users,
  Pencil,
  Banknote,
  Layers,
  AlertOctagon,
  AlertTriangle,
  PieChart as PieChartIcon,
  TrendingUp,
  Bell,
  RefreshCw,
  Sun,
  Moon,
  Wallet,
  Copy,
  MessageCircle,
} from 'lucide-react';
import { motion, useAnimation, AnimatePresence }
  from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import supabase from './lib/supabaseClient';
import { BARCODE_ORDER, sortByBarcodeOrder } from './barcodeOrder';
import AdminSortProducts from './components/AdminSortProducts';
import CustomerArPanel from './components/CustomerArPanel';
import SplashScreen from './components/SplashScreen';
import { saveProductsLocally, getLocalProducts, addToSyncQueue, getSyncQueue, removeFromSyncQueue } from './lib/db';
import { useBrandLogos } from './hooks/useBrandLogos';
import { getDisplayGroupForBarcode } from './utils/displayGroupKMG';
import { getStoragePublicImageUrl as getPublicImageUrl, STORAGE_UPLOAD_CACHE_CONTROL } from './lib/storageImageUrl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_STALE_DEFAULT_MS, QUERY_STALE_REPORTS_MS } from './lib/queryClient';

const BUCKET = 'Pic_of_items';
const PAGE_SIZE = 12;

/** Safe date format so changing browser language never crashes the app. */
function safeLocaleDate(options = {}) {
  try {
    return new Date().toLocaleDateString('en-GB', options);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
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

/** Display group for UI (logo/label). For specific barcodes shows "KMG" only. */
const getDisplayGroup = (item) => (item ? getDisplayGroupForBarcode(item.barcode, item.group) : '');

/** Convert Arabic/Persian digits to English digits */
function toEnglishDigits(str) {
  if (typeof str !== 'string') return str;
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

/** توحيد الباركود للبحث: إزالة المسافات، تحويل الأرقام العربية/الفارسية إلى إنجليزية */
function normalizeBarcodeForLookup(input) {
  if (input == null || input === '') return '';
  let s = String(input).trim().replace(/\s/g, '');
  s = toEnglishDigits(s);
  return typeof s === 'string' ? s : String(s);
}

/**
 * هل قيمتا باركود تطالبان نفس الصنف؟
 * يحل اختلاف أرقام عربية/إنجليزية، والأصفار البادئة في الأكواد الرقمية فقط.
 */
function barcodesMatch(a, b) {
  const na = normalizeBarcodeForLookup(a);
  const nb = normalizeBarcodeForLookup(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (/^\d+$/.test(na) && /^\d+$/.test(nb)) {
    const ca = na.replace(/^0+/, '') || '0';
    const cb = nb.replace(/^0+/, '') || '0';
    return ca === cb;
  }
  return false;
}

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

/** بيع بالذمم/تقسيط — يُسجَّل في customer_ar_ledger ويزيد outstanding_debt */
const AR_DEBIT_PAYMENT_METHODS = new Set(['Credit', 'Installment']);

const ITEMS_SELECT = 'barcode, eng_name, brand_group, box_count, full_price, price_after_disc, stock_count, image_url, is_offer, visible, product_type';
const ITEMS_BASE_SELECT = 'barcode, eng_name, brand_group, box_count, full_price, price_after_disc, stock_count, image_url, product_type';

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
    productType: (row.product_type ?? '').toString().trim(),
    group: (row.brand_group ?? '').toString().trim(),
    box: row.box_count != null && row.box_count !== '' ? String(row.box_count) : '',
    price: price,
    priceAfterDiscount: finalPrice,
    stock: row.stock_count,
    image: (row.image_url ?? '').toString().trim() || null,
    isOffer: !!row.is_offer,
    visible: row.visible !== false && row.visible !== 0,
  };
}

import { QRCodeSVG } from 'qrcode.react';
const Login = lazy(() => import('./components/Login'));
const SkeletonGrid = lazy(() => import('./components/SkeletonLoader'));
const CustomerDisplay = lazy(() => import('./components/CustomerDisplay'));
const CustomerProductView = lazy(() => import('./components/CustomerProductView'));
const ProductLookup = lazy(() => import('./components/ProductLookup'));
import BottomNav from './components/BottomNav';
import OfferCard from './components/OfferCard';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import SmartScreensaver from './components/SmartScreensaver';
import ElectroMartDashboard from './components/ElectroMartDashboard';

/** طلبات وُسِمت «مكتمل» محلياً — تبقى خارج «قيد الانتظار» حتى لو فشل UPDATE في Supabase (RLS). */
const ORDERS_APPROVED_LOCAL_KEY = 'maslamani_orders_approved_local_v1';

function getOrdersApprovedLocalMap() {
  try {
    const raw = localStorage.getItem(ORDERS_APPROVED_LOCAL_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return typeof obj === 'object' && obj !== null ? obj : {};
  } catch {
    return {};
  }
}

function saveApprovedOrderLocal(order) {
  const map = getOrdersApprovedLocalMap();
  map[String(order.id)] = { ...order, status: 'completed', _localApprovedAt: Date.now() };
  localStorage.setItem(ORDERS_APPROVED_LOCAL_KEY, JSON.stringify(map));
}

function pruneLocalApprovedFromDb(dbCompleted) {
  const map = getOrdersApprovedLocalMap();
  let changed = false;
  const ids = new Set((dbCompleted || []).map((o) => String(o.id)));
  for (const id of Object.keys(map)) {
    if (ids.has(id)) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) localStorage.setItem(ORDERS_APPROVED_LOCAL_KEY, JSON.stringify(map));
}

/** طلب مكتمل في DB — يُستثنى من «قيد المراجعة» (neq.completed وحده يفشل مع Completed بأحرف كبيرة). */
function isOrderDbStatusCompleted(status) {
  if (status == null || status === '') return false;
  return String(status).trim().toLowerCase() === 'completed';
}

/** مخزون > 0 — يُعرض في شبكة البيع لغير الأدمن؛ الأدمن يرى كل الأصناف بما فيها غير المتوفرة */
function itemIsInStockForSale(item) {
  const q = Number(item?.stock_count ?? item?.stock);
  return Number.isFinite(q) && q > 0;
}

// Mesh Gradient Component for "WOW" background
const MeshBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-[#f8fafc]">
    {/* Floating Orbs with Blur */}
    <motion.div 
      animate={{ 
        x: [0, 100, 0], 
        y: [0, 50, 0],
        scale: [1, 1.2, 1] 
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-indigo-400/30" 
    />
    <motion.div 
      animate={{ 
        x: [0, -80, 0], 
        y: [0, 120, 0],
        scale: [1.2, 1, 1.2] 
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-purple-400/30" 
    />
    <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full blur-[100px] bg-blue-300/20" />
    
    {/* Subtle Grid overlay */}
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-100 mix-blend-overlay opacity-10" />
  </div>
);

function AddToOfferRow({ item, getImage, onAdd }) {
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(() => Math.round(item.priceAfterDiscount ?? item.price ?? 0));
  const [isFree, setIsFree] = useState(false);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-amber-300 transition-colors">
      {getImage(item) ? (
        <img src={getImage(item)} alt="" loading="lazy" className="w-12 h-12 object-contain rounded-lg" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center"><Package size={20} className="text-slate-400" /></div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 break-words leading-tight">{item.name || item.barcode}</p>
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

function SwipeToDeleteItem({ children, onDelete }) {
  const controls = useAnimation();
  const [isDeleting, setIsDeleting] = useState(false);

  const bind = useDrag(({ movement: [mx], down, direction: [xDir], velocity: [vx] }) => {
    if (isDeleting) return;

    const threshold = 100; // Swipe threshold to trigger delete
    const isSwipeRight = mx > 0; // We pull to the right (RTL context) or left? The user is RTL native, pulling might mean pulling to left or right. Let's allow either direction or just RTL swipe (mx > 0 or mx < 0). Actually, let's just make it work for both directions.
    const isOverThreshold = Math.abs(mx) > threshold;

    if (!down && isOverThreshold) {
      // Trigger delete
      setIsDeleting(true);
      controls.start({ x: mx > 0 ? 500 : -500, opacity: 0, transition: { duration: 0.2 } }).then(() => {
        onDelete();
      });
    } else if (!down) {
      // Snap back
      controls.start({ x: 0, opacity: 1, transition: { type: 'spring', bounce: 0.5 } });
    } else {
      // Update position while dragging
      controls.set({ x: mx });
    }
  }, { axis: 'x', filterTaps: true });

  return (
    <div className="relative w-full overflow-hidden rounded-3xl mb-3">
      {/* Background delete indicator */}
      <div className="absolute inset-0 bg-rose-500 rounded-3xl flex items-center justify-between px-6 pointer-events-none">
        <div className="flex items-center gap-2 text-white font-bold opacity-100">
          <Trash2 size={24} />
          <span>حذف</span>
        </div>
        <div className="flex items-center gap-2 text-white font-bold opacity-100">
          <span>حذف</span>
          <Trash2 size={24} />
        </div>
      </div>

      {/* Foreground swipable item */}
      <motion.div
        {...bind()}
        animate={controls}
        className="w-full relative z-10 touch-pan-y"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>
    </div>
  );
}


function App() {
  const { getLogoUrl, uploadLogo, removeLogo, logos, loading: logosLoading, fetchLogos } = useBrandLogos();
  const queryClient = useQueryClient();

  const isCustomerDisplayMode = typeof window !== 'undefined' && window.location.search.includes('mode=display');
  const isCustomerProductMode = typeof window !== 'undefined' && window.location.search.includes('barcode=');
  const isProductLookupMode = typeof window !== 'undefined' && window.location.search.includes('mode=lookup');

  /* Dropdown Menu State */
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Close profile menu if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /* Splash Screen State */
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  /* Login State */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'customer'
  const [username, setUsername] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('sales_sidebar_open') === 'true';
    } catch {
      return false;
    }
  });

  const setSidebarOpen = useCallback((open) => {
    setIsSidebarOpen(open);
    try {
      localStorage.setItem('sales_sidebar_open', open ? 'true' : 'false');
    } catch (_) { }
  }, []);

  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [showLoginScreen, setShowLoginScreen] = useState(() => typeof window !== 'undefined' && window.location.search.includes('login=1'));
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // إدارة المستخدمين وكلمات المرور (من الإعدادات → إدارة الجلسات)
  const [salesUsers, setSalesUsers] = useState([]);
  const [salesUsersLoading, setSalesUsersLoading] = useState(false);
  const [editingPasswordUser, setEditingPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);

  // إدارة شعارات الماركات: إخفاء التفاصيل حتى يدخل المستخدم إلى القسم
  const [showBrandLogosDetails, setShowBrandLogosDetails] = useState(false);
  // إدارة الجلسات والحسابات: إخفاء التفاصيل حتى يدخل المستخدم إلى القسم
  const [showSessionManagementDetails, setShowSessionManagementDetails] = useState(false);

  // Return Customer Display Early
  if (isCustomerDisplayMode) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]">
          <div className="animate-pulse text-indigo-500 flex flex-col items-center">
            <Package size={48} className="mb-4" />
            <span className="font-bold">Loading Display...</span>
          </div>
        </div>
      }>
        <CustomerDisplay />
      </Suspense>
    );
  }

  // Return Customer Product View Early (Interactive Catalog)
  if (isCustomerProductMode) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]">
          <div className="animate-pulse text-indigo-500 flex flex-col items-center">
            <Package size={48} className="mb-4" />
            <span className="font-bold">Loading Product...</span>
          </div>
        </div>
      }>
        <CustomerProductView />
      </Suspense>
    );
  }

  // Return Product Lookup Early (new tab utility)
  if (isProductLookupMode) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]">
          <div className="animate-pulse text-indigo-500 flex flex-col items-center">
            <Package size={48} className="mb-4" />
            <span className="font-bold">Loading Lookup...</span>
          </div>
        </div>
      }>
        <ProductLookup />
      </Suspense>
    );
  }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const auth = localStorage.getItem('sales_auth');
    const role = localStorage.getItem('sales_role');
    const storedUser = localStorage.getItem('sales_username');
    if (auth === 'true') {
      try {
        const lt = parseInt(localStorage.getItem('sales_login_time'), 10);
        if (!Number.isFinite(lt) || lt <= 0) {
          localStorage.setItem('sales_login_time', String(Date.now()));
        }
      } catch (_) { }
      setIsAuthenticated(true);
      setUserRole(role || 'customer');
      setUsername(storedUser || null);
      if (role === 'customer' && !activeReportTab) setMode('order');
    } else {
      setIsAuthenticated(true);
      setUserRole('customer');
      setUsername('public_sale');
      setMode('order');
    }
    setHasCheckedAuth(true);
  }, []);

  const handleLogin = async (username, password, setError, rememberMe = true) => {
    const loginSuccess = (role, loggedInUser = username) => {
      localStorage.setItem('sales_auth', 'true');
      localStorage.setItem('sales_role', role);
      localStorage.setItem('sales_username', loggedInUser);
      localStorage.setItem('sales_login_time', Date.now().toString());
      if (rememberMe) {
        localStorage.setItem('sales_remember_me', 'true');
      } else {
        localStorage.removeItem('sales_remember_me');
      }
      setIsAuthenticated(true);
      setUserRole(role);
      setUsername(loggedInUser);
      setShowLoginScreen(false);
      if (role === 'customer') setMode('order');
    };

    try {
      const { data, error } = await supabase.from('sales_users').select('username, password, role').eq('username', username.trim()).maybeSingle();
      if (!error && data && String(data.password) === String(password)) {
        loginSuccess(data.role || 'customer', data.username);
        return;
      }
    } catch (_) { /* جدول غير موجود أو خطأ — نكمل للقائمة الثابتة */ }

    if (username === 'mohammadalaker' && password === '123456') {
      loginSuccess('admin', 'mohammadalaker');
    } else if (username === 'admin' && password === '123456') {
      loginSuccess('admin');
    } else if (username === 'sale' && password === '123') {
      loginSuccess('customer');
    } else if (username === 'supervisor' && password === '123') {
      loginSuccess('supervisor');
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleBiometricLogin = async (setError, rememberMe = true) => {
    try {
      const storedUsername = localStorage.getItem('sales_bio_username');
      const storedRole = localStorage.getItem('sales_bio_role') || 'customer';

      if (!storedUsername) {
        setError?.('البصمة غير مفعلة على هذا الجهاز. استخدم رقم السري.');
        return;
      }

      localStorage.setItem('sales_auth', 'true');
      localStorage.setItem('sales_role', storedRole);
      localStorage.setItem('sales_username', storedUsername);
      localStorage.setItem('sales_login_time', Date.now().toString());

      if (rememberMe) {
        localStorage.setItem('sales_remember_me', 'true');
      } else {
        localStorage.removeItem('sales_remember_me');
      }

      setIsAuthenticated(true);
      setUserRole(storedRole);
      setUsername(storedUsername);
      setShowLoginScreen(false);
      if (storedRole === 'customer') setMode('order');
    } catch (e) {
      console.warn('handleBiometricLogin failed:', e);
      setError?.(e?.message || 'فشل الدخول بالبصمة');
    }
  };

  const handleLogout = (silent = false) => {
    if (silent || window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('sales_auth');
      localStorage.removeItem('sales_role');
      localStorage.removeItem('sales_username');
      localStorage.removeItem('sales_login_time');
      localStorage.removeItem('sales_remember_me');
      setIsAuthenticated(true);
      setUserRole('customer');
      setUsername('public_sale');
      setMode('order');
      setShowLoginScreen(false);
      /* لا نُعيد شاشة الترحيب بعد الخروج — يبقى التطبيق يعمل مباشرة كوضع زائر */
      setShowSplash(false);
    }
  };

  const handleForceLogoutAll = async () => {
    if (!window.confirm('⚠️ هل أنت متأكد؟ سيتم تسجيل خروج جميع المستخدمين فوراً.')) return;
    try {
      // Set cutoff time to NOW.
      const now = Date.now().toString();

      // Upsert to custom_offers with special ID
      // We use 'title' to store the timestamp
      const { error } = await supabase.from('custom_offers').upsert({
        id: 'SYSTEM_FORCE_LOGOUT',
        title: now,
        // items must be valid json/array per schema presumably, or null
        items: []
      });

      if (error) throw error;

      alert('تم إرسال أمر تسجيل الخروج للجميع.');

      // Update local session so Admin stays logged in (if we want that)
      localStorage.setItem('sales_login_time', now);
    } catch (e) {
      console.error(e);
      alert('خطأ: ' + e.message);
    }
  };

  const fetchSalesUsers = useCallback(async () => {
    setSalesUsersLoading(true);
    try {
      const { data, error } = await supabase.from('sales_users').select('id, username, role').order('username');
      if (error) throw error;
      setSalesUsers(data || []);
    } catch (e) {
      console.warn('fetchSalesUsers:', e);
      setSalesUsers([]);
    } finally {
      setSalesUsersLoading(false);
    }
  }, []);

  const handleUpdateUserPassword = useCallback(async (userId, password) => {
    if (!password || password.length < 3) {
      alert('كلمة المرور يجب أن تكون 3 أحرف على الأقل.');
      return;
    }
    setPasswordUpdateLoading(true);
    try {
      const { error } = await supabase.from('sales_users').update({ password }).eq('id', userId);
      if (error) throw error;
      setEditingPasswordUser(null);
      setNewPassword('');
      alert('تم تحديث كلمة المرور.');
    } catch (e) {
      console.warn('handleUpdateUserPassword:', e);
      alert('فشل التحديث: ' + (e?.message || e));
    } finally {
      setPasswordUpdateLoading(false);
    }
  }, []);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showCartOverlay, setShowCartOverlay] = useState(false);
  const [cartPing, setCartPing] = useState(false); // Ping على عدد السلة عند إضافة منتج
  const [showCatalogPanel, setShowCatalogPanel] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState(null);
  /** نافذة «معلومات الطلبية» قبل اتمام الطلبية */
  const [showOrderSubmitModal, setShowOrderSubmitModal] = useState(false);
  const [flyingItems, setFlyingItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogShowFinalPriceOnly, setCatalogShowFinalPriceOnly] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isSwitchingCategory, setIsSwitchingCategory] = useState(false);
  const [orderItems, setOrderItems] = useState(() => {
    try {
      const stored = localStorage.getItem('sales_order_items');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sales_order_items', JSON.stringify(orderItems));
    } catch (e) { console.warn('Could not save order items:', e); }
  }, [orderItems]);

  const [currentOrderId, setCurrentOrderId] = useState(() => {
    try {
      return localStorage.getItem('sales_current_order_id') || null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (currentOrderId) {
        localStorage.setItem('sales_current_order_id', currentOrderId);
      } else {
        localStorage.removeItem('sales_current_order_id');
      }
    } catch (e) { console.warn('Could not save current order id:', e); }
  }, [currentOrderId]);

  const [orderInfo, setOrderInfo] = useState(() => {
    try {
      const stored = localStorage.getItem('sales_order_info');
      if (stored) return JSON.parse(stored);
    } catch { }
    return {
      companyName: '',
      merchantName: '',
      phone: '',
      address: '',
      orderDate: new Date().toISOString().slice(0, 10),
      customerNumber: '',
      paymentMethod: '',
      checksCount: '',
      discountType: '', // '' | 'percentage' | 'amount'
      discountValue: '',
      email: '',
      notes: '',
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('sales_order_info', JSON.stringify(orderInfo));
    } catch (e) { console.warn('Could not save order info:', e); }
  }, [orderInfo]);
  const [submittedOrders, setSubmittedOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [completedOrdersLoading, setCompletedOrdersLoading] = useState(false);
  const [submittedOrdersTab, setSubmittedOrdersTab] = useState('pending'); // 'pending' | 'completed'
  /** طلبات حديثة لكل الحالات — للوحة التحكم (الإيرادات والعمليات الأخيرة)، وليس لقائمة «انتظار الموافقة» */
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderActionLoading, setOrderActionLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState('order'); // 'order' | 'catalog' | 'submitted' | 'offers' | 'dashboard_preview'
  const [sortMode, setSortMode] = useState('barcode'); // 'barcode' | 'name'
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [sortingCategory, setSortingCategory] = useState(null); // 'electrical' | 'household'
  const [dynamicBarcodeOrder, setDynamicBarcodeOrder] = useState(BARCODE_ORDER);

  const cartIconRef = useRef(null); // للأنيميشن fly-to-cart (زر السلة في الديسكتوب)
  const cartNavRef = useRef(null);  // زر السلة في الشريط السفلي (موبايل)
  const cartCountPrevRef = useRef(null); // لتفعيل Ping عند زيادة عدد القطع
  const posCatalogSearchInputRef = useRef(null); // حقل البحث + مسح الباركود (HID + Enter)

  // Held Orders State
  const [heldOrders, setHeldOrders] = useState(() => {
    try {
      const stored = localStorage.getItem('sales_held_orders');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('sales_held_orders', JSON.stringify(heldOrders));
    } catch (e) { console.warn('Could not save held orders:', e); }
  }, [heldOrders]);

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

  // Customers
  const [customers, setCustomers] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const s = localStorage.getItem('sales_customers_cache');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPredictions, setShowCustomerPredictions] = useState(false);
  const [customerInsights, setCustomerInsights] = useState(null);
  const [insightsPhone, setInsightsPhone] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickAddCustomerData, setQuickAddCustomerData] = useState({ companyName: '', name: '', phone: '', address: '', customerNumber: '' });

  // مشتقات محسوبة لتقليل العمليات الثقيلة أثناء إدخال بيانات العميل
  const currentCustomerByPhone = useMemo(
    () => customers.find((c) => c.phone === orderInfo.phone),
    [customers, orderInfo.phone]
  );

  const filteredCustomersByPhone = useMemo(() => {
    const search = (customerSearch || '').trim();
    if (!search || search.length < 2) return [];
    return customers.filter((c) => c.phone && c.phone.includes(search));
  }, [customers, customerSearch]);

  // Customers page (Sidebar) state
  const [customersPageSearch, setCustomersPageSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryLowStockOnly, setInventoryLowStockOnly] = useState(false);
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('');
  const inventoryBarcodeScanRef = useRef(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);

  // Reports page state — null = شاشة اختيار "أي تقرير تريد أن تراه؟"
  const [activeReportTab, setActiveReportTab] = useState(null);
  const [reportSalesDays, setReportSalesDays] = useState(7); // 7 | 14 | 30 للفلتر الزمني

  const filteredCustomersPage = useMemo(() => {
    const raw = (customersPageSearch || '').trim().toLowerCase();
    if (!raw) return customers;
    const qNorm = toEnglishDigits(raw.replace(/\s/g, ''));
    return customers.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const company = (c.company_name || '').toLowerCase();
      const phone = (c.phone || '').replace(/\s/g, '');
      return name.includes(raw) || company.includes(raw) || phone.includes(qNorm);
    });
  }, [customers, customersPageSearch]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  /** صفحة العملاء: دليل العملاء | ذمم العملاء */
  const [customersSectionTab, setCustomersSectionTab] = useState('directory');
  const [arSearch, setArSearch] = useState('');
  const [arFilter, setArFilter] = useState('all');
  const [arLedgerCustomer, setArLedgerCustomer] = useState(null);
  const [arLedgerEntries, setArLedgerEntries] = useState([]);
  const [arLedgerLoading, setArLedgerLoading] = useState(false);
  const [arPaymentAmount, setArPaymentAmount] = useState('');
  const [arPaymentNotes, setArPaymentNotes] = useState('');
  const [arOpeningAmount, setArOpeningAmount] = useState('');
  const [arOpeningNotes, setArOpeningNotes] = useState('');
  const [arPaymentSubmitting, setArPaymentSubmitting] = useState(false);

  // Sales stats (last 7 days) for Reports
  const [salesLast7, setSalesLast7] = useState([]);
  const [salesStatsLoading, setSalesStatsLoading] = useState(false);
  const salesTrend = useMemo(() => {
    if (!salesLast7 || salesLast7.length < 2) return 0;
    const start = salesLast7[0].value || 0;
    const end = salesLast7[salesLast7.length - 1].value || 0;
    return end - start;
  }, [salesLast7]);

  const [inventoryInsights, setInventoryInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const fetchInventoryInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const now = new Date();
      const from90 = new Date(now);
      from90.setDate(from90.getDate() - 90);
      const from30 = new Date(now);
      from30.setDate(from30.getDate() - 30);
      const from90Iso = from90.toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select('created_at, items')
        .gte('created_at', from90Iso);

      if (error) throw error;

      const salesData = {};
      (data || []).forEach(order => {
        const orderDate = new Date(order.created_at);
        const isLast30 = orderDate >= from30;
        (order.items || []).forEach(item => {
          if (!item.barcode) return;
          if (!salesData[item.barcode]) {
            salesData[item.barcode] = { unitsSold: 0, unitsSoldLast30: 0, lastSoldDate: orderDate };
          }
          const q = item.qty || 1;
          salesData[item.barcode].unitsSold += q;
          if (isLast30) salesData[item.barcode].unitsSoldLast30 += q;
          if (orderDate > salesData[item.barcode].lastSoldDate) {
            salesData[item.barcode].lastSoldDate = orderDate;
          }
        });
      });

      // معدل سرعة البيع: قطعة/يوم (بناءً على آخر 30 يوماً)
      const VELOCITY_DAYS = 30;
      Object.keys(salesData).forEach(barcode => {
        const rec = salesData[barcode];
        rec.salesVelocity = rec.unitsSoldLast30 > 0
          ? rec.unitsSoldLast30 / VELOCITY_DAYS
          : 0;
      });

      setInventoryInsights(salesData);
    } catch (err) {
      console.warn('Error fetching inventory insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const fetchCustomerInsights = useCallback(async (phone) => {
    if (!phone) {
      setCustomerInsights(null);
      setInsightsPhone(null);
      return;
    }
    if (phone === insightsPhone) return; // already fetched

    setLoadingInsights(true);
    setInsightsPhone(phone);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at, items')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const lastOrder = data[0];
        const allItems = data.flatMap(order => order.items || []);

        const brandCounts = {};
        allItems.forEach(item => {
          if (item.group) brandCounts[item.group] = (brandCounts[item.group] || 0) + (item.qty || 1);
        });
        const favoriteBrands = Object.entries(brandCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([brand]) => brand);

        const lastItemNames = (lastOrder.items || [])
          .slice(0, 2)
          .map(i => i.name || i.product_type)
          .filter(Boolean);

        setCustomerInsights({
          lastPurchaseDate: new Date(lastOrder.created_at).toLocaleDateString('ar-SA'),
          lastItems: lastItemNames,
          favoriteBrands: favoriteBrands
        });
      } else {
        setCustomerInsights(null);
      }
    } catch (err) {
      console.warn('Error fetching customer insights:', err);
      setCustomerInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  }, [insightsPhone]);

  const handleQuickAddCustomer = async () => {
    if (!quickAddCustomerData.name || !quickAddCustomerData.phone) {
      alert('يرجى إدخال اسم التاجر ورقم الهاتف على الأقل.');
      return;
    }
    try {
      const { data, error } = await supabase.from('customers').insert([{
        name: quickAddCustomerData.name,
        company_name: quickAddCustomerData.companyName || quickAddCustomerData.name,
        phone: quickAddCustomerData.phone,
        address: quickAddCustomerData.address || '',
        customer_number: quickAddCustomerData.customerNumber || '',
        loyalty_points: 0,
        total_spent: 0
      }]).select();

      if (error) throw error;

      setOrderInfo(prev => ({
        ...prev,
        phone: quickAddCustomerData.phone,
        merchantName: quickAddCustomerData.name,
        companyName: quickAddCustomerData.companyName || quickAddCustomerData.name,
        address: quickAddCustomerData.address || '',
        customerNumber: quickAddCustomerData.customerNumber || ''
      }));
      setCustomerSearch(quickAddCustomerData.phone);
      setShowQuickAddCustomer(false);
      fetchCustomers();
      fetchCustomerInsights(quickAddCustomerData.phone);
    } catch (err) {
      console.warn('Error quick adding customer:', err);
      alert('حدث خطأ أثناء إضافة الزبون.');
    }
  };

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, name, phone, address, customer_number, loyalty_points, total_spent, outstanding_debt, credit_limit')
        .order('id', { ascending: false });

      if (error) throw error;

      if (data) {
        setCustomers(data);
        try {
          localStorage.setItem('sales_customers_cache', JSON.stringify(data));
        } catch (_) { /* ignore */ }
      }
    } catch (e) {
      console.warn('fetchCustomers error:', e);
      try {
        const cached = localStorage.getItem('sales_customers_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setCustomers(parsed);
        }
      } catch (_) { /* ignore */ }
      if (customers.length === 0) {
        alert('تعذر تحميل بيانات العملاء. تأكد من الاتصال بالإنترنت وصلاحيات الجدول.');
      }
    } finally {
      setCustomersLoading(false);
    }
  }, [customers.length]);

  const applyCreditAfterOrder = useCallback(async (orderData, orderId) => {
    try {
      const det = orderData?.details;
      const details = typeof det === 'object' && det !== null ? det : {};
      const pm = details.paymentMethod || '';
      if (!AR_DEBIT_PAYMENT_METHODS.has(pm)) return;
      const phone = String(orderData.customer_phone || '').trim();
      if (!phone) return;
      const total = Number(orderData.total_amount || 0);
      if (!(total > 0)) return;
      const { data: cust, error: e1 } = await supabase.from('customers').select('id, outstanding_debt').eq('phone', phone).maybeSingle();
      if (e1 || !cust?.id) return;
      const username = localStorage.getItem('sales_username') || 'system';
      const { error: e2 } = await supabase.from('customer_ar_ledger').insert([{
        customer_id: cust.id,
        entry_type: 'debit',
        amount_ils: total,
        description: pm === 'Installment' ? 'بيع بالتقسيط — طلب' : 'بيع بالذمم / آجل — طلب',
        order_id: orderId ?? null,
        created_by: username,
      }]);
      if (e2) {
        console.warn('customer_ar_ledger insert:', e2);
        return;
      }
      await supabase.from('customers').update({
        outstanding_debt: Number(cust.outstanding_debt || 0) + total,
      }).eq('id', cust.id);
    } catch (e) {
      console.warn('applyCreditAfterOrder', e);
    }
  }, []);

  const fetchArLedger = useCallback(async (customerId) => {
    if (!customerId) return;
    setArLedgerLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_ar_ledger')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setArLedgerEntries(data || []);
    } catch (e) {
      console.warn('fetchArLedger', e);
      setArLedgerEntries([]);
      alert('تعذر تحميل سجل الذمم. أنشئ جدول customer_ar_ledger من ملف supabase/customer_ar_ledger.sql في Supabase.');
    } finally {
      setArLedgerLoading(false);
    }
  }, []);

  const submitArPayment = useCallback(async () => {
    if (!arLedgerCustomer?.id) return;
    const amt = Number(toEnglishDigits(String(arPaymentAmount || '')));
    if (!(amt > 0)) {
      alert('أدخل مبلغ الدفعة (أكبر من صفر).');
      return;
    }
    setArPaymentSubmitting(true);
    try {
      const username = localStorage.getItem('sales_username') || 'user';
      const { error: e1 } = await supabase.from('customer_ar_ledger').insert([{
        customer_id: arLedgerCustomer.id,
        entry_type: 'credit',
        amount_ils: amt,
        description: (arPaymentNotes || '').trim() || 'دفعة نقدية',
        created_by: username,
      }]);
      if (e1) throw e1;
      const { data: c } = await supabase.from('customers').select('outstanding_debt').eq('id', arLedgerCustomer.id).single();
      const prev = Number(c?.outstanding_debt || 0);
      const nextDebt = Math.max(0, prev - amt);
      await supabase.from('customers').update({ outstanding_debt: nextDebt }).eq('id', arLedgerCustomer.id);
      setArPaymentAmount('');
      setArPaymentNotes('');
      setArLedgerCustomer((prev) => (prev ? { ...prev, outstanding_debt: nextDebt } : null));
      await fetchCustomers();
      await fetchArLedger(arLedgerCustomer.id);
    } catch (e) {
      console.warn('submitArPayment', e);
      alert(e?.message || 'فشل تسجيل الدفعة.');
    } finally {
      setArPaymentSubmitting(false);
    }
  }, [arLedgerCustomer, arPaymentAmount, arPaymentNotes, fetchCustomers, fetchArLedger]);

  /** دين سابق / رصيد قبل استخدام النظام — يُسجَّل كـ debit في السجل */
  const submitArOpeningDebit = useCallback(async () => {
    if (!arLedgerCustomer?.id) return;
    const amt = Number(toEnglishDigits(String(arOpeningAmount || '')));
    if (!(amt > 0)) {
      alert('أدخل مبلغ الدين السابق (أكبر من صفر).');
      return;
    }
    setArPaymentSubmitting(true);
    try {
      const username = localStorage.getItem('sales_username') || 'user';
      const desc = (arOpeningNotes || '').trim() || 'دين سابق / رصيد مرحّل';
      const { error: e1 } = await supabase.from('customer_ar_ledger').insert([{
        customer_id: arLedgerCustomer.id,
        entry_type: 'debit',
        amount_ils: amt,
        description: desc,
        created_by: username,
      }]);
      if (e1) throw e1;
      const { data: c } = await supabase.from('customers').select('outstanding_debt').eq('id', arLedgerCustomer.id).single();
      const prev = Number(c?.outstanding_debt || 0);
      const nextDebt = prev + amt;
      await supabase.from('customers').update({ outstanding_debt: nextDebt }).eq('id', arLedgerCustomer.id);
      setArOpeningAmount('');
      setArOpeningNotes('');
      setArLedgerCustomer((prev) => (prev ? { ...prev, outstanding_debt: nextDebt } : null));
      await fetchCustomers();
      await fetchArLedger(arLedgerCustomer.id);
    } catch (e) {
      console.warn('submitArOpeningDebit', e);
      alert(e?.message || 'فشل تسجيل الدين السابق.');
    } finally {
      setArPaymentSubmitting(false);
    }
  }, [arLedgerCustomer, arOpeningAmount, arOpeningNotes, fetchCustomers, fetchArLedger]);

  const fetchActivityLogs = useCallback(async () => {
    setActivityLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, created_at, username, action, entity_type, entity_id, field_name, old_value, new_value, description')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setActivityLogs(data || []);
    } catch (e) {
      console.warn('fetchActivityLogs:', e);
      setActivityLogs([]);
    } finally {
      setActivityLogsLoading(false);
    }
  }, []);

  const logActivityToSupabase = useCallback(async (payload) => {
    try {
      await supabase.from('activity_logs').insert({
        username: payload.username || localStorage.getItem('sales_username') || 'unknown',
        action: payload.action || 'update',
        entity_type: payload.entity_type || 'item',
        entity_id: payload.entity_id ?? '',
        field_name: payload.field_name ?? null,
        old_value: payload.old_value != null ? String(payload.old_value) : null,
        new_value: payload.new_value != null ? String(payload.new_value) : null,
        description: payload.description ?? null,
      });
    } catch (e) {
      console.warn('logActivityToSupabase:', e);
    }
  }, []);

  const fetchSalesLast7 = useCallback(async (days = 7) => {
    setSalesStatsLoading(true);
    try {
      const totalDays = Math.min(90, Math.max(1, Number(days) || 7));
      const from = new Date();
      from.setDate(from.getDate() - (totalDays - 1));
      const fromIso = from.toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .gte('created_at', fromIso)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const byDay = new Map();
      (data || []).forEach((row) => {
        const d = new Date(row.created_at);
        const key = d.toISOString().slice(0, 10);
        const prev = byDay.get(key) || 0;
        byDay.set(key, prev + Number(row.total_amount || 0));
      });

      const points = [];
      for (let i = totalDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('ar-SA', { weekday: 'short' });
        points.push({ date: key, label, value: byDay.get(key) || 0 });
      }

      setSalesLast7(points);
    } catch (e) {
      console.warn('fetchSalesLast7:', e);
      setSalesLast7([]);
    } finally {
      setSalesStatsLoading(false);
    }
  }, []);

  const saveCustomerFromPage = async (payload) => {
    if (!payload.phone || !payload.phone.trim()) {
      alert('رقم الهاتف مطلوب.');
      return;
    }
    setCustomersLoading(true);
    try {
      const row = {
        company_name: (payload.company_name || '').trim(),
        name: (payload.name || '').trim(),
        phone: String(payload.phone || '').trim(),
        address: (payload.address || '').trim(),
        customer_number: (payload.customer_number || '').trim(),
        loyalty_points: Math.max(0, Number(payload.loyalty_points) || 0),
        total_spent: Math.max(0, Number(payload.total_spent) || 0),
        outstanding_debt: Math.max(0, Number(payload.outstanding_debt) || 0),
        credit_limit: payload.credit_limit === '' || payload.credit_limit == null
          ? null
          : Math.max(0, Number(payload.credit_limit)),
      };
      if (payload.id) {
        const { error } = await supabase.from('customers').update(row).eq('id', payload.id);
        if (error) throw error;
        setCustomers(prev => prev.map(c => c.id === payload.id ? { ...c, ...row, id: c.id } : c));
        setEditingCustomer(null);
      } else {
        const { data, error } = await supabase.from('customers').insert([row]).select();
        if (error) throw error;
        if (data && data[0]) setCustomers(prev => [data[0], ...prev]);
        setEditingCustomer(null);
      }
      fetchCustomers();
    } catch (e) {
      console.warn('saveCustomerFromPage:', e);
      alert(e?.message || 'حدث خطأ أثناء الحفظ.');
    } finally {
      setCustomersLoading(false);
    }
  };

  const deleteCustomerFromPage = async (id) => {
    if (!id || !confirm('حذف هذا العميل؟')) return;
    setCustomersLoading(true);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      setCustomers(prev => prev.filter(c => c.id !== id));
      setEditingCustomer(null);
      fetchCustomers();
    } catch (e) {
      console.warn('deleteCustomerFromPage:', e);
      alert(e?.message || 'حدث خطأ أثناء الحذف.');
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchCustomOffers = useCallback(async () => {
    try {
      let data, error;
      let withColumn = true;
      const res = await supabase.from('custom_offers').select('id, title, items, created_at, show_on_sales_screen').neq('id', 'SYSTEM_FORCE_LOGOUT').order('created_at', { ascending: true });
      data = res.data;
      error = res.error;
      if (error && (error.message || '').includes('show_on_sales_screen')) {
        const fallback = await supabase.from('custom_offers').select('id, title, items, created_at').neq('id', 'SYSTEM_FORCE_LOGOUT').order('created_at', { ascending: true });
        data = fallback.data;
        error = fallback.error;
        withColumn = false;
      }
      if (!error && data && data.length > 0) {
        const parsed = data.map((r) => ({
          id: r.id,
          title: r.title || 'عرض',
          items: Array.isArray(r.items) ? r.items : [],
          showOnSalesScreen: withColumn ? (r.show_on_sales_screen !== false) : true,
        }));
        setCustomOffers(parsed);
        try { localStorage.setItem('sales_custom_offers', JSON.stringify(parsed)); } catch (_) { }
      } else if (!error && (!data || data.length === 0)) {
        const local = (() => { try { const s = localStorage.getItem('sales_custom_offers'); return s ? JSON.parse(s) : []; } catch { return []; } })();
        if (local.length > 0) {
          for (const o of local) {
            try {
              await supabase.from('custom_offers').upsert({ id: o.id, title: o.title || 'عرض', items: o.items || [], updated_at: new Date().toISOString(), show_on_sales_screen: o.showOnSalesScreen !== false }, { onConflict: 'id' });
            } catch (_) { }
          }
        }
      }
    } catch (e) { console.warn('fetchCustomOffers:', e); }
    setOffersLoaded(true);
  }, []);

  useEffect(() => {
    fetchCustomOffers();
    fetchCustomers();
  }, [fetchCustomOffers, fetchCustomers]);

  useEffect(() => {
    if (mode === 'customers' && (userRole === 'admin' || userRole === 'supervisor')) fetchCustomers();
    if (mode === 'inventory' && userRole === 'admin') {
      fetchActivityLogs();
      fetchInventoryInsights();
    }
    if (mode === 'settings' && userRole === 'admin') fetchSalesUsers();
  }, [mode, userRole, fetchCustomers, fetchActivityLogs, fetchInventoryInsights, fetchSalesUsers]);

  /* منع تمرير الصفحة عند فتح مودال تعديل أو عرض العميل */
  useEffect(() => {
    if (!editingCustomer && !viewingCustomer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [editingCustomer, viewingCustomer]);

  useEffect(() => {
    if (!offersLoaded) return;
    try {
      localStorage.setItem('sales_custom_offers', JSON.stringify(customOffers));
    } catch (e) { console.warn('Could not save offers:', e); }
  }, [customOffers, offersLoaded]);

  // Load sales stats and inventory insights when opening Reports (عند اختيار تقرير يتم الجلب من داخل التقرير)
  useEffect(() => {
    if (mode === 'reports' && (userRole === 'admin' || userRole === 'supervisor') && activeReportTab) {
      if (activeReportTab === 'sales') fetchSalesLast7(reportSalesDays);
      if (activeReportTab === 'inventory') fetchInventoryInsights();
    }
  }, [mode, userRole, activeReportTab, reportSalesDays, fetchSalesLast7, fetchInventoryInsights]);

  // عند الخروج من صفحة التقارير نعيد شاشة الاختيار لفتحها في المرة القادمة
  useEffect(() => {
    if (mode !== 'reports') setActiveReportTab(null);
  }, [mode]);

  const fetchSubmittedOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    // استثناء المكتمل: لا تستخدم status.neq.completed وحده — في PostgreSQL Completed ≠ completed فتبقى الطلبية في النتيجة.
    // not.in يغطي أشهر الصيغ؛ ثم فلتر JS بـ isOrderDbStatusCompleted كضمان نهائي.
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or('status.is.null,status.not.in.(completed,Completed,COMPLETED)')
      .order('created_at', { ascending: false });
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
          const local = getOrdersApprovedLocalMap();
          const list = (retryData ?? []).filter((o) => {
            if (isOrderDbStatusCompleted(o.status)) return false;
            if (local[String(o.id)]) return false;
            return true;
          });
          setSubmittedOrders(list);
          setOrdersLoading(false);
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
    const localApproved = getOrdersApprovedLocalMap();
    const pendingList = (data ?? []).filter(
      (o) => !isOrderDbStatusCompleted(o.status) && !localApproved[String(o.id)],
    );
    setSubmittedOrders(pendingList);
  }, []);

  const fetchCompletedOrders = useCallback(async () => {
    setCompletedOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('status', 'completed')
      .order('created_at', { ascending: false });
    setCompletedOrdersLoading(false);
    if (error) return;
    const dbCompleted = data ?? [];
    pruneLocalApprovedFromDb(dbCompleted);
    const local = getOrdersApprovedLocalMap();
    const merged = [...dbCompleted];
    for (const id of Object.keys(local)) {
      const o = local[id];
      if (!merged.some((x) => String(x.id) === id)) merged.unshift(o);
    }
    merged.sort((a, b) => {
      const ta = new Date(a.created_at || a.order_date || 0).getTime();
      const tb = new Date(b.created_at || b.order_date || 0).getTime();
      return tb - ta;
    });
    setCompletedOrders(merged);
  }, []);

  useEffect(() => {
    const canViewOrders = userRole === 'supervisor' || userRole === 'admin';
    if ((mode === 'submitted' || mode === 'dashboard') && canViewOrders) {
      fetchSubmittedOrders();
      fetchCompletedOrders();
    } else {
      setOrdersError(null);
    }
  }, [mode, userRole, fetchSubmittedOrders, fetchCompletedOrders]);

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

  /** موافقة على طلب — يُحدَّث Supabase أولاً؛ لا تُحدَّث الواجهة إلا بعد نجاح التحديث أو إرجاع صف. */
  const handleApproveSubmittedOrder = useCallback(async () => {
    const order = selectedOrder;
    if (!order?.id) return;
    setOrderActionLoading(true);
    try {
      const approvedOrder = { ...order, status: 'completed' };
      
      // Update with latest items and total in case they were edited
      const { error: finalUpdErr } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          items: order.items,
          total_amount: order.total_amount
        })
        .eq('id', order.id);
      
      if (finalUpdErr) throw finalUpdErr;

      saveApprovedOrderLocal(approvedOrder);
      setSelectedOrder(null);
      setSubmittedOrdersTab('completed');
      await Promise.all([fetchSubmittedOrders(), fetchCompletedOrders()]);
      void queryClient.invalidateQueries({ queryKey: ['dashboardOrders'] });
    } catch (e) {
      console.error(e);
      alert('تعذر تحديث حالة الطلب في قاعدة البيانات: ' + (e?.message || e));
    } finally {
      setOrderActionLoading(false);
    }
  }, [selectedOrder, fetchSubmittedOrders, fetchCompletedOrders, queryClient]);

  const removeItemFromSelectedOrder = (idx) => {
    setSelectedOrder(prev => {
      if (!prev) return null;
      const newItems = [...(prev.items || [])];
      newItems.splice(idx, 1);
      const newTotal = newItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      return { ...prev, items: newItems, total_amount: newTotal };
    });
  };

  const addItemToSelectedOrder = (product) => {
    setSelectedOrder(prev => {
      if (!prev) return null;
      const price = product.priceAfterDiscount || product.price || 0;
      const newItem = {
        barcode: product.barcode,
        name: product.name,
        qty: 1,
        price: price,
        total: price
      };
      const newItems = [...(prev.items || []), newItem];
      const newTotal = newItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      return { ...prev, items: newItems, total_amount: newTotal };
    });
  };

  const updateSelectedItemField = (idx, field, val) => {
    setSelectedOrder(prev => {
      if (!prev) return null;
      const newItems = [...(prev.items || [])];
      const item = { ...newItems[idx] };
      item[field] = val;
      // Recalculate row total
      item.total = (Number(item.qty) || 0) * (Number(item.price) || 0);
      newItems[idx] = item;
      // Recalculate order total
      const newTotal = newItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      return { ...prev, items: newItems, total_amount: newTotal };
    });
  };

  const [orderEditSearch, setOrderEditSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [showStockZeroConfirm, setShowStockZeroConfirm] = useState(false);
  const [stockZeroPending, setStockZeroPending] = useState(null);
  const [formData, setFormData] = useState({
    barcode: '',
    brand_group: '',
    eng_name: '',
    product_type: '',
    box_count: '',
    full_price: '',
    price_after_disc: '',
    stock_count: '',
    image_url: '',
    visible: true,
    is_offer: false,
  });
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [productDetailQty, setProductDetailQty] = useState(1);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  // عندما يفتح منتج في نافذة التفاصيل:
  // - نعيد تعيين الكمية إلى 1
  // - نسمح بإغلاق النافذة بزر ESC من لوحة المفاتيح
  useEffect(() => {
    if (selectedItem) setProductDetailQty(1);

    if (!selectedItem) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setSelectedItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  // Quantity Modal State
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityItem, setQuantityItem] = useState(null);
  const [addToCartPressedId, setAddToCartPressedId] = useState(null); // حالة محلية لزر Add to Cart (برتقالي + أيقونة سلة)
  const [stockAlert, setStockAlert] = useState(''); // State for non-blocking stock warnings

  useEffect(() => {
    if (!quantityItem) setAddToCartPressedId(null);
  }, [quantityItem]);

  const { playSuccess, playError, playCheckout } = useSystemSounds();
  const [quantityEventClick, setQuantityEventClick] = useState(null);
  const [quantityValue, setQuantityValue] = useState(1);

  // Quick Name Edit State
  const [editingNameItem, setEditingNameItem] = useState(null);
  const [newName, setNewName] = useState('');

  // Quick Type Edit State
  const [editingTypeItem, setEditingTypeItem] = useState(null);
  const [newType, setNewType] = useState('');

  // Quick Category (تصنيف) Edit State — لتعديل التصنيف سريعاً من شاشة الأدمن
  const [quickEditCategoryItem, setQuickEditCategoryItem] = useState(null);
  const [quickEditCategoryValue, setQuickEditCategoryValue] = useState('');
  const [quickEditCategorySaving, setQuickEditCategorySaving] = useState(false);

  const openNameEditModal = (item) => {
    setEditingNameItem(item);
    setNewName(item.name || '');
  };

  const openTypeEditModal = (item) => {
    setEditingTypeItem(item);
    setNewType(item.productType || '');
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

  const saveTypeEdit = async () => {
    if (!editingTypeItem) return;
    try {
      const { error } = await supabase
        .from('items')
        .update({ product_type: newType.trim() })
        .eq('barcode', editingTypeItem.barcode);

      if (error) throw error;

      // Update local state
      setItems((prev) =>
        prev.map((i) =>
          i.barcode === editingTypeItem.barcode ? { ...i, productType: newType.trim() } : i
        )
      );
      setEditingTypeItem(null);
      setNewType('');
    } catch (err) {
      alert('Failed to update product type: ' + err.message);
    }
  };

  const openQuickEditCategory = (item) => {
    if (userRole !== 'admin') return;
    setQuickEditCategoryItem(item);
    setQuickEditCategoryValue((item && item.group) ? String(item.group).trim() : '');
  };

  const handleQuickSaveCategory = async () => {
    if (!quickEditCategoryItem) return;
    const newGroup = quickEditCategoryValue.trim() || null;
    setQuickEditCategorySaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({ brand_group: newGroup })
        .eq('barcode', quickEditCategoryItem.barcode);

      if (error) throw error;

      setItems((prev) =>
        prev.map((i) =>
          i.barcode === quickEditCategoryItem.barcode ? { ...i, group: newGroup || '' } : i
        )
      );

      const uname = username || localStorage.getItem('sales_username') || 'unknown';
      const ov = (quickEditCategoryItem.group != null ? String(quickEditCategoryItem.group) : '').trim();
      const nv = newGroup ? String(newGroup) : '';
      if (ov !== nv) {
        await logActivityToSupabase({ username: uname, entity_id: quickEditCategoryItem.barcode, field_name: 'brand_group', old_value: ov, new_value: nv, description: `الفئة: ${ov || '—'} → ${nv || '—'}` });
      }
      fetchActivityLogs();
      setQuickEditCategoryItem(null);
      setQuickEditCategoryValue('');
    } catch (err) {
      alert('فشل تحديث التصنيف: ' + (err?.message || err));
    } finally {
      setQuickEditCategorySaving(false);
    }
  };

  const [isPending, startTransition] = useTransition();

  const setOrderInfoField = (key, value) =>
    setOrderInfo((prev) => ({ ...prev, [key]: value }));

  const getItemByBarcode = (barcode) => items.find((i) => barcodesMatch(i.barcode, barcode));

  const createNewOffer = () => {
    const id = 'o_' + Date.now();
    setCustomOffers((prev) => [...prev, { id, title: 'عرض جديد', items: [], showOnSalesScreen: true }]);
    setEditingOffer({ id, title: 'عرض جديد', items: [], showOnSalesScreen: true });
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
    const showOnSales = editingOffer.showOnSalesScreen !== false;
    const offerData = {
      id: editingOffer.id,
      title: editingOffer.title || 'عرض',
      items: editingOffer.items,
      updated_at: new Date().toISOString(),
      show_on_sales_screen: showOnSales,
    };
    setCustomOffers((prev) => {
      const next = prev.filter((o) => o.id !== editingOffer.id);
      next.push({ id: offerData.id, title: offerData.title, items: offerData.items, showOnSalesScreen: showOnSales });
      return next;
    });
    setEditingOffer(null);
    try {
      const { error } = await supabase.from('custom_offers').upsert(offerData, { onConflict: 'id' });
      if (error) throw error;
      alert('تم حفظ العرض بنجاح');
    } catch (e) {
      console.warn('Supabase save offer:', e);
      // Rollback local state if database save failed
      setCustomOffers((prev) => prev.filter((o) => o.id !== editingOffer.id));
      
      if (e?.message && String(e.message).includes('show_on_sales_screen')) {
        try {
          const { id, title, items, updated_at } = offerData;
          const { error: retryErr } = await supabase.from('custom_offers').upsert({ id, title, items, updated_at }, { onConflict: 'id' });
          if (retryErr) throw retryErr;
          alert('تم حفظ العرض بنجاح (بدون خيار الشاشة)');
          // Re-add to local state if retry worked
          setCustomOffers((prev) => [...prev, { id, title, items, showOnSalesScreen: true }]);
        } catch (inner) {
          alert('فشل حفظ العرض: ' + (inner.message || inner));
        }
      } else {
        alert('حدث خطأ أثناء حفظ العرض في قاعدة البيانات: ' + (e.message || e));
      }
    }
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
    setEditingOffer({
      id: offer.id,
      title: offer.title,
      items: [...offer.items],
      showOnSalesScreen: offer.showOnSalesScreen !== false,
    });
  };

  const abortControllerRef = useRef(null);

  useEffect(() => {
    const fetchCustomOrder = async () => {
      try {
        const { data, error } = await supabase.from('app_settings').select('value').eq('id', 'homepage_barcode_order').single();
        if (!error && data?.value && Array.isArray(data.value)) {
          setDynamicBarcodeOrder(data.value);
        }
      } catch (err) {
        console.error('Error fetching dynamic order', err);
      }
    };
    fetchCustomOrder();
  }, []);

  const saveCustomOrder = async (newOrderForCategory) => {
    try {
      // Merge the new sorted order with the other category items
      const previousOrderMap = new Map(dynamicBarcodeOrder.map((bc, index) => [bc, index]));

      const updatedOrder = [...dynamicBarcodeOrder];
      // Keep everything that IS NOT in the newly sorted array untouched
      const otherCategoryItems = updatedOrder.filter(bc => !newOrderForCategory.includes(bc));

      // Since the newOrderForCategory contains ONLY the barcodes of the selected category
      // We just prepend the otherCategoryItems and then append the newly sorted items (or vice versa, 
      // as long as the relative index differences within the category are maintained)
      // A safe way is to just replace the old elements with the new elements in place, 
      // or simply construct a new array:

      const mergedOrder = Array.from(new Set([...otherCategoryItems, ...newOrderForCategory]));

      const { error } = await supabase.from('app_settings').upsert({ id: 'homepage_barcode_order', value: mergedOrder });
      if (error) throw error;
      setDynamicBarcodeOrder(mergedOrder);
      setIsSortingMode(false);
      setSortingCategory(null);
      alert('تم حفظ ترتيب المنتجات بنجاح!');
    } catch (e) {
      console.error('Fail save order:', e);
      alert(`فشل حفظ الترتيب: ${e?.message || e?.details || 'خطأ غير معروف في قاعدة البيانات'}`);
    }
  };

  /** جلب المنتجات: IndexedDB أولاً، ثم Supabase عند توفر الشبكة — بدون استدعاء الشبكة أبداً عند الأوفلاين */
  const loadItemsFromSources = useCallback(async () => {
    let useBaseSelect = false;
    let allItems = [];

    let localRows = [];
    try {
      localRows = await getLocalProducts();
    } catch (idbErr) {
      console.warn('IndexedDB read failed:', idbErr);
    }
    const localNormalized = (localRows || []).map(normalizeItemFromSupabase).filter(Boolean);
    const sortedLocal = sortByBarcodeOrder(localNormalized, dynamicBarcodeOrder);

    const fromLocalOnly = () => ({
      items: sortedLocal,
      useBaseSelect: false,
      accumulatedRaw: [],
      rawCount: sortedLocal.length,
    });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return fromLocalOnly();
    }

    try {
      const { data, error } = await supabase.from('items').select(ITEMS_SELECT);

      if (error) {
        if (error.message?.includes('column items.is_offer does not exist') || error.message?.includes('column items.visible does not exist') || error.code === '42703') {
          console.warn('items column missing (is_offer/visible), falling back to base items query...');
          useBaseSelect = true;
          const { data: retryData, error: retryError } = await supabase.from('items').select(ITEMS_BASE_SELECT);
          if (retryError) throw retryError;
          allItems = retryData || [];
        } else {
          throw error;
        }
      } else {
        allItems = data || [];
      }

      const rawCount = allItems.length;
      const accumulatedRaw = [...allItems];

      const itemsToCache = allItems.map((item) => ({ ...item, id: String(item.barcode ?? '').trim() }));
      await saveProductsLocally(itemsToCache);

      try {
        const localItems = await getLocalProducts();
        const normalized = allItems.map(normalizeItemFromSupabase).filter(Boolean);

        const mergedItems = normalized.map((item) => {
          const localMatch = localItems.find((li) => String(li.id) === String(item.id));
          if (!localMatch || localMatch.stock_delta === 0) return item;

          const deltaQty = localMatch.stock_delta || 0;
          const stockMatch =
            item.stock_count != null ? { quantity: item.stock_count } : item.stock != null ? { quantity: item.stock } : 0;

          return { ...item, quantity: parseFloat(stockMatch.quantity) + deltaQty };
        });

        const localOnly = localItems.filter((li) => !normalized.some((ni) => String(ni.id) === String(li.id)));
        const combined = [...mergedItems, ...localOnly.map(normalizeItemFromSupabase)];

        const sorted = sortByBarcodeOrder(combined, dynamicBarcodeOrder);
        return { items: sorted, useBaseSelect, accumulatedRaw, rawCount };
      } catch (innerErr) {
        console.warn('Error merging local items or sorting:', innerErr);
        const normalized = allItems.map(normalizeItemFromSupabase).filter(Boolean);
        const sorted = sortByBarcodeOrder(normalized, dynamicBarcodeOrder);
        return { items: sorted, useBaseSelect, accumulatedRaw, rawCount };
      }
    } catch (err) {
      console.error('Supabase fetch error, using local IndexedDB cache:', err);
      if (sortedLocal.length > 0) return fromLocalOnly();
      return { items: [], useBaseSelect: false, accumulatedRaw: [], rawCount: 0 };
    }
  }, [dynamicBarcodeOrder]);

  /** عرض كاش IndexedDB فوراً قبل انتهاء طلب Supabase (شبكة بطيئة) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getLocalProducts();
        if (cancelled || !rows?.length) return;
        const normalized = rows.map(normalizeItemFromSupabase).filter(Boolean);
        if (!normalized.length) return;
        const sorted = sortByBarcodeOrder(normalized, dynamicBarcodeOrder);
        queryClient.setQueryData(['items', dynamicBarcodeOrder], (prev) => {
          if (prev?.items?.length) return prev;
          return {
            items: sorted,
            useBaseSelect: false,
            accumulatedRaw: [],
            rawCount: sorted.length,
          };
        });
      } catch (_) {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dynamicBarcodeOrder, queryClient]);

  const loadDashboardOrders = useCallback(async () => {
    /**
     * طلبان متوازيان:
     * 1) أحدث الطلبات بأي حالة (قد يكون أغلبها قيد الانتظار فيزاح الطلبات المعتمدة القديمة خارج الحد).
     * 2) أحدث الطلبات المعتمدة (completed) صراحةً — تضمن ظهورها في التحليل والجدول.
     */
    const [recentRes, completedRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1200),
      supabase
        .from('orders')
        .select('*')
        .ilike('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(800),
    ]);
    if (recentRes.error) {
      console.error('Dashboard orders fetch error:', recentRes.error);
      throw recentRes.error;
    }
    if (completedRes.error) {
      console.warn('Dashboard: completed branch failed, using recent orders only:', completedRes.error);
    }
    const byId = new Map();
    for (const row of [...(recentRes.data ?? []), ...(completedRes.data ?? [])]) {
      if (row && row.id != null) byId.set(row.id, row);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    );
  }, []);

  const canViewDashboardOrders = userRole === 'supervisor' || userRole === 'admin';
  const dashboardOrdersQuery = useQuery({
    queryKey: ['dashboardOrders'],
    queryFn: loadDashboardOrders,
    enabled: mode === 'dashboard' && canViewDashboardOrders,
    staleTime: QUERY_STALE_REPORTS_MS,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const dashboardOrders = dashboardOrdersQuery.data ?? [];
  const dashboardOrdersLoading = dashboardOrdersQuery.isPending;

  const itemsQuery = useQuery({
    queryKey: ['items', dynamicBarcodeOrder],
    queryFn: loadItemsFromSources,
    staleTime: QUERY_STALE_DEFAULT_MS,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: (failureCount) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
      return failureCount < 2;
    },
    networkMode: 'offlineFirst',
  });

  useEffect(() => {
    setLoading(itemsQuery.isPending);
  }, [itemsQuery.isPending]);

  // Sync offline orders on startup and when online event fires
  const syncOfflineOrders = useCallback(async () => {
    try {
      const pendingOrders = await getSyncQueue();
      if (pendingOrders.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      console.log(`Attempting to sync ${pendingOrders.length} offline orders...`);
      for (const order of pendingOrders) {
        // Remove local id/timestamp properties added by IDB before sending to Supabase
        const { id, timestamp, ...orderDataToSync } = order;

        const { data: insertedSync, error } = await supabase.from('orders').insert([orderDataToSync]).select('id').single();
        if (!error) {
          await removeFromSyncQueue(order.id);
          if (insertedSync?.id) {
            await applyCreditAfterOrder(orderDataToSync, insertedSync.id);
          }
          console.log(`Successfully synced offline order ${order.id}`);
        } else {
          console.error(`Failed to sync offline order ${order.id}:`, error);
        }
      }
      // تحديث عدد الطلبات المعلقة بعد المزامنة
      const remaining = await getSyncQueue();
      setPendingSyncCount(remaining.length);
    } catch (err) {
      console.error('Offline sync failed:', err);
    }
  }, [applyCreditAfterOrder]);

  const refreshPendingSyncCount = useCallback(async () => {
    try {
      const q = await getSyncQueue();
      setPendingSyncCount(q.length);
    } catch (_) { }
  }, []);

  useEffect(() => {
    syncOfflineOrders();
    refreshPendingSyncCount();

    const onOnline = () => {
      syncOfflineOrders();
      refreshPendingSyncCount();
      queryClient.invalidateQueries({ queryKey: ['items'] });
    };

    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [syncOfflineOrders, refreshPendingSyncCount, queryClient]);

  // Removed pagination and server-side search effects
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
      const from = itemsOffsetRef.current;
      const to = from + ITEMS_PAGE_SIZE - 1;
      const selectCols = itemsUseBaseSelectRef.current ? ITEMS_BASE_SELECT : ITEMS_SELECT;
      try {
        const { data, error } = await supabase
          .from('items')
          .select(selectCols)
        .order('barcode', { ascending: true })
        .range(from, to);
      if (error) throw error;
      const newRaw = data || [];
      itemsOffsetRef.current += newRaw.length;
      setHasMore(newRaw.length === ITEMS_PAGE_SIZE);
      accumulatedRawItemsRef.current = [...accumulatedRawItemsRef.current, ...newRaw];

      const normalizedNew = newRaw.map(normalizeItemFromSupabase).filter(Boolean);
      const localItems = await getLocalProducts();
      const mergedNew = normalizedNew.map((item) => {
        const localMatch = localItems.find((li) => String(li.id) === String(item.id));
        if (!localMatch || localMatch.stock_delta === 0) return item;
        const deltaQty = localMatch.stock_delta || 0;
        const stockMatch = item.stock_count != null ? { quantity: item.stock_count } : item.stock != null ? { quantity: item.stock } : 0;
        return { ...item, quantity: parseFloat(stockMatch.quantity) + deltaQty };
      });

      setItems((prev) => {
        const combined = [...prev, ...mergedNew];
        return sortByBarcodeOrder(combined, dynamicBarcodeOrder);
      });

      const toCache = accumulatedRawItemsRef.current.map((item) => ({ ...item, id: String(item.barcode ?? '').trim() }));
      await saveProductsLocally(toCache);
    } catch (err) {
      console.error('Load more items failed:', err);
      itemsOffsetRef.current = from;
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, dynamicBarcodeOrder]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) loadMore();
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);
  const loadMoreRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const ITEMS_PAGE_SIZE = 100;
  const itemsOffsetRef = useRef(0);
  const accumulatedRawItemsRef = useRef([]);
  const itemsUseBaseSelectRef = useRef(false);

  useEffect(() => {
    if (!itemsQuery.data) return;
    const d = itemsQuery.data;
    setItems(d.items);
    itemsUseBaseSelectRef.current = d.useBaseSelect;
    itemsOffsetRef.current = d.rawCount ?? 0;
    accumulatedRawItemsRef.current = d.accumulatedRaw ?? [];
    setHasMore(false);
  }, [itemsQuery.data]);

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
      // Non-admins: visible products only + in stock (admin keeps out-of-stock on screen)
      if (userRole !== 'admin') {
        list = list.filter((i) => i.visible !== false);
        list = list.filter((i) => itemIsInStockForSale(i));
      }
      // In offers mode, non-admins see only offers. Admins see all (to manage them).
      if (mode === 'offers' && userRole !== 'admin') {
        list = list.filter((i) => i.isOffer);
      }
      const q = (search || '').trim();
      if (!q) return list;
      // البحث حسب نوع المنتج (product_type) والباركود — من أول حرف
      const normalize = (s) => (s || '').normalize('NFC').toLowerCase();
      const qNorm = normalize(q);
      const tokens = qNorm.split(/\s+/).filter(Boolean);
      const qDigits = toEnglishDigits(q.replace(/\s/g, ''));
      return list.filter(
        (i) => {
          const productType = normalize(i.productType || i.product_type || '');
          const barcode = (i.barcode || '').toString().trim();
          const barcodeNorm = normalize(barcode);
          const matchText = (text) => {
            if (!text) return false;
            if (tokens.length <= 1) return text.includes(qNorm);
            return tokens.every((t) => text.includes(t));
          };
          return (
            matchText(productType) ||
            matchText(barcodeNorm) ||
            (qDigits && barcode.includes(qDigits))
          );
        }
      );
    },
    [filteredByGroup, search, mode, userRole]
  );

  /** Memoized sections (Electrical + Kitchenware) with sorted lists — avoids re-sort on every render for POS performance */
  const productSections = useMemo(() => {
    const electrical = filteredItems.filter((i) => isElectricalGroup(i.group));
    const kitchenware = filteredItems.filter((i) => !isElectricalGroup(i.group));
    const sortSecondary = sortMode === 'barcode'
      ? (arr) => sortByBarcodeOrder(arr, dynamicBarcodeOrder)
      : (arr) => [...arr].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar', { sensitivity: 'base' }));
    /** Kitchenware: أولاً حسب ترتيب المجموعات (HOUSEHOLD_GROUPS)، ثم باركود/اسم داخل المجموعة — حتى يبقى الترتيب كالكشف عند البحث */
    const sortKitchenwareByGroupOrder = (arr) => {
      const byGroup = new Map();
      for (const item of arr) {
        const g = String(item.group || '').trim().toLowerCase();
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(item);
      }
      const out = [];
      const seen = new Set();
      for (const hg of HOUSEHOLD_GROUPS) {
        if (byGroup.has(hg)) {
          out.push(...sortSecondary(byGroup.get(hg)));
          seen.add(hg);
        }
      }
      const rest = [...byGroup.keys()].filter((k) => !seen.has(k)).sort((a, b) => String(a).localeCompare(String(b)));
      for (const k of rest) {
        out.push(...sortSecondary(byGroup.get(k)));
      }
      return out;
    };
    return [
      { title: 'Electrical Appliances', items: sortSecondary(electrical), color: 'indigo', icon: Zap },
      { title: 'Kitchenware', items: sortKitchenwareByGroupOrder(kitchenware), color: 'sky', icon: UtensilsCrossed },
    ];
  }, [filteredItems, sortMode, dynamicBarcodeOrder]);

  const filteredInventoryItems = useMemo(() => {
    let list = filteredItems || [];
    const raw = (inventorySearch || '').trim().toLowerCase();
    if (raw) {
      const q = toEnglishDigits(raw.replace(/\s/g, ''));
      list = list.filter((i) => {
        const name = (i.name || '').toLowerCase();
        const group = (i.group || '').toLowerCase();
        const barcode = String(i.barcode || '').trim();
        return name.includes(raw) || group.includes(raw) || barcode.includes(q);
      });
    }
    if (inventoryCategoryFilter) list = list.filter((i) => (i.group || '') === inventoryCategoryFilter);
    if (inventoryLowStockOnly) list = list.filter((i) => (i.stock_count ?? i.stock ?? 0) <= 5);
    return list;
  }, [filteredItems, inventorySearch, inventoryLowStockOnly, inventoryCategoryFilter]);

  /** عدد الأصناف التي أوشكت على النفاد (0–5) للشارة بجانب "Inventory" في القائمة الجانبية */
  const lowStockCount = useMemo(
    () => items.filter((i) => {
      const s = Number(i.stock_count ?? i.stock);
      return !isNaN(s) && s >= 0 && s <= 5;
    }).length,
    [items]
  );

  const allGroups = useMemo(
    () => [...new Set(items.map((i) => i.group).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))),
    [items]
  );
  const allProductTypes = useMemo(
    () => [...new Set(items.map((i) => i.productType).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))),
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

  /** Stock: red = out, yellow = last 5, green = plenty — useCallback for ProductCard memo */
  const getStockStatus = useCallback((item) => {
    const s = item?.stock ?? item?.stock_count;
    if (s == null || s === '') return 'Out of Stock';
    const n = Number(s);
    if (isNaN(n) || n <= 0) return 'Out of Stock';
    if (n <= 5) return 'Low Stock';
    return 'In Stock';
  }, []);
  const getStockLabel = (item) => {
    const status = getStockStatus(item);
    if (status === 'Out of Stock') return 'Out of Stock';
    if (status === 'Low Stock') return 'Last 5 units';
    return 'Available';
  };

  /** Calculate Inventory Report Metrics */
  const inventoryMetrics = useMemo(() => {
    let totalValue = 0;
    let totalItemsCount = 0;
    let outOfStockCount = 0;
    let lowStockItemsCount = 0;
    const categoryBreakdown = {};
    const topItems = [];
    const bestSellers = [];
    const agingStock = [];
    const depletionForecast = [];
    const now = new Date();

    items.forEach((item) => {
      const qty = Number(item.stock_count ?? item.stock ?? 0);
      const price = Number(item.priceAfterDiscount ?? item.price ?? 0);
      const value = qty * price;

      totalValue += value;
      totalItemsCount += qty;

      if (qty <= 0) outOfStockCount++;
      else if (qty <= 5) lowStockItemsCount++;

      const group = item.group || 'غير مصنف';
      if (!categoryBreakdown[group]) {
        categoryBreakdown[group] = { value: 0, count: 0 };
      }
      categoryBreakdown[group].value += value;
      categoryBreakdown[group].count += qty;

      topItems.push({ ...item, totalValue: value, qty, price });

      // Insights calculations
      let unitsSold = 0;
      let lastSoldDate = null;
      let daysSinceLastSale = null;
      let salesVelocity = 0;
      let daysUntilDepletion = null;

      if (inventoryInsights && item.barcode && inventoryInsights[item.barcode]) {
        const ins = inventoryInsights[item.barcode];
        unitsSold = ins.unitsSold || 0;
        lastSoldDate = ins.lastSoldDate;
        salesVelocity = ins.salesVelocity ?? 0;
        if (lastSoldDate) {
          const diffTime = Math.abs(now - lastSoldDate);
          daysSinceLastSale = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        // تاريخ النفاد المتوقع: الكمية الحالية ÷ معدل البيع اليومي (أيام حتى النفاد)
        if (salesVelocity > 0 && qty > 0) {
          daysUntilDepletion = Math.ceil(qty / salesVelocity);
        }
      }

      const insightItem = { ...item, unitsSold, lastSoldDate, daysSinceLastSale, salesVelocity, daysUntilDepletion, qty, price };

      if (unitsSold > 0) {
        bestSellers.push(insightItem);
      }

      // Aging Stock: Has stock (>0) but hasn't sold in the last 30 days (or never sold in the 90 day window)
      if (qty > 0) {
        if (!lastSoldDate || daysSinceLastSale > 30) {
          agingStock.push(insightItem);
        }
      }

      // للتنبؤ الذكي: أصناف لديها معدل بيع وكمية — تُدرج في depletionForecast أدناه
      if (qty > 0 && salesVelocity > 0 && daysUntilDepletion != null) {
        depletionForecast.push(insightItem);
      }
    });

    topItems.sort((a, b) => b.totalValue - a.totalValue);
    bestSellers.sort((a, b) => b.unitsSold - a.unitsSold);
    agingStock.sort((a, b) => (b.daysSinceLastSale || 999) - (a.daysSinceLastSale || 999));
    // الأقرب للنفاد أولاً (حسب عدد الأيام المتوقع حتى النفاد)
    depletionForecast.sort((a, b) => (a.daysUntilDepletion ?? 999) - (b.daysUntilDepletion ?? 999));

    return {
      totalValue,
      totalItemsCount,
      uniqueSKUs: items.length,
      outOfStockCount,
      lowStockItemsCount,
      categoryBreakdown: Object.entries(categoryBreakdown)
        .sort(([, a], [, b]) => b.value - a.value)
        .map(([group, stats]) => ({ group, ...stats })),
      topValueItems: topItems.slice(0, 10),
      bestSellers: bestSellers.slice(0, 50),
      agingStock: agingStock.slice(0, 50),
      depletionForecast: depletionForecast.slice(0, 50),
    };
  }, [items, inventoryInsights]);

  // تنبيه تنبؤ النفاد (48 ساعة): إشعار محلي عند وجود أصناف ستنفد خلال يومين — مرة واحدة يومياً
  const DEPLETION_ALERT_HOURS = 48;
  const DEPLETION_ALERT_DAYS = Math.ceil(DEPLETION_ALERT_HOURS / 24); // 2
  useEffect(() => {
    if (mode !== 'reports' || activeReportTab !== 'inventory' || insightsLoading) return;
    const list = inventoryMetrics?.depletionForecast?.filter((i) => (i.daysUntilDepletion ?? 999) <= DEPLETION_ALERT_DAYS) ?? [];
    if (list.length === 0) return;

    const today = new Date().toDateString();
    try {
      if (localStorage.getItem('sales_depletion_alert_date') === today) return;
    } catch (_) { }

    const showNotification = () => {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const names = list.slice(0, 3).map((i) => i.name || i.barcode || 'صنف').join('، ');
      const title = 'تنبيه مخزون';
      const body = list.length === 1
        ? `${names} — سينفد خلال ${list[0].daysUntilDepletion} أيام`
        : `${list.length} أصناف ستنفد خلال 48 ساعة منها: ${names}`;
      try {
        const n = new Notification(title, { body, icon: '/pwa-192x192.png', tag: 'depletion-alert' });
        n.onclick = () => window.focus();
        localStorage.setItem('sales_depletion_alert_date', today);
      } catch (e) {
        console.warn('Notification failed:', e);
      }
    };

    if (Notification.permission === 'granted') {
      showNotification();
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => {
        if (p === 'granted') showNotification();
      });
    }
  }, [mode, activeReportTab, insightsLoading, inventoryMetrics, DEPLETION_ALERT_DAYS]);

  const requestStockAlertPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      alert('متصفحك لا يدعم الإشعارات.');
      return;
    }
    if (Notification.permission === 'granted') {
      alert('تنبيهات المخزون مفعّلة مسبقاً. ستصل إشعارات عند وجود أصناف ستنفد خلال 48 ساعة.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      alert('تم تفعيل تنبيهات المخزون. ستتلقى إشعاراً عند وجود أصناف متوقعة النفاد خلال 48 ساعة.');
    } else if (permission === 'denied') {
      alert('تم رفض الإشعارات. يمكنك تفعيلها لاحقاً من إعدادات المتصفح لهذا الموقع.');
    }
  }, []);

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

  /** مصغّرات لقائمة المنتجات والكروت الصغيرة — أقل حجم تحميل عبر Supabase Image Transformation */
  const getImage = (item) => getPublicImageUrl(item?.image, { thumb: true });
  /** صورة كاملة (مثلاً نافذة تفاصيل المنتج) */
  const getImageFull = (item) => getPublicImageUrl(item?.image, { thumb: false });
  const getImageFallback = (item) => {
    const primary = getPublicImageUrl(item?.image, { thumb: true });
    if (primary) return primary;
    if (!item?.barcode) return null;
    const b = String(item.barcode).trim();
    if (!b) return null;
    const paths = [`electric/${b}.jpg`, `electric/${b}.jpeg`, `electric/${b}.png`, `${b}.jpg`, `${b}.jpeg`];
    for (const p of paths) {
      const url = getPublicImageUrl(p, { thumb: true });
      if (url) return url;
    }
    return null;
  };

  /* Voice Search Integration */
  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("عذراً، متصفحك لا يدعم خاصية البحث الصوتي.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar'; // Optimize for Arabic
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearch(transcript);
      setPage(0);
    };

    recognition.onerror = (event) => {
      console.error("Voice recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [setSearch, setPage, setIsListening]);

  /* Catalog Helpers */


  const handleCategorySwitch = useCallback((cat) => {
    if (selectedGroup === cat) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20); // Light haptic tap for category switch
    }
    setSelectedGroup(cat);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedGroup]);

  const addToOrder = useCallback((item, qty = 1, event = null) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50); // Haptic feedback for Add to Cart
    }
    
    const stockCountNum = Number(item.stock_count);
    const currentLine = orderItems.find((x) => x.id === item.id);
    const currentQty = currentLine ? (Number(currentLine.qty) || 0) : 0;
    
    if (!isNaN(stockCountNum) && stockCountNum > 0 && (currentQty + qty) > stockCountNum) {
      playError();
      setStockAlert(`عذراً، الكمية المتوفرة هي ${stockCountNum} فقط لهذا الصنف.`);
      setTimeout(() => setStockAlert(''), 3500);
    }

    startTransition(() => {
      setOrderItems((prev) => {
        const unitPrice = Math.round(item.priceAfterDiscount ?? item.price ?? 0);
        const box = item.box != null && String(item.box).trim() ? String(item.box).trim() : null;

        let newQty = qty;
        const i = prev.findIndex((x) => x.id === item.id);

        if (i >= 0) {
          newQty = prev[i].qty + qty;
        }

        // Pure limit capping
        if (!isNaN(stockCountNum) && stockCountNum > 0 && newQty > stockCountNum) {
          newQty = stockCountNum;
        }

        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], qty: newQty };
          return next;
        }

        return [
          ...prev,
          { id: item.id, qty: newQty, unitPrice, box, item, customName: item.productType || item.name || item.group },
        ];
      });
    });

    // Trigger Fly Animation — يحتاج ref مرتبط بزر السلة (ديسكتوب أو موبايل)
    const cartEl = cartIconRef.current || cartNavRef.current;
    if (event && event.clientX && cartEl) {
      const cartRect = cartEl.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const endX = cartRect.left + cartRect.width / 2;
      const endY = cartRect.top + cartRect.height / 2;
      const id = Date.now() + Math.random();

      // Step 1: Element mounted at start position
      setFlyingItems(prev => [...prev, {
        id,
        image: getImage(item),
        startX,
        startY,
        endX,
        endY,
        flying: false // false initially
      }]);

      // Step 2: Trigger CSS transition next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlyingItems(prev => prev.map(f => f.id === id ? { ...f, flying: true } : f));
        });
      });

      // Step 3: Remove after animation
      setTimeout(() => {
        setFlyingItems(prev => prev.filter(f => f.id !== id));
      }, 700); // match transition duration
    }
  }, [startTransition, playError]);

  const removeFromOrder = useCallback((itemId) => {
    startTransition(() => setOrderItems((prev) => prev.filter((x) => x.id !== itemId)));
  }, [startTransition]);

  const setOrderQty = useCallback((itemId, qty) => {
    let n = Math.max(0, parseInt(qty, 10) || 0);
    const line = orderItems.find(x => x.id === itemId);
    
    if (line && line.item) {
      const stock = Number(line.item.stock_count);
      if (!isNaN(stock) && stock > 0 && n > stock) {
        playError();
        setStockAlert(`عذراً، الكمية المتوفرة في المخزون هي ${stock} فقط لهذا الصنف.`);
        setTimeout(() => setStockAlert(''), 3500);
      }
    }

    startTransition(() => {
      setOrderItems((prev) => {
        const itemLine = prev.find(x => x.id === itemId);
        if (itemLine && itemLine.item) {
          const stock = Number(itemLine.item.stock_count);
          if (!isNaN(stock) && stock > 0 && n > stock) n = stock; // pure cap
        }

        if (n === 0) return prev.filter((x) => x.id !== itemId);
        return prev.map((x) => (x.id === itemId ? { ...x, qty: n } : x));
      });
    });
  }, [orderItems, startTransition, playError]);

  /** زيادة/نقصان الكمية بواحد — يستخدم التحديث الدالي لضمان القراءة من آخر حالة */
  const changeOrderQtyBy = useCallback((itemId, delta) => {
    const line = orderItems.find(x => x.id === itemId);
    if (line) {
      const current = Number(line.qty) || 0;
      const n = Math.max(0, current + (Number(delta) || 0));
      if (line.item) {
        const stock = line.item.stock_count;
        if (stock != null && stock > 0 && n > stock) {
          playError();
          setStockAlert(`عذراً، الكمية المتوفرة في المخزون هي ${stock} فقط لهذا الصنف.`);
          setTimeout(() => setStockAlert(''), 3500);
        }
      }
    }

    setOrderItems((prev) => {
      const prevLine = prev.find((x) => x.id === itemId);
      if (!prevLine) return prev;
      const current = Number(prevLine.qty) || 0;
      const numericDelta = Number(delta) || 0;
      let n = Math.max(0, current + numericDelta);
      
      if (prevLine.item) {
        const stock = prevLine.item.stock_count;
        if (stock != null && stock > 0 && n > stock) n = stock; // pure cap
      }
      
      if (n === 0) return prev.filter((x) => x.id !== itemId);
      return prev.map((x) => (x.id === itemId ? { ...x, qty: n } : x));
    });
  }, [orderItems, playError]);

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

  // إجمالي عدد القطع (لتفعيل Ping عند أي إضافة — صنف جديد أو زيادة كمية)
  const totalCartPieces = orderLines.reduce((s, o) => s + (o.qty || 0), 0);

  // Ping على زر السلة عند إضافة منتج (سطر جديد أو كمية أكثر)
  useEffect(() => {
    const prev = cartCountPrevRef.current;
    if (prev !== null && totalCartPieces > prev) {
      setCartPing(true);
      const t = setTimeout(() => setCartPing(false), 550);
      return () => clearTimeout(t);
    }
    cartCountPrevRef.current = totalCartPieces;
  }, [totalCartPieces]);

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

  const orderSubtotal = orderLines.reduce((s, o) => s + getLineTotal(o), 0);

  const getOrderDiscount = (subtotal, info) => {
    let discount = 0;
    const val = Number(info?.discountValue) || 0;
    if (info?.discountType === 'percentage' && val > 0) {
      discount = subtotal * (val / 100);
    } else if (info?.discountType === 'amount' && val > 0) {
      discount = val;
    }
    return discount;
  };

  const finalOrderDiscount = getOrderDiscount(orderSubtotal, orderInfo);
  const orderTotal = Math.max(0, orderSubtotal - finalOrderDiscount);

  // Broadcast Cart Updates to Customer Display
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mode=display')) return;

    // We debounce the actual broadcast slightly or just send it directly if not heavy.
    // It's small data so direct is fine.
    try {
      const payload = {
        items: orderLines.map(line => ({
          id: line.id,
          name: line.customName || line.item.name || line.item.group,
          barcode: line.item.barcode,
          price: Number(line.item?.price) ?? 0,
          unit_price: getLineUnitPrice(line),
          qty: line.qty,
          total: getLineTotal(line),
          image: line.item?.image,
          productType: line.item?.productType
        })),
        total: orderTotal,
        customerName: orderInfo.merchantName || orderInfo.companyName,
        customerPoints: orderInfo.phone && customers ? customers.find(c => c.phone === orderInfo.phone)?.loyalty_points : null
      };

      supabase.channel('pos-display').send({
        type: 'broadcast',
        event: 'cart_update',
        payload: payload
      });
    } catch (e) {
      console.warn('Failed to broadcast to POS display', e);
    }
  }, [orderLines, orderTotal, orderInfo, customers]);
  const itemTotalWithTax = (lines) => {
    const sub = (lines || orderLines).reduce((s, o) => s + getLineTotal(o), 0);
    const disc = getOrderDiscount(sub, orderInfo);
    return Math.max(0, sub - disc);
  };

  const orderLinesByBox = [...orderLines].sort((a, b) =>
    String(getLineBox(a)).localeCompare(String(getLineBox(b)), undefined, {
      numeric: true,
    })
  );

  const getPrintHtml = useCallback((orderData, printInfoOverride) => {
    const isSubmitted = !!orderData;
    const lines = isSubmitted ? (orderData.items || []) : orderLines;
    const currentInfo = isSubmitted ? {
      companyName: orderData.customer_name || '',
      customerNumber: orderData.customer_number || '',
      merchantName: orderData.merchant_name || '',
      phone: orderData.customer_phone || '',
      address: orderData.customer_address || '',
      orderDate: orderData.order_date || (orderData.created_at ? new Date(orderData.created_at).toISOString().slice(0, 10) : ''),
      paymentMethod: orderData.payment_method || '',
      discountType: orderData.details?.discountType || '',
      discountValue: orderData.details?.discountValue || '',
    } : (printInfoOverride ?? orderInfo);

    // Calculate subtotal and discount for the print view
    const printSubtotal = isSubmitted ? (orderData.items || []).reduce((s, o) => s + (o.total || 0), 0) : orderLines.reduce((s, o) => s + getLineTotal(o), 0);
    let printDiscount = 0;
    const printDiscVal = Number(currentInfo.discountValue) || 0;
    if (currentInfo.discountType === 'percentage' && printDiscVal > 0) {
      printDiscount = printSubtotal * (printDiscVal / 100);
    } else if (currentInfo.discountType === 'amount' && printDiscVal > 0) {
      printDiscount = printDiscVal;
    }

    const totalAmount = isSubmitted ? (orderData.total_amount || 0) : orderTotal;

    const rows = (lines && lines.length > 0) ? lines
      .map((o) => {
        const item = isSubmitted ? o : (o.item || {});
        const unitPrice = isSubmitted ? (o.unit_price || o.price || 0) : getLineUnitPrice(o);
        const total = isSubmitted ? (o.total || 0) : getLineTotal(o);
        const consumerPrice = isSubmitted ? (o.consumer_price || 0) : (Number(o.item?.price) ?? 0);
        const discPercent = isSubmitted ? (o.discount_percent || 0) : getLineDiscountPercent(o);

        const barcodeToLookup = o.barcode || item.barcode || '';
        const liveItem = barcodeToLookup ? items.find((i) => barcodesMatch(i.barcode, barcodeToLookup)) : null;

        const rawName = (item.name || o.customName || o.name || item.group || o.group || '').replace(/</g, '&lt;');
        const prodTypeRaw = o.product_type || item.productType || liveItem?.productType || '';
        const prodType = prodTypeRaw.replace(/</g, '&lt;');
        const displayName = prodType ? prodType : rawName;
        const productTypeStr = ''; // Removed the badge since we are replacing the name entirely
        const barcode = barcodeToLookup.replace(/</g, '&lt;');
        const imgUrl = !isSubmitted && o.item?.image ? getPublicImageUrl(o.item.image, { thumb: true }) : null;
        const imgSrc = imgUrl ? String(imgUrl).replace(/"/g, '&quot;') : '';
        const imgCell = imgSrc ? `<td class="inv-td-img"><img src="${imgSrc}" alt="" loading="lazy" /></td>` : '<td class="inv-td-img">—</td>';

        return `<tr>
          ${imgCell}
          <td style="font-weight: 600;">${productTypeStr}${displayName}</td>
          <td dir="ltr" lang="en" style="font-family: monospace; color: #64748b;">${barcode}</td>
          <td dir="ltr" lang="en" style="font-weight: 700;">${o.qty}</td>
          <td dir="ltr" lang="en">₪${consumerPrice}</td>
          <td dir="ltr" lang="en">
            <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">${discPercent}%</span>
          </td>
          <td dir="ltr" lang="en" style="font-weight: 600;">₪${unitPrice}</td>
          <td dir="ltr" lang="en" style="font-weight: 800; color: #ea580c; font-size: 1.05rem;">₪${total.toFixed(2)}</td>
        </tr>`;
      })
      .join('') : '<tr><td colspan="8" style="text-align:center; padding: 40px; color:#64748b; font-size: 1.1rem;">لا توجد أصناف في الطلبية</td></tr>';

    const infoGridHtml = [
      ['اسم الشركة', currentInfo.companyName],
      ['رقم العميل', currentInfo.customerNumber, true],
      ['اسم التاجر', currentInfo.merchantName],
      ['رقم الهاتف', currentInfo.phone, true],
      ['العنوان', currentInfo.address],
      ['تاريخ الطلب', currentInfo.orderDate],
      ['طريقة الدفع', currentInfo.paymentMethod],
    ]
      .filter(([_, v]) => v) // only show if there is a value
      .map(
        ([l, v, isLtr]) =>
          `<div class="info-item"><span class="info-label">${l}</span><span class="info-value text-slate-800" ${isLtr ? 'dir="ltr" lang="en" style="font-family: monospace;"' : ''}>${(String(v) || '').replace(/</g, '&lt;')}</span></div>`
      )
      .join('');

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>طلبية مبيعات</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Tajawal', system-ui, sans-serif; padding: 40px; background: #f8fafc; color: #1e293b; margin: 0; direction: rtl; }
  .invoice-container { max-width: 1000px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 20px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.06); border: 1px solid #f1f5f9; }
  
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 32px; }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .brand-icon { width: 56px; height: 56px; background: linear-gradient(135deg, #4f46e5, #6366f1); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); }
  .print-title { font-size: 2.2rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
  .print-subtitle { color: #64748b; font-weight: 700; font-size: 0.9rem; letter-spacing: 1px; margin-top: 4px; text-transform: uppercase; }
  .header-meta { text-align: left; color: #64748b; font-size: 0.95rem; display: flex; flex-direction: column; gap: 6px; background: #f8fafc; padding: 12px 20px; border-radius: 12px; }
  .header-meta span strong { color: #334155; font-weight: 800; }
  
  .section-title { font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; display: flex; align-items: center; gap: 10px; }
  .section-title::before { content: ''; display: block; width: 6px; height: 20px; background: #4f46e5; border-radius: 4px; }
  
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; background: transparent; margin-bottom: 32px; }
  .info-item { display: flex; flex-direction: column; gap: 4px; background: #f8fafc; padding: 12px 16px; border-radius: 12px; border: 1px solid #e2e8f0; border-right: 4px solid #4f46e5; }
  .info-label { font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 1.1rem; font-weight: 800; color: #0f172a; word-break: break-word; }
  
  table.data-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-bottom: 2rem; font-size: 0.95rem; }
  table.data-table thead th { background: #f1f5f9; color: #475569; padding: 14px 16px; text-align: right; font-weight: 800; white-space: nowrap; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
  table.data-table thead th:first-child { border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
  table.data-table thead th:last-child { border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
  
  table.data-table tbody td { padding: 16px; background: #ffffff; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #334155; }
  table.data-table tbody td:first-child { border-right: 1px solid #f1f5f9; border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
  table.data-table tbody td:last-child { border-left: 1px solid #f1f5f9; border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
  table.data-table tbody tr:hover td { background: #f8fafc; border-color: #e2e8f0; }
  
  .inv-td-img { width: 70px; text-align: center; }
  .inv-td-img img { width: 50px; height: 50px; object-fit: contain; border-radius: 8px; border: 1px solid #f1f5f9; background: #fff; padding: 2px; }
  
  .total-section { display: flex; justify-content: flex-end; margin-top: 32px; }
  .total-card { background: #f8fafc; padding: 24px 32px; border-radius: 16px; min-width: 340px; border: 1px solid #e2e8f0; }
  .total-row-flex { display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; color: #475569; margin-bottom: 16px; font-weight: 700; }
  .total-row-main { display: flex; justify-content: space-between; align-items: center; font-size: 2rem; font-weight: 900; border-top: 2px dashed #cbd5e1; padding-top: 20px; color: #0f172a; }
  .total-row-main span:last-child { color: #4f46e5; }
  
  .btn-print { padding: 16px 40px; background: #0f172a; color: #fff; border: none; border-radius: 16px; cursor: pointer; font-weight: 800; font-size: 1.1rem; margin: 40px auto 0; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.25); transition: all 0.2s ease; font-family: 'Tajawal', sans-serif; width: fit-content; }
  .btn-print:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(15, 23, 42, 0.35); background: #4f46e5; }
  
  @media screen and (max-width: 1024px) {
    body { padding: 20px; }
    .invoice-container { padding: 24px; border-radius: 16px; }
    .header { flex-direction: column; align-items: flex-start; gap: 20px; }
    .header-meta { width: 100%; flex-direction: row; justify-content: space-between; align-items: center; }
    .total-section { justify-content: stretch; }
    .total-card { width: 100%; min-width: 0; }
    .btn-print { width: 100%; }
    
    /* Make table scrollable horizontally if it overflows */
    .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 2rem; border-radius: 12px; }
    table.data-table { min-width: 700px; margin-bottom: 0; }
  }
  
  @media print {
    @page { margin: 0.5cm; }
    body { padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-container { box-shadow: none; border: none; padding: 0; max-width: 100%; width: 100%; }
    .btn-print { display: none; }
    
    .header { border-bottom-color: #e2e8f0; }
    .brand-icon { box-shadow: none; }
    .header-meta { background: transparent !important; padding: 0; border: none; text-align: left; align-items: end; }
    
    .info-grid { background: transparent !important; border: none; padding: 0; gap: 8px; margin-bottom: 16px; grid-template-columns: repeat(4, 1fr); }
    .info-item { background: transparent !important; border: 1px solid #cbd5e1; border-right: 4px solid #0f172a; padding: 8px 12px; }
    
    table.data-table { font-size: 0.85rem; border-spacing: 0; }
    table.data-table thead th { background: transparent !important; border-bottom: 2px solid #0f172a; color: #0f172a; padding: 8px 4px; white-space: normal; font-size: 0.8rem; border-radius: 0 !important; }
    table.data-table tbody td { border: none; border-bottom: 1px solid #e2e8f0; padding: 8px 4px; border-radius: 0 !important; }
    .inv-td-img img { width: 40px; height: 40px; border-color: #cbd5e1; }
    .inv-td-img { width: 50px; }
    
    .total-card { background: transparent !important; box-shadow: none; border: 2px solid #0f172a; page-break-inside: avoid; break-inside: avoid; min-width: 280px; padding: 16px 24px; }
    .total-row-main { border-top-color: #0f172a; border-top-style: solid; }
    .section-title::before { background: #0f172a !important; }
  }
</style></head><body>

<div class="invoice-container">
  <div class="header">
    <div class="header-left">
      <div class="brand-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>
      </div>
      <div>
        <h1 class="print-title">طلبية مبيعات</h1>
        <div class="print-subtitle">SALES ORDER AGREEMENT</div>
      </div>
    </div>
    <div class="header-meta">
      <span>تاريخ الإصدار: <strong dir="ltr">${new Date().toISOString().slice(0, 10)}</strong></span>
      <span>عدد الأصناف: <strong dir="ltr">${lines.length}</strong></span>
    </div>
  </div>

  <div class="section-title">بيانات العميل</div>
  <div class="info-grid">
    ${infoGridHtml}
  </div>

  <div class="section-title">تفاصيل المنتجات</div>
  <div class="table-responsive">
    <table class="data-table">
      <thead>
        <tr>
          <th>صورة</th>
          <th>وصف المنتج</th>
          <th>الباركود</th>
          <th>العدد</th>
          <th>السعر</th>
          <th>الخصم</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="total-section">
    <div class="total-card">
      <div class="total-row-flex"><span>إجمالي كمية المنتجات</span><strong dir="ltr" lang="en">${lines.reduce((sum, l) => sum + (l.qty || 0), 0)}</strong></div>
      ${printDiscount > 0 ? `
      <div class="total-row-flex"><span>المجموع قبل الخصم</span><span dir="ltr" lang="en">₪${printSubtotal.toFixed(2)}</span></div>
      <div class="total-row-flex" style="color: #059669;"><span>الخصم الإضافي</span><span dir="ltr" lang="en">-₪${printDiscount.toFixed(2)}</span></div>
      ` : ''}
      <div class="total-row-main"><span>${printDiscount > 0 ? 'المجموع النهائي' : 'المجموع الكلي'}</span><span dir="ltr" lang="en">₪${Number(totalAmount).toFixed(2)}</span></div>
    </div>
  </div>

  <button class="btn-print" onclick="window.print()">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
    طباعة / حفظ PDF
  </button>
</div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 800); };
  </script>
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
          ? `<div class="inv-img"><img src="${safeSrc(imgSrc)}" alt="" loading="lazy" /></div>`
          : '<div class="inv-img"><span class="inv-no-img">📦</span></div>';
        const name = (o.customName || o.item?.group || o.item?.name || '').replace(/</g, '&lt;');
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
body{font-family:'DM Sans',system-ui,sans-serif;padding:28px;max-width:720px;margin:0 auto;background:linear-gradient(160deg,#f8faff 0%,#f1f5f9 50%,#e2e8f0 100%);min-height:100svh}
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
@media print{body{background:#fff;padding:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.inv-wrap{box-shadow:none;border:1px solid #e2e8f0}.btn-print,.btn-save-order{display:none}.inv-card:hover{box-shadow:none}.inv-total-card{page-break-inside:avoid;break-inside:avoid;border-color:#000;background:transparent!important;color:#000}.inv-header{background:transparent!important;color:#000;border:2px solid #000;box-shadow:none}}
</style></head><body>
<div class="inv-wrap">
  <div class="inv-header"><h1 class="inv-title">Order Summary</h1><p class="inv-sub">Products · Images · Details</p></div>
  <div class="inv-info"><span>العميل:</span> ${cust} &nbsp;|&nbsp; <span>الهاتف:</span> <span dir="ltr" lang="en">${(orderInfo.phone || '—').replace(/</g, '&lt;')}</span> &nbsp;|&nbsp; <span>التاريخ:</span> <span dir="ltr" lang="en">${date}</span>${paymentInfo}</div>
  <div class="inv-cards">${cards}</div>
  <div class="inv-total-card"><span>المجموع</span><span dir="ltr" lang="en">₪${orderTotal.toFixed(2)}</span></div>
  <button class="btn-print" onclick="window.print()">طباعة / حفظ PDF</button>
</div></body></html>`;
  }, [orderLines, orderTotal, orderInfo]);

  const openOrderPdfInNewTab = () => {
    if (orderLines.length === 0) {
      alert('السلة فارغة. أضف منتجات أولاً.');
      return;
    }
    try {
      const html = getPrintHtml();
      if (!html || html.length < 100) {
        alert('تعذر إنشاء محتوى الفاتورة. تأكد من وجود أصناف في الطلبية.');
        return;
      }
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setPdfPreviewBlobUrl(url);
      setShowPdfPreviewModal(true);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ عند إنشاء المعاينة: ' + (e.message || e));
    }
  };

  const closePdfPreviewModal = () => {
    if (pdfPreviewBlobUrl) {
      URL.revokeObjectURL(pdfPreviewBlobUrl);
      setPdfPreviewBlobUrl(null);
    }
    setShowPdfPreviewModal(false);
  };

  const handlePrintOrder = openOrderPdfInNewTab;
  const handleOpenPdfOrder = openOrderPdfInNewTab;

  const validateOrderInfo = (info = orderInfo) => {
    if (!info.companyName?.trim()) return 'يرجى إدخال اسم الشركة (المشتري).';
    if (!info.merchantName?.trim()) return 'يرجى إدخال اسم التاجر (المشتري).';
    if (!info.phone?.trim()) return 'يرجى إدخال رقم الهاتف.';
    if (!info.address?.trim()) return 'يرجى إدخال العنوان.';
    if (!info.orderDate) return 'يرجى إدخال التاريخ.';

    return null;
  };

  const validateOrder = () => validateOrderInfo(orderInfo);

  const saveOrderToSupabase = async (infoParam = orderInfo) => {
    const info = infoParam;
    const orderData = {
      prepared_by: userRole === 'customer' ? 'sale' : userRole,
      customer_name: info.companyName,
      customer_phone: info.phone,
      customer_address: info.address,
      customer_number: info.customerNumber,
      order_date: info.orderDate,
      total_amount: orderTotal,
      items: orderLines.map(line => ({
        barcode: line.item.barcode,
        name: line.customName || line.item.name || line.item.group,
        product_type: line.item?.productType || null,
        group: line.item?.group || null,
        qty: line.qty,
        consumer_price: Number(line.item?.price) ?? 0,
        discount_percent: getLineDiscountPercent(line),
        unit_price: getLineUnitPrice(line),
        price: getLineUnitPrice(line),
        total: getLineTotal(line)
      })),
      details: info
    };

    // أوفلاين: حفظ محلياً فوراً ومزامنة لاحقاً عند عودة الاتصال
    if (!isOnline) {
      try {
        await addToSyncQueue(orderData);
        setPendingSyncCount(prev => prev + 1);
        alert('🌐 لا يوجد اتصال بالإنترنت. تم حفظ الطلب محلياً وستتم المزامنة تلقائياً فور عودة الاتصال.');
        return true;
      } catch (idbErr) {
        console.error('Failed to save order offline:', idbErr);
        alert('تعذر حفظ الطلب محلياً. جرّب مرة أخرى أو تحقق من الاتصال.');
        return false;
      }
    }

    try {
      const { data: insertedOrder, error } = await supabase.from('orders').insert([orderData]).select('id').single();
      if (error) throw error;
      const newOrderId = insertedOrder?.id ?? null;

      // Update Customer Loyalty Points and Total Spent automatically
      if (info.phone) {
        try {
          const pointsEarned = Math.floor(orderTotal / 100); // 1 point per 100 ILS

          // Check if customer exists
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', info.phone)
            .single();

          if (existingCustomer) {
            await supabase.from('customers').update({
              name: info.merchantName || info.companyName || '',
              company_name: info.companyName || '',
              address: info.address || '',
              customer_number: info.customerNumber || '',
              total_spent: Number(existingCustomer.total_spent || 0) + Number(orderTotal),
              loyalty_points: Number(existingCustomer.loyalty_points || 0) + pointsEarned,
              last_order_date: new Date().toISOString()
            }).eq('phone', info.phone);
          } else {
            await supabase.from('customers').insert([{
              phone: info.phone,
              name: info.merchantName || info.companyName || '',
              company_name: info.companyName || '',
              address: info.address || '',
              customer_number: info.customerNumber || '',
              total_spent: orderTotal,
              loyalty_points: pointsEarned,
              last_order_date: new Date().toISOString()
            }]);
          }
        } catch (custErr) {
          console.warn('Failed to update customer points:', custErr);
        }
      }

      if (newOrderId) {
        await applyCreditAfterOrder(orderData, newOrderId);
      }

      alert('Order submitted successfully space to supervisor!');
      fetchCustomers(); // Refresh the autocomplete dropdown
      return true;
    } catch (err) {
      console.warn('Error saving order online, queueing offline:', err);
      try {
        await addToSyncQueue(orderData);
        setPendingSyncCount(prev => prev + 1);
        alert('🌐 لا يوجد اتصال بالإنترنت. تم حفظ الطلب محلياً وستتم المزامنة تلقائياً فور عودة الاتصال.');
        return true; // Return true to allow PDF/Excel generation to continue offline
      } catch (idbErr) {
        console.error('Failed to save order offline:', idbErr);
        alert('Note: Invoice failed to save locally or online. (Database error: ' + idbErr.message + ')');
        return false;
      }
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
      discountType: '',
      discountValue: '',
      email: '',
      notes: '',
    });
    setCustomerInsights(null);
    setInsightsPhone(null);
    setCustomerSearch('');
  };

  const handleHoldOrder = () => {
    if (orderItems.length === 0) {
      alert('السلة فارغة. أضف منتجات أولاً قبل التعليق.');
      return;
    }

    const newHeldOrder = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      orderItems: [...orderItems],
      orderInfo: { ...orderInfo },
      totalItems: orderLines.length,
      totalAmount: orderTotal
    };

    setHeldOrders(prev => [newHeldOrder, ...prev]);
    clearOrderAndInfo();
  };

  const handleRestoreHeldOrder = (heldOrder) => {
    if (orderItems.length > 0) {
      if (!confirm('السلة الحالية تحتوي على منتجات. هل أنت متأكد من استعادة هذه الفاتورة ومسح السلة الحالية؟ (يمكنك تعليق الحالية أولاً)')) {
        return;
      }
    }
    setOrderItems(heldOrder.orderItems);
    setOrderInfo(heldOrder.orderInfo);
    setHeldOrders(prev => prev.filter(o => o.id !== heldOrder.id));
    setShowHeldOrdersModal(false);
  };

  const handleRemoveHeldOrder = (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة المعلقة نهائياً؟')) return;
    setHeldOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleSaveInvoice = async (infoOverride) => {
    // If this is an existing approved order (any role), skip re-inserting and just export
    if (currentOrderId) {
      await handleExportExcel(true, infoOverride || orderInfo);
      clearOrderAndInfo();
      return;
    }

    const info = infoOverride || orderInfo;
    const error = validateOrderInfo(info);
    if (error) {
      alert(error + '\nPlease fill in all required customer details.');
      if (orderLines.length > 0) setShowOrderSubmitModal(true);
      return;
    }

    if (infoOverride) {
      flushSync(() => {
        setOrderInfo((prev) => ({ ...prev, ...info }));
      });
    }

    const saved = await saveOrderToSupabase(info);
    if (!saved) return;

    playCheckout(); // UI Sound Palette: إتمام البيع — شعور إنجاز للموظف

    // Trigger PDF Export download
    const html = getPrintHtml(undefined, info);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${(info.companyName || info.merchantName || 'Order').replace(/[/\\:*?"<>|]/g, '')}-${info.orderDate || new Date().toISOString().slice(0, 10)}.pdf.html`;

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

    // Also trigger Excel export
    await handleExportExcel(true, info); // pass true flag to skip saving again inside

    clearOrderAndInfo();
  };

  const handleOpenSaveExportModal = useCallback(() => {
    // If processing an existing approved order, export directly without showing the submit modal
    if (currentOrderId) {
      handleSaveInvoice();
      return;
    }
    if (orderLines.length === 0) {
      alert('السلة فارغة. أضف منتجات أولاً قبل التصدير.');
      return;
    }
    setShowOrderSubmitModal(true);
  }, [currentOrderId, orderLines.length]);

  const handleConfirmOrderSubmitModal = useCallback(() => {
    const err = validateOrderInfo(orderInfo);
    if (err) {
      alert(err);
      return;
    }
    const merged = {
      ...orderInfo,
      address: (orderInfo.address || '').trim() || '—',
      orderDate: orderInfo.orderDate || new Date().toISOString().slice(0, 10),
    };
    setShowOrderSubmitModal(false);
    handleSaveInvoice(merged);
  }, [orderInfo]);

  /** نفس تنسيق Excel عند إتمام الطلب من شاشة المبيعات (تفاصيل الطلبية + معلومات العميل + جدول الأصناف الكامل) */
  const downloadFormattedSalesOrderExcel = useCallback(async (info, lines, total, fileNameOverride) => {
    const ExcelJS = (await import('exceljs')).default;
    const excelText = (text) => (text != null && typeof text !== 'string' ? String(text) : (text || ''));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sales Order', {
      views: [{ rightToLeft: false, showGridLines: false }],
    });
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
      const baseAlignment = { readingOrder: 1, wrapText: true };
      cell.alignment = opts.alignment ? { ...baseAlignment, ...opts.alignment } : baseAlignment;
      border(cell);
    };
    ws.addRow(['تفاصيل الطلبية']);
    ws.getCell(1, 1).font = { bold: true, size: 20, color: { argb: colors.white } };
    ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 1 };
    ws.mergeCells(1, 1, 1, 9);
    ws.getRow(1).height = 36;
    let r = 3;
    ws.getCell(r, 1).value = excelText('معلومات العميل');
    ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: colors.primary } };
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    ws.mergeCells(r, 1, r, 9);
    ws.getCell(r, 1).alignment = { horizontal: 'right', readingOrder: 1 };
    border(ws.getCell(r, 1));
    r++;
    const excelInfoRows = [
      ['اسم العميل', info.companyName],
      ['التاجر', info.merchantName],
      ['رقم العميل', info.customerNumber],
      ['رقم الهاتف', info.phone],
      ['العنوان', info.address],
      ['التاريخ', info.orderDate],
      ['طريقة الدفع', info.paymentMethod],
      ...(info.paymentMethod === 'Checks' && info.checksCount ? [['عدد الشيكات', info.checksCount]] : []),
      ...(info.email ? [['البريد الإلكتروني', info.email]] : []),
      ...(info.notes ? [['ملاحظات', info.notes]] : []),
    ];
    excelInfoRows.forEach(([l, v], i) => {
      ws.getCell(r, 9).value = excelText(l || '');
      ws.getCell(r, 1).value = excelText(v || '');
      ws.mergeCells(r, 1, r, 8);
      styleCell(ws.getCell(r, 9), { fill: i % 2 === 0 ? colors.light : colors.lightAlt, font: { bold: true, color: { argb: colors.textDark } }, alignment: { horizontal: 'right' } });
      styleCell(ws.getCell(r, 1), { fill: colors.white, font: { color: { argb: colors.textDark } }, alignment: { horizontal: 'right' } });
      r++;
    });
    r += 1;
    ws.getCell(r, 1).value = excelText('بيانات الأصناف');
    ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: colors.primary } };
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    ws.mergeCells(r, 1, r, 9);
    ws.getCell(r, 1).alignment = { horizontal: 'right', readingOrder: 1 };
    border(ws.getCell(r, 1));
    r++;
    const headers = ['الباركود', 'الصنف', 'المجموعة', 'الكمية', 'السعر', 'السعر بعد الخصم', 'الخصم', 'المجموع'];
    headers.forEach((h, c) => {
      ws.getCell(r, c + 1).value = excelText(h);
      const isArabicCol = c <= 2;
      styleCell(ws.getCell(r, c + 1), { fill: colors.primary, font: { bold: true, color: { argb: colors.white }, size: 11 }, alignment: { horizontal: isArabicCol ? 'right' : 'center', vertical: 'middle', readingOrder: 1 } });
    });
    ws.getRow(r).height = 24;
    r++;
    const sortedLines = sortByBarcodeOrder(lines, BARCODE_ORDER);
    const discountPalette = ['FFE8F5E9', 'FFE3F2FD', 'FFFFF8E1', 'FFF3E5F5', 'FFFFEBEE', 'FFE0F2F1', 'FFFCE4EC', 'FFEFEBE9'];
    const uniqueDiscPcts = [...new Set(sortedLines.map((o) => getLineDiscountPercent(o)))].sort((a, b) => a - b);
    const discPctToColor = {};
    uniqueDiscPcts.forEach((pct, i) => {
      discPctToColor[pct] = discountPalette[i % discountPalette.length];
    });
    sortedLines.forEach((o, i) => {
      const discPct = getLineDiscountPercent(o);
      const barcodeToLookup = o.barcode || o.item?.barcode || '';
      const liveItem = barcodeToLookup ? items.find((it) => barcodesMatch(it.barcode, barcodeToLookup)) : null;

      const prodType = (o.product_type || o.item?.productType || liveItem?.productType || '');
      const rawName = (o.item?.name || o.customName || o.name || o.item?.group || o.group || '').slice(0, 50);

      ws.getCell(r, 1).value = excelText(barcodeToLookup);
      ws.getCell(r, 2).value = excelText(prodType ? prodType : rawName);
      ws.getCell(r, 3).value = excelText(o.item?.group || '');
      ws.getCell(r, 4).value = o.qty;
      ws.getCell(r, 5).value = Number(o.item?.price) ?? 0;
      ws.getCell(r, 6).value = getLineUnitPrice(o);
      ws.getCell(r, 7).value = discPct > 0 ? discPct + '%' : '—';
      ws.getCell(r, 8).value = parseFloat(getLineTotal(o).toFixed(2));
      const rowFill = i % 2 === 0 ? colors.white : 'FFF8fafc';
      const discountCellFill = discPct > 0 ? (discPctToColor[discPct] || rowFill) : rowFill;
      for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(r, c);
        const fill = c === 7 ? discountCellFill : rowFill;
        styleCell(cell, {
          fill,
          font: c === 8 ? { bold: true, color: { argb: colors.primary } } : { color: { argb: colors.textDark } },
          alignment: c <= 3 ? { horizontal: 'right' } : { horizontal: 'center' },
        });
      }
      r++;
    });
    ws.getCell(r, 1).value = '';

    const exportSubtotal = sortedLines.reduce((s, o) => s + getLineTotal(o), 0);
    const exportDiscVal = Number(info.discountValue) || 0;
    let exportDiscount = 0;
    if (info.discountType === 'percentage' && exportDiscVal > 0) {
      exportDiscount = exportSubtotal * (exportDiscVal / 100);
    } else if (info.discountType === 'amount' && exportDiscVal > 0) {
      exportDiscount = exportDiscVal;
    }

    if (exportDiscount > 0) {
      ws.getCell(r, 6).value = excelText('المجموع قبل الخصم');
      ws.getCell(r, 8).value = parseFloat(exportSubtotal.toFixed(2));
      for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(r, c);
        styleCell(cell, {
          fill: colors.light,
          font: c >= 6 ? { color: { argb: colors.textDark } } : {},
          alignment: c === 6 ? { horizontal: 'right', readingOrder: 1 } : c === 8 ? { horizontal: 'center' } : {},
        });
      }
      r++;

      ws.getCell(r, 6).value = excelText('الخصم الإضافي');
      ws.getCell(r, 8).value = parseFloat((-exportDiscount).toFixed(2));
      for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(r, c);
        styleCell(cell, {
          fill: colors.light,
          font: c >= 6 ? { color: { argb: colors.successText } } : {},
          alignment: c === 6 ? { horizontal: 'right', readingOrder: 1 } : c === 8 ? { horizontal: 'center' } : {},
        });
      }
      r++;
    }

    ws.getCell(r, 6).value = excelText(exportDiscount > 0 ? 'المجموع النهائي' : 'المجموع الكلي');
    ws.getCell(r, 8).value = parseFloat(Number(total).toFixed(2));
    for (let c = 1; c <= 8; c++) {
      const cell = ws.getCell(r, c);
      styleCell(cell, {
        fill: colors.light,
        font: c >= 6 ? { bold: true, size: 12, color: { argb: colors.primary } } : {},
        alignment: c === 6 ? { horizontal: 'right', readingOrder: 1 } : c === 8 ? { horizontal: 'center' } : {},
      });
    }
    ws.getRow(r).height = 28;
    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 8;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 12;
    ws.getColumn(8).width = 12;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameOverride || `Order-${(info.companyName || info.merchantName || 'Order').replace(/[/\\:*?"<>|]/g, '')}-${info.orderDate || new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const handleExportExcel = useCallback(async (skipSave = false, infoOverride) => {
    const info = infoOverride || orderInfo;
    const error = validateOrderInfo(info);
    if (error) {
      if (!skipSave) { // Only alert if NOT part of combined save
        alert(error + '\nPlease fill in all required customer details.');
        if (orderLines.length > 0) setShowOrderSubmitModal(true);
      }
      return;
    }

    let saved = skipSave ? true : false;
    // If an existing order ID is set, we're processing an already-saved order — skip re-insert
    const isSupervisorProcessing = !!currentOrderId;

    if (!skipSave) {
      if (isSupervisorProcessing) {
        saved = true; // Order already exists in DB, no re-insert needed
      } else {
        saved = await saveOrderToSupabase(info);
      }
    }

    if (!saved && !isSupervisorProcessing) return;

    await downloadFormattedSalesOrderExcel(info, orderLines, orderTotal);

    // Keep the order in the database as 'completed' (don't delete it)
    if (isSupervisorProcessing) {
      try {
        const { data: markRows, error: markErr } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', currentOrderId)
          .select('id');
        if (markErr) {
          console.error('mark order completed:', markErr);
          alert('تعذر حفظ حالة الطلب في قاعدة البيانات: ' + (markErr.message || markErr));
        } else if (!markRows?.length) {
          alert(
            'لم يُحدَّث الطلب في قاعدة البيانات. تحقق من سياسة UPDATE على جدول orders (ORDERS_SUPABASE.md).',
          );
        }
      } catch (err) {
        console.error('Error marking order completed:', err);
        alert('خطأ أثناء تحديث الطلب: ' + (err?.message || err));
      }
      setCurrentOrderId(null);
    } else if (saved) {
      clearOrderAndInfo();
    }
  }, [orderLines, orderTotal, orderInfo, currentOrderId, userRole, items, downloadFormattedSalesOrderExcel]);

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
      product_type: '',
      box_count: '',
      full_price: '',
      price_after_disc: '',
      stock_count: '',
      image_url: '',
      visible: true,
      is_offer: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    if (!item) return;
    if (userRole !== 'admin') return;
    setEditingItem(item);
    const stockVal = item.stock;
    const stockDisplay = (stockVal != null && stockVal !== '') ? stockVal : 0;
    setFormData({
      barcode: item.barcode || '',
      brand_group: item.group || '',
      eng_name: item.name || '',
      product_type: item.productType || '',
      box_count: item.box ?? '',
      full_price: item.price ?? '',
      price_after_disc: item.priceAfterDiscount ?? '',
      stock_count: stockDisplay,
      image_url: item.image || '',
      visible: item.visible !== false,
      is_offer: !!item.isOffer,
    });
    setSelectedItem(null);
    setModalOpen(true);
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

  const persistProduct = async (payload, editCtx) => {
    if (editCtx) {
      const { error } = await supabase.from('items').update(payload).eq('barcode', editCtx.barcode);
      if (error) throw error;
      const uname = username || localStorage.getItem('sales_username') || 'unknown';
      const barcodeId = editCtx.barcode;
      const fields = [
        { key: 'full_price', old: editCtx.price, new: payload.full_price, label: 'السعر' },
        { key: 'price_after_disc', old: editCtx.priceAfterDiscount, new: payload.price_after_disc, label: 'سعر بعد الخصم' },
        { key: 'stock_count', old: editCtx.stock_count ?? editCtx.stock, new: payload.stock_count, label: 'الكمية' },
        { key: 'eng_name', old: editCtx.name, new: payload.eng_name, label: 'الاسم' },
        { key: 'brand_group', old: editCtx.group, new: payload.brand_group, label: 'الفئة' },
        { key: 'is_offer', old: editCtx.isOffer, new: payload.is_offer, label: 'العرض الخاص' },
      ];
      for (const f of fields) {
        const ov = f.old != null ? String(f.old) : '';
        const nv = f.new != null ? String(f.new) : '';
        if (ov !== nv) {
          await logActivityToSupabase({ username: uname, entity_id: barcodeId, field_name: f.key, old_value: ov, new_value: nv, description: `${f.label}: ${ov} → ${nv}` });
        }
      }
      fetchActivityLogs();
    } else {
      const { error } = await supabase.from('items').insert(payload);
      if (error) throw error;
    }
    setModalOpen(false);
    setShowCatalogPanel(false);
    queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (userRole !== 'admin') return;
    try {
      const payload = {
        barcode: formData.barcode.trim(),
        brand_group: formData.brand_group.trim() || null,
        eng_name: formData.eng_name.trim() || null,
        product_type: formData.product_type.trim() || null,
        box_count: formData.box_count ? parseInt(formData.box_count, 10) : null,
        full_price: formData.full_price ? parseFloat(formData.full_price) : null,
        price_after_disc: formData.price_after_disc
          ? parseFloat(formData.price_after_disc)
          : null,
        stock_count: (() => {
          const v = formData.stock_count;
          if (v === '' || v == null) return null;
          const n = parseInt(String(v), 10);
          return isNaN(n) || n < 0 ? null : Math.round(n);
        })(),
        image_url: formData.image_url.trim() || null,
        visible: formData.visible !== false,
        is_offer: !!formData.is_offer,
      };
      const stockMissingOrZero = payload.stock_count === null || payload.stock_count === 0;
      if (stockMissingOrZero) {
        setStockZeroPending({ payload, editCtx: editingItem });
        setShowStockZeroConfirm(true);
        return;
      }
      await persistProduct(payload, editingItem);
    } catch (err) {
      alert(err.message || 'Save failed');
    }
  };

  const confirmStockZeroSave = async () => {
    const pending = stockZeroPending;
    setShowStockZeroConfirm(false);
    setStockZeroPending(null);
    if (!pending) return;
    try {
      await persistProduct(pending.payload, pending.editCtx);
    } catch (err) {
      alert(err.message || 'Save failed');
    }
  };

  const cancelStockZeroConfirm = () => {
    setShowStockZeroConfirm(false);
    setStockZeroPending(null);
  };

  useEffect(() => {
    if (!modalOpen) {
      setShowStockZeroConfirm(false);
      setStockZeroPending(null);
    }
  }, [modalOpen]);

  const openEditPanelFromBarcode = useCallback((barcodeStr) => {
    const code = normalizeBarcodeForLookup(barcodeStr);
    if (!code) return;
    const item = items.find((i) => barcodesMatch(i.barcode, code));
    if (item) {
      setEditingItem(item);
      const stockVal = item.stock;
      const stockDisplay = (stockVal != null && stockVal !== '') ? stockVal : 0;
      setFormData({
        barcode: item.barcode || '',
        brand_group: item.group || '',
        eng_name: item.name || '',
        product_type: item.productType || '',
        box_count: item.box ?? '',
        full_price: item.price ?? '',
        price_after_disc: item.priceAfterDiscount ?? '',
        stock_count: stockDisplay,
        image_url: item.image || '',
        visible: item.visible !== false,
        is_offer: !!item.isOffer,
      });
      setShowCatalogPanel(true);
      if (inventoryBarcodeScanRef.current) inventoryBarcodeScanRef.current.value = '';
    } else {
      playError(); // UI Sound Palette: باركود غير صحيح
      alert('لم يُعثر على صنف بالباركود: ' + code);
    }
  }, [items, playError]);

  const handleExportInventory = useCallback(async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('المخزون', { views: [{ rightToLeft: true }] });
      const sorted = [...(filteredInventoryItems || [])].sort((a, b) => {
        const gA = (a.group || '').trim();
        const gB = (b.group || '').trim();
        if (gA !== gB) return gA.localeCompare(gB, 'ar');
        return String(a.barcode || '').localeCompare(String(b.barcode || ''), 'en');
      });
      const rows = [
        ['الباركود', 'الاسم', 'الفئة', 'الكمية', 'السعر', 'الحالة'],
        ...sorted.map((i) => {
          const qty = Number(i.stock_count ?? i.stock ?? 0);
          const status = qty === 0 ? 'نفد' : qty <= 10 ? 'منخفض' : 'متوفر';
          return [i.barcode || '', i.name || '', i.group || '', qty, Math.round(i.priceAfterDiscount ?? i.price ?? 0), status];
        }),
      ];
      ws.addRows(rows);
      ws.getRow(1).font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('handleExportInventory:', err);
      alert('فشل التصدير: ' + (err?.message || err));
    }
  }, [filteredInventoryItems]);

  /** مزامنة المخزون من Google Sheet → Supabase مباشرة من الواجهة */
  const [syncingStock, setSyncingStock] = useState(false);
  const handleSyncStockFromSheet = useCallback(async () => {
    const SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_EXPORT_URL || 'https://docs.google.com/spreadsheets/d/1RNk812KPn54ZuUYQToSN2Vfm4JTtd1Rz1-Lig7j3JVw/export?format=xlsx&gid=1316215926';
    if (!confirm('سيتم تحديث المخزون في Supabase من Google Sheet. هل أنت متأكد؟')) return;
    setSyncingStock(true);
    try {
      // تحميل الجدول
      const res = await fetch(SHEET_URL, { redirect: 'follow' });
      if (!res.ok) throw new Error(`فشل تحميل الجدول: HTTP ${res.status}`);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const buf = await res.arrayBuffer();
      // تحقق أنه ليس HTML
      const sample = new TextDecoder().decode(buf.slice(0, 200)).trimStart();
      if (sample.startsWith('<!') || sample.toLowerCase().startsWith('<html')) {
        throw new Error('الجدول يعيد HTML. تأكد من مشاركة الجدول للعموم (أي شخص لديه الرابط).');
      }
      const XLSX = (await import('xlsx')).default || (await import('xlsx'));
      const wb = XLSX.read(buf, { type: 'array' });

      // قراءة الباركودات والمخزون
      const BARCODE_KEYS = ['barcode', 'الباركود', 'باركود', 'code', 'كود'];
      const STOCK_KEYS   = ['stock', 'المخزون', 'الكمية المخزنة', 'inventory', 'qty stock', 'الكمية', 'qty', 'quantity', 'count'];
      function findColIdx(header, keys) {
        for (let i = 0; i < header.length; i++) {
          const h = String(header[i] ?? '').toLowerCase().trim();
          if (keys.some(k => h === k || h.includes(k.split(' ')[0]))) return i;
        }
        return -1;
      }
      function toNum(v) {
        if (v == null || v === '') return 0;
        const n = Number(String(v).replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? 0 : Math.max(0, Math.round(n));
      }
      function canon(s) {
        if (!s) return '';
        let x = String(s).trim().replace(/\s/g, '');
        if (/^\d+$/.test(x)) x = x.replace(/^0+/, '') || '0';
        return x;
      }

      const stockMap = {};
      let sheetFound = false;
      for (const sheetName of (wb.SheetNames || [])) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        if (!rows || rows.length < 2) continue;
        const header = rows[0];
        const bIdx = findColIdx(header, BARCODE_KEYS);
        const sIdx = findColIdx(header, STOCK_KEYS);
        if (bIdx < 0 || sIdx < 0) continue;
        sheetFound = true;
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const rawBc = String(row[bIdx] ?? '').trim();
          if (!rawBc) continue;
          const bc = canon(rawBc);
          const stock = toNum(row[sIdx]);
          if (bc) stockMap[bc] = stock;
          if (rawBc !== bc) stockMap[rawBc.replace(/\s/g, '')] = stock;
        }
      }
      if (!sheetFound) throw new Error('لم يُعثر على أعمدة البـاركود والمخزون في الجدول. تأكد من أسماء الأعمدة.');

      // جلب الأصناف من Supabase
      let allItems = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from('items').select('barcode, stock_count').range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allItems = allItems.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // حساب التغييرات
      const toUpdate = [];
      for (const item of allItems) {
        const rawBc = String(item.barcode || '').trim();
        const bc = canon(rawBc);
        const newStock = stockMap[rawBc] ?? stockMap[bc] ?? stockMap[rawBc.replace(/\s/g, '')] ?? 0;
        const oldStock = item.stock_count ?? 0;
        if (newStock !== oldStock) toUpdate.push({ barcode: rawBc, newStock });
      }

      if (toUpdate.length === 0) {
        alert('✅ المخزون محدّث بالفعل — لا توجد تغييرات.');
        setSyncingStock(false);
        return;
      }

      // تحديث Supabase على دفعات
      const BATCH = 50;
      let updated = 0;
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const batch = toUpdate.slice(i, i + BATCH);
        // جمّع حسب القيمة
        const byStock = {};
        for (const { barcode, newStock } of batch) {
          const k = String(newStock);
          if (!byStock[k]) byStock[k] = { stock: newStock, barcodes: [] };
          byStock[k].barcodes.push(barcode);
        }
        for (const { stock, barcodes } of Object.values(byStock)) {
          const { error } = await supabase.from('items').update({ stock_count: stock }).in('barcode', barcodes);
          if (error) throw error;
          updated += barcodes.length;
        }
      }

      alert(`✅ تم تحديث مخزون ${updated} صنف بنجاح من Google Sheet!`);
      itemsQuery.refetch(); // تحديث واجهة React Query
    } catch (err) {
      alert('❌ خطأ: ' + (err?.message || err));
    } finally {
      setSyncingStock(false);
    }
  }, [supabase, itemsQuery]);

  /** تصدير تقرير المخزون من صفحة التقارير (قائمة كاملة للتجرد) — Excel مرتب حسب الفئة ثم الباركود */
  const handleExportReportInventory = useCallback(async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('تقرير المخزون للتجرد', { views: [{ rightToLeft: true }] });
      const sorted = [...(items || [])].sort((a, b) => {
        const gA = (a.group || '').trim();
        const gB = (b.group || '').trim();
        if (gA !== gB) return gA.localeCompare(gB, 'ar');
        return String(a.barcode || '').localeCompare(String(b.barcode || ''), 'en');
      });
      const rows = [
        ['الباركود', 'الاسم', 'الفئة', 'الكمية', 'السعر', 'الحالة'],
        ...sorted.map((i) => {
          const qty = Number(i.stock_count ?? i.stock ?? 0);
          const status = qty === 0 ? 'نفد' : qty <= 5 ? 'أوشك على النفاد' : 'متوفر';
          return [i.barcode || '', i.name || '', i.group || '', qty, Math.round(i.priceAfterDiscount ?? i.price ?? 0), status];
        }),
      ];
      ws.addRows(rows);
      ws.getRow(1).font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_المخزون_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('handleExportReportInventory:', err);
      alert('فشل التصدير: ' + (err?.message || err));
    }
  }, [items]);

  /** طباعة تقرير المخزون (PDF عبر حفظ كـ PDF من نافذة الطباعة) */
  const handlePrintReportInventory = useCallback(() => {
    const list = (items || []).map((i) => {
      const qty = Number(i.stock_count ?? i.stock ?? 0);
      const status = qty === 0 ? 'نفد' : qty <= 5 ? 'أوشك على النفاد' : 'متوفر';
      return { barcode: i.barcode || '', name: i.name || '', group: i.group || '', qty, price: Math.round(i.priceAfterDiscount ?? i.price ?? 0), status };
    });
    const rowsHtml = list.map((r) => {
      const rowClass = r.status === 'نفد' ? 'bg-red-100 text-red-800' : r.status === 'أوشك على النفاد' ? 'bg-amber-50 text-amber-800' : '';
      return `<tr class="${rowClass}"><td class="border px-2 py-1">${String(r.barcode)}</td><td class="border px-2 py-1">${String(r.name).replace(/</g, '&lt;')}</td><td class="border px-2 py-1">${String(r.group)}</td><td class="border px-2 py-1 font-bold">${r.qty}</td><td class="border px-2 py-1">₪${r.price}</td><td class="border px-2 py-1 font-semibold">${r.status}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير المخزون للتجرد</title>
<style>body{font-family:Segoe UI,sans-serif;padding:16px;max-width:900px;margin:0 auto}.header{text-align:center;margin-bottom:20px;font-size:18px;font-weight:bold}table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#fff;padding:8px;text-align:right}@media print{body{padding:0}.no-print{display:none}}</style></head><body>
<div class="header">تقرير المخزون للتجرد — ${new Date().toLocaleDateString('ar-SA')}</div>
<table><thead><tr><th>الباركود</th><th>الاسم</th><th>الفئة</th><th>الكمية</th><th>السعر</th><th>الحالة</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<p class="no-print" style="margin-top:16px;font-size:12px;color:#64748b">اطبع هذه الصفحة (Ctrl+P) أو احفظ كـ PDF من نافذة الطباعة.</p>
<script>window.onload=function(){window.print();}</script></body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }, [items]);

  /** رابط صفحة المنتج للعميل (?barcode=) — نفس منطق لصاقة QR و CustomerProductView */
  const getProductPublicShareUrl = useCallback((item) => {
    if (!item?.barcode || typeof window === 'undefined') return '';
    const base = window.location.origin + (window.location.pathname || '/');
    return `${base}${base.endsWith('/') ? '' : ''}?barcode=${encodeURIComponent(String(item.barcode).trim())}`;
  }, []);

  const buildWhatsAppShareText = useCallback(
    (item) => {
      if (!item) return '';
      const url = getProductPublicShareUrl(item);
      const lines = [];
      const typeLine = (item.productType || '').trim();
      const nameLine = (item.name || '').trim();
      if (typeLine) lines.push(`📦 ${typeLine}`);
      if (nameLine && nameLine !== typeLine) lines.push(nameLine);
      if (!typeLine && nameLine) lines.push(`📦 ${nameLine}`);
      const price = Math.round(item.priceAfterDiscount ?? item.price ?? 0);
      const listPrice = item.price != null ? Math.round(item.price) : null;
      lines.push('');
      lines.push(`💰 السعر: ₪${price}`);
      if (listPrice != null && item.priceAfterDiscount != null && Number(item.priceAfterDiscount) < Number(item.price)) {
        lines.push(`🏷️ السعر قبل الخصم: ₪${listPrice}`);
      }
      if (item.group) lines.push(`📁 الفئة: ${item.group}`);
      if (item.barcode) lines.push(`🔢 الباركود: ${item.barcode}`);
      lines.push('');
      if (url) {
        lines.push('🔗 رابط المنتج:');
        lines.push(url);
      }
      return lines.join('\n').trim();
    },
    [getProductPublicShareUrl]
  );

  const copyWhatsAppMessage = useCallback(
    async (product) => {
      const text = buildWhatsAppShareText(product);
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        alert('تم نسخ تفاصيل المنتج.\nافتح واتساب والصق الرسالة في المحادثة.');
      } catch {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          alert('تم نسخ تفاصيل المنتج.\nافتح واتساب والصق الرسالة في المحادثة.');
        } catch {
          prompt('انسخ النص يدوياً:', text);
        }
      }
    },
    [buildWhatsAppShareText]
  );

  /** Open printable QR sticker for customer self-scan URL (?barcode=...) — تصميم لصاقة أنيق */
  const handlePrintQR = (item) => {
    if (!item?.barcode) return;
    const base = typeof window !== 'undefined' ? window.location.origin + (window.location.pathname || '/') : '';
    const productUrl = `${base}${base.endsWith('/') ? '' : ''}?barcode=${encodeURIComponent(String(item.barcode).trim())}`;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(productUrl)}`;
    const name = (item.name || item.eng_name || item.barcode || '').slice(0, 36);
    const barcodeStr = String(item.barcode || '').trim();
    const priceStr = item.priceAfterDiscount != null || item.price != null ? `₪${Math.round(item.priceAfterDiscount ?? item.price ?? 0)}` : '';
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>لصاقة - ${barcodeStr}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
    padding: 20px;
    min-height: 100vh;
    background: #f1f5f9;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
  }
  .sticker {
    width: 85mm;
    min-height: 65mm;
    background: #fff;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border: 1px solid #e2e8f0;
  }
  .sticker .qr-wrap {
    width: 140px;
    height: 140px;
    padding: 8px;
    background: #fff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
  }
  .sticker .qr-wrap img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .sticker .name {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
    line-height: 1.35;
    max-width: 100%;
    word-break: break-word;
  }
  .sticker .barcode {
    font-size: 12px;
    font-family: 'Consolas', 'Monaco', monospace;
    letter-spacing: 1px;
    color: #475569;
    font-weight: 600;
  }
  .sticker .price {
    font-size: 14px;
    font-weight: 800;
    color: #0f172a;
    background: #f8fafc;
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  .sticker .hint {
    font-size: 9px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .no-print { margin-top: 12px; font-size: 12px; color: #94a3b8; }
  @media print {
    body { background: #fff; padding: 0; }
    .sticker {
      box-shadow: none;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      page-break-inside: avoid;
    }
    .no-print { display: none !important; }
  }
</style></head><body>
  <div class="sticker">
    <span class="hint">مسح للتفاصيل</span>
    <div class="qr-wrap"><img src="${qrApi}" alt="QR" /></div>
    <span class="name">${name.replace(/</g, '&lt;').replace(/"/g, '&quot;')}</span>
    <span class="barcode">${barcodeStr.replace(/</g, '&lt;')}</span>
    ${priceStr ? `<span class="price">${priceStr.replace(/</g, '&lt;')}</span>` : ''}
  </div>
  <p class="no-print">اطبع (Ctrl+P) ثم قص اللصاقة وضَعها على الرف</p>
</body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      const a = document.createElement('a');
      a.href = productUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = productUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  const toggleVisibility = async (item) => {
    if (userRole !== 'admin') return;
    const nextVisible = !(item.visible !== false);
    try {
      const { error } = await supabase.from('items').update({ visible: nextVisible }).eq('barcode', item.barcode);
      if (error) throw error;
      setItems((prev) => prev.map((i) => (i.barcode === item.barcode ? { ...i, visible: nextVisible } : i)));
    } catch (err) {
      console.warn('toggleVisibility:', err);
      alert(err.message || 'Failed to update visibility. Add column: ALTER TABLE items ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE;');
    }
  };

  const toggleOffer = useCallback(async (item) => {
    if (userRole !== 'admin') return;
    const nextOffer = !item.isOffer;
    try {
      const { error } = await supabase.from('items').update({ is_offer: nextOffer }).eq('barcode', item.barcode);
      if (error) throw error;
      setItems((prev) => prev.map((i) => (i.barcode === item.barcode ? { ...i, isOffer: nextOffer } : i)));
    } catch (err) {
      console.warn('toggleOffer:', err);
      alert(err.message || 'Failed to update offer status.');
    }
  }, [userRole]);

  const fileInputRef = useRef(null);

  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height *= maxWidth / width));
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width *= maxHeight / height));
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                const compressedFile = new File([blob], newName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Canvas to Blob failed'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

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
      setUploading(true);

      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await compressImage(file, 800, 800, 0.8);
        } catch (compressionErr) {
          console.warn('Image compression failed, using original:', compressionErr);
        }
      }

      const ext = fileToUpload.name.split('.').pop() || 'jpg';
      const fileName = `${barcode}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, fileToUpload, {
          upsert: true,
          cacheControl: STORAGE_UPLOAD_CACHE_CONTROL,
        });
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

  const handleOpenQuantityModal = useCallback((item, event = null) => {
    if (event) setQuantityEventClick({ clientX: event.clientX, clientY: event.clientY });
    setQuantityItem(item);
    const boxCount = item.box ? parseInt(item.box) : 1;
    setQuantityValue(boxCount > 0 ? boxCount : 1);
    setShowQuantityModal(true);
  }, []);

  /**
   * مسح باركود من قارئ/موبايل مع «Append Enter» أو «Send Enter»:
   * يطابق الباركود بالكامل ويفتح نافذة الكمية دون الضغط على زر.
   */
  const handlePosCatalogSearchKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Enter') return;
      const raw = (search || '').trim();
      if (!raw) return;
      const q = toEnglishDigits(raw.replace(/\s/g, ''));
      if (!q) return;

      const item = items.find((i) => barcodesMatch(i.barcode, q));
      if (item) {
        e.preventDefault();
        if (userRole !== 'admin' && item.visible === false) {
          playError();
          return;
        }
        if (userRole !== 'admin' && !itemIsInStockForSale(item)) {
          playError();
          alert('المنتج غير متوفر في المخزون.');
          return;
        }
        handleOpenQuantityModal(item, null);
        setSearch('');
        setPage(0);
        return;
      }

      const digitsOnly = /^\d+$/.test(q);
      if (digitsOnly && q.length >= 4) {
        e.preventDefault();
        playError();
      }
    },
    [search, items, userRole, handleOpenQuantityModal, playError]
  );

  const handleConfirmQuantity = () => {
    if (!quantityItem || quantityValue <= 0) return;
    const stock = quantityItem.stock_count ?? quantityItem.stock;
    const stockNum = Number(stock);
    const isOutOfStock = stock != null && stock !== '' ? (isNaN(stockNum) || stockNum <= 0) : true;
    if (isOutOfStock) {
      playError();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 40, 80]); // اهتزاز أقوى على التابلت
      }
      alert('المنتج غير متوفر في المخزون (Out of Stock).');
      return;
    }
    addToOrder(quantityItem, quantityValue, quantityEventClick);
    playSuccess();
    setShowQuantityModal(false);
    setQuantityItem(null);
    setQuantityEventClick(null);
    setQuantityValue(1);
  };

  const getCatalogHtml = useCallback((items, showFinalPriceOnly = false) => {
    const cards = items.map(item => {
      const imgUrl = getPublicImageUrl(item.image, { thumb: true });
      const img = imgUrl
        ? `<div class="cat-img"><img src="${imgUrl}" alt="${item.name}" loading="lazy" /></div>`
        : `<div class="cat-img"><div class="cat-no-img">📦</div></div>`;

      const finalPrice = item.priceAfterDiscount && item.priceAfterDiscount < item.price
        ? item.priceAfterDiscount
        : item.price ?? 0;

      const priceHtml = showFinalPriceOnly
        ? `<div class="price-row"><span class="lbl">السعر:</span> <span class="val">₪${item.price ?? 0}</span></div>`
        : (item.priceAfterDiscount && item.priceAfterDiscount < item.price
          ? `<div class="price-row"><span class="lbl">Consumer:</span> <span class="val old">₪${item.price}</span></div>
                     <div class="price-row"><span class="lbl">Discount:</span> <span class="val new">₪${item.priceAfterDiscount}</span></div>`
          : `<div class="price-row"><span class="lbl">Price:</span> <span class="val">₪${item.price ?? 0}</span></div>`
        );

      return `
        <div class="cat-card">
          ${img}
          <div class="cat-info">
            ${item.productType ? `<div style="display:inline-block; background:#e0f2fe; color:#0284c7; padding:2px 8px; border-radius:6px; font-weight:800; font-size:0.75rem; margin-bottom:6px;">${item.productType}</div>` : ''}
            <div class="cat-name">${item.name}</div>
            <div class="cat-details">
              <span class="cat-group font-bold">${item.group || '—'}</span>
              <span class="cat-barcode">${item.barcode}</span>
            </div>
            <div class="cat-prices">
               ${priceHtml}
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
  <title>كتالوج المبيعات - Maslamani</title>
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
  .cat-name { font-weight: 700; font-size: 0.95rem; color: #1e293b; margin-bottom: 8px; line-height: 1.3; min-height: 2.6em; }
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
        <h3>المجموعة</h3>
        <h2>الكتالوج</h2>
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
    if (window.confirm('مسح جميع المنتجات من الكتالوج؟')) {
      setCatalogItems([]);
    }
  };

  const addAllToCatalog = (sourceItems) => {
    setCatalogItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const toAdd = sourceItems.filter(i => !existingIds.has(i.id));
      return [...prev, ...toAdd];
    });
    setShowCatalogPanel(true);
  };

  const handlePrintCatalog = useCallback(() => {
    if (catalogItems.length === 0) return;
    const html = getCatalogHtml(catalogItems, catalogShowFinalPriceOnly);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }, [catalogItems, catalogShowFinalPriceOnly, getCatalogHtml]);

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

  if (showSplash && mode !== 'dashboard_preview') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]">
        <div className="animate-pulse text-slate-400 text-sm font-medium">Loading…</div>
      </div>
    );
  }

  if ((!isAuthenticated || showLoginScreen) && mode !== 'dashboard_preview') {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]">
          <div className="animate-pulse text-slate-400 text-sm font-medium">Loading…</div>
        </div>
      }>
        <Login onLogin={handleLogin} onBiometricLogin={handleBiometricLogin} />
        {isAuthenticated && (
          <button onClick={() => setShowLoginScreen(false)} className="fixed top-6 left-6 z-[9999] bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl text-slate-700 shadow flex items-center gap-2 hover:bg-white transition-colors">
            العودة <ArrowLeft size={16} className="rotate-180" />
          </button>
        )}
      </Suspense>
    );
  }

  if (mode === 'dashboard_preview') {
    return (
      <div className="relative">
        <ElectroMartDashboard />
        <button 
          onClick={() => setMode('order')} 
          className="fixed bottom-6 left-6 z-[9999] bg-white hover:bg-indigo-50 text-black px-6 py-3 rounded-2xl text-sm font-black shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-3 border border-indigo-100"
        >
          <ArrowLeft size={18} className="rotate-180" />
          <span>الرجوع للنظام الأصلي</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <MeshBackground />
      {stockAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-red-600/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 pointer-events-auto shrink-0 border border-white/10" dir="rtl">
          <AlertOctagon size={22} className="shrink-0 animate-pulse text-red-200" />
          <span className="font-bold text-md whitespace-nowrap">{stockAlert}</span>
          <button onClick={() => setStockAlert('')} className="bg-black/20 hover:bg-black/30 p-1.5 rounded-full transition-colors shrink-0 mr-1"><X size={14} /></button>
        </div>
      )}
      <div
        className={`font-sans flex h-screen overflow-hidden transition-colors duration-500 ${(showOrderPanel || showCatalogPanel) ? 'flex-row min-h-0' : 'flex-col'} text-slate-800 bg-slate-50`}
      >
      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden transition-all duration-500 ${(showOrderPanel || showCatalogPanel) ? 'p-3 sm:p-4' : 'p-0 sm:p-0'}`}
      >
        <div className={`flex-1 min-h-0 flex flex-col overflow-hidden relative transition-all duration-500 ${(showOrderPanel || showCatalogPanel) ? 'rounded-3xl shadow-xl border shadow-xl' : ''} border-white/50 bg-white/40 shadow-xl shadow-slate-200/20`}>

          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setSidebarOpen(false)}
            mode={mode}
            setMode={setMode}
            userRole={userRole}
            handleLogout={handleLogout}
            username={username}
            badgeSubmitted={submittedOrders.length}
            badgeLowStock={lowStockCount}
            badgeHeld={heldOrders.length}
          />

          {/* Header: dir=ltr يحافظ على توزيع الشعار/الملف الشخصي (flex+justify-between) دون انعكاس بسبب RTL العام */}
          <header dir="ltr" className={`flex-shrink-0 z-30 transition-all duration-300 ${(showOrderPanel || showCatalogPanel) ? 'rounded-t-3xl pt-4 px-6 pb-2' : 'sticky top-0 px-6 py-4 backdrop-blur-xl border-b shadow-sm'} bg-white/70 border-slate-200/50`}>
            <div className="flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto w-full">
              <div className="flex items-center gap-4 shrink-0">
                {/* Full App Menu Toggle */}
                {(userRole === 'admin' || userRole === 'supervisor') && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 -ml-2 rounded-xl transition-colors text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  >
                    <Menu size={24} />
                  </button>
                )}

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${mode === 'catalog' ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-rose-500/30 rotate-3' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30 -rotate-3'}`}>
                  {mode === 'catalog' ? (
                    <Grid className="text-white drop-shadow-md" size={24} />
                  ) : (
                    <Package className="text-white drop-shadow-md" size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                     <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">Maslamani<span className="font-light">Sales</span></h1>
                    {isOnline ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" title="متصل بالإنترنت">
                        <Cloud size={12} className="fill-emerald-200" />
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700`}
                        title="أوفلاين — المنتجات من IndexedDB إن وُجدت؛ الطلبات تُحفظ محلياً وتُزامن عند عودة الإنترنت"
                      >
                        <CloudOff size={12} />
                      </div>
                    )}
                  </div>
                   <p className="text-sm font-extrabold tracking-tight mt-0.5 text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-slate-500">Prime Devices</p>
                   <p className="text-xs font-medium tracking-wide uppercase mt-0.5 text-slate-500">
                    {safeLocaleDate({ weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto shrink-0 relative" ref={profileMenuRef}>
                {username === 'mohammadalaker' || username === 'admin' || username === 'supervisor' ? (
                  <div
                    className="flex items-center gap-2 border p-1.5 pl-2 pr-4 rounded-full shadow-sm backdrop-blur-md transition-all cursor-pointer bg-white/60 border-slate-200/70 hover:shadow-md hover:bg-white/90"
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 flex items-center justify-center bg-slate-100 border-white shadow-sm">
                      <User className="w-6 h-6 mt-2 text-slate-400" />
                    </div>
                    <div className="hidden sm:flex flex-col items-start">
                       <span className="text-[13px] font-bold leading-tight text-slate-800">
                        {username === 'mohammadalaker' ? 'Mohammed Alaker' : username === 'admin' ? 'Administrator' : 'Supervisor'}
                        <span className="text-[9px] text-slate-400 font-normal ml-2">v1.1</span>
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                         <span className="text-[10px] uppercase font-bold tracking-wider leading-none text-slate-500">{userRole}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50"></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-row-reverse gap-2">
                    <div
                      className="flex items-center justify-center p-2 rounded-xl shadow-sm cursor-pointer transition-all bg-white/60 border border-slate-200/70 hover:bg-white/90"
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                    >
                      <User className="w-6 h-6 text-slate-500" />
                    </div>
                    {/* Admin Login Button */}
                    <button
                      onClick={() => setShowLoginScreen(true)}
                      className="flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 transition-all border border-transparent hover:border-indigo-100"
                      title="Admin Login"
                    >
                      <Lock size={18} />
                    </button>
                  </div>
                )}

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-16 left-0 sm:right-0 sm:left-auto mt-2 w-56 rounded-2xl shadow-2xl overflow-hidden z-50 text-right border backdrop-blur-xl bg-white border-slate-100"
                      dir="rtl"
                    >
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <p className="text-sm font-bold text-slate-800">{username}</p>
                        <p className="text-xs uppercase tracking-wider text-slate-500">{userRole}</p>
                      </div>

                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => { setShowProfileMenu(false); setMode('settings'); }}
                          className="w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors flex items-center gap-3"
                        >
                          <Settings size={18} />
                          إعدادات الحساب
                        </button>

                        {userRole === 'customer' && (
                          <button
                            onClick={() => { setShowProfileMenu(false); setMode('offers'); }}
                            className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-3 ${mode === 'offers' ? 'bg-amber-50 text-amber-700' : 'text-slate-700 hover:bg-slate-100 hover:text-amber-600'}`}
                          >
                            <Gift size={18} />
                            العروض
                            {customOffers.filter(o => o.items && o.items.length > 0 && o.showOnSalesScreen !== false).length > 0 && (
                              <span className="mr-auto px-2 py-0.5 rounded-lg text-xs bg-amber-200 text-amber-800 font-bold">
                                {customOffers.filter(o => o.items && o.items.length > 0 && o.showOnSalesScreen !== false).length}
                              </span>
                            )}
                          </button>
                        )}

                        {userRole === 'customer' && (
                          <button
                            onClick={() => { setShowProfileMenu(false); setMode('order'); }}
                            className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-3 ${mode === 'order' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'}`}
                          >
                            <Package size={18} />
                            البيع (وضع البيع)
                          </button>
                        )}

                        {(userRole === 'admin' || userRole === 'supervisor') && (
                          <>
                            <div className="h-px bg-slate-100 my-1 mx-2"></div>
                            <button
                              onClick={() => { setShowProfileMenu(false); window.print(); }}
                              className="w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors flex items-center gap-3"
                            >
                              <Printer size={18} />
                              طابعة الفواتير — طباعة الآن
                            </button>
                            <button
                              onClick={() => { setShowProfileMenu(false); queryClient.invalidateQueries({ queryKey: ['items'] }); }}
                              className="w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors flex items-center gap-3"
                            >
                              <RefreshCw size={18} />
                              تحديث المخزون
                            </button>
                          </>
                        )}

                        {(userRole === 'admin' || userRole === 'supervisor') && (
                          <>
                            <div className="h-px bg-slate-100 my-1 mx-2"></div>
                            <div className="px-3 py-1 text-xs font-bold text-slate-400 mb-1">تبديل الوضع</div>
                            <button
                              onClick={() => { setShowProfileMenu(false); setMode('order'); }}
                              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-3 ${mode === 'order' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'}`}
                            >
                              <ShoppingCart size={18} />
                              وضع البيع (POS)
                            </button>
                            <button
                              onClick={() => { setShowProfileMenu(false); setMode('dashboard'); }}
                              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-3 ${mode === 'dashboard' ? 'bg-amber-50 text-amber-700' : 'text-slate-700 hover:bg-slate-100 hover:text-amber-600'}`}
                            >
                              <LayoutDashboard size={18} />
                              Dashboard
                            </button>
                          </>
                        )}

                        <div className="h-px bg-slate-100 my-1 mx-2"></div>
                        <button
                          onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                          className="w-full text-right px-4 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-rose-50 to-red-50 text-rose-600 border border-rose-100 hover:border-rose-200 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-end gap-3 group relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-red-100/50 to-rose-100/50 translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
                          <LogOut size={18} className="text-rose-400 group-hover:text-rose-600 transition-colors relative z-10 group-hover:-translate-x-1 duration-300" />
                          <span className="relative z-10">تسجيل الخروج</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          {/* شريط الطلبات المعلقة (أوفلاين) — يظهر عند وجود طلبات محفوظة محلياً بانتظار المزامنة */}
          {pendingSyncCount > 0 && (
            <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm font-bold">
              <CloudOff size={16} className="shrink-0" />
              <span>{pendingSyncCount} طلب/طلبات محفوظة محلياً — ستُزامن تلقائياً عند عودة الاتصال</span>
              {isOnline && (
                <button
                  type="button"
                  onClick={() => { syncOfflineOrders(); }}
                  className="shrink-0 rounded-lg bg-amber-200 hover:bg-amber-300 px-3 py-1 text-xs font-bold text-amber-900"
                >
                  مزامنة الآن
                </button>
              )}
            </div>
          )}



          {/* بدون dir=rtl هنا: يمنع انعكاس شبكة المنتجات وصفوف الأقسام؛ النص العربي يبقى عبر text-right و dir محلي حيث يلزم */}
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth relative transition-colors duration-500 bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]/50">
            {isSortingMode && (
              <AdminSortProducts
                items={sortingCategory === 'electrical' ? filteredItems.filter((i) => isElectricalGroup(i.group)) : filteredItems.filter((i) => !isElectricalGroup(i.group))}
                initialOrder={dynamicBarcodeOrder}
                title={sortingCategory === 'electrical' ? "ترتيب المنتجات (الأجهزة الكهربائية)" : "ترتيب المنتجات (الأدوات المنزلية)"}
                onSave={saveCustomOrder}
                onCancel={() => { setIsSortingMode(false); setSortingCategory(null); }}
                getImage={getImage}
              />
            )}
            {mode === 'dashboard' ? (
              <div className="h-full min-h-[100vh] w-full flex flex-col">
                <ElectroMartDashboard items={items} orders={dashboardOrders} ordersLoading={dashboardOrdersLoading} username={username} setMode={setMode} />
              </div>
            ) : (
            <div className="max-w-7xl mx-auto w-full pb-20">

              {/* Hero Section + Categories — لا يظهران على صفحة إعدادات الحساب أو العملاء */}
              {mode !== 'settings' && mode !== 'customers' && mode !== 'reports' && mode !== 'inventory' && !loading && !showOrderPanel && mode !== 'submitted' && mode !== 'offers' && mode !== 'dashboard' && mode !== 'sales_hub' && (
                <div className="px-6 py-8 sm:py-12 flex flex-col items-center text-center animate-fade-in">
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-right w-full max-w-4xl mx-auto space-y-3 mb-6" dir="rtl">
                    <span className="text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full inline-block shadow-sm bg-indigo-600 text-white">
                      جودة متميزة مضمونة
                    </span>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[1.1] tracking-tight text-slate-900">
                      استكشف مجموعتنا المتميزة
                      <br className="hidden sm:block" />
                      <span className="text-blue-600"> من الأجهزة الكهربائية وأدوات المطبخ</span>
                    </h1>
                    <p className="text-base sm:text-lg font-medium text-slate-600">
                      اختر العناصر لإنشاء طلب جديد أو لإدارة الكتالوج الخاص بك.
                    </p>
                  </div>

                  <div className="w-full max-w-2xl mt-8 flex flex-col sm:flex-row items-center gap-4 z-20">
                    <div className="relative group w-full flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 transition-colors text-indigo-500 group-focus-within:text-indigo-600" />
                      </div>
                      <input
                        ref={posCatalogSearchInputRef}
                        type="text"
                        className="block w-full pl-11 pr-4 py-4 border-0 rounded-2xl shadow-lg transition-all duration-300 text-lg bg-white/80 ring-1 ring-slate-200/60 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                        placeholder="البحث بنوع المنتج أو الباركود..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        onKeyDown={handlePosCatalogSearchKeyDown}
                        enterKeyHint="search"
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        dir="ltr"
                        aria-label="بحث ومسح الباركود"
                      />
                      {search ? (
                        <button
                          className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors text-slate-400 hover:text-rose-500"
                          onClick={() => setSearch('')}
                          title="مسح البحث"
                        >
                          <X size={20} />
                        </button>
                      ) : (
                        <button
                          className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${isListening ? 'text-rose-500 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'text-slate-400 hover:text-indigo-500'}`}
                          onClick={startVoiceSearch}
                          title="بحث بالصوت"
                        >
                          <Mic size={20} />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setSortMode(s => s === 'barcode' ? 'name' : 'barcode')}
                      className="px-6 py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center gap-3 shrink-0 bg-white/80 hover:bg-white text-slate-600 ring-1 ring-slate-200/60 hover:ring-indigo-500/50 shadow-indigo-500/5 hover:shadow-indigo-500/10"
                    >
                      <ArrowUpDown size={20} className={sortMode === 'name' ? 'text-indigo-400' : 'text-slate-400'} />
                      <span>{sortMode === 'barcode' ? 'By Name' : 'By Barcode'}</span>
                    </button>
                  </div>
                  <p className="w-full max-w-2xl mt-3 text-[11px] text-slate-500 leading-relaxed px-1">
                    قارئ باركود أو تطبيق موبايل: فعّل «Send Enter» / «Append Enter» في إعدادات التطبيق، ثم اضغط هنا للتركيز على الحقل قبل المسح — عند الإرسال يُفتح صنف المنتج مباشرة.
                    <button
                      type="button"
                      onClick={() => posCatalogSearchInputRef.current?.focus?.()}
                      className="mr-2 font-bold text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline"
                    >
                      جاهز للمسح
                    </button>
                  </p>
                </div>
              )}

              {/* Submitted Orders View */}
              {!loading && mode === 'submitted' && (
                <div className="p-6 max-w-5xl mx-auto animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-3xl font-bold text-slate-800">Sale Orders</h2>
                    <button
                      type="button"
                      onClick={() => { fetchSubmittedOrders(); fetchCompletedOrders(); }}
                      disabled={ordersLoading || completedOrdersLoading}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                    >
                      {(ordersLoading || completedOrdersLoading) ? <Loader2 size={18} className="animate-spin" /> : null}
                      {(ordersLoading || completedOrdersLoading) ? 'Loading…' : 'تحديث'}
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl w-fit">
                    <button
                      type="button"
                      onClick={() => setSubmittedOrdersTab('pending')}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${submittedOrdersTab === 'pending' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      قيد الانتظار
                      {submittedOrders.length > 0 && (
                        <span className="mr-2 bg-indigo-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{submittedOrders.length}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmittedOrdersTab('completed')}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${submittedOrdersTab === 'completed' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      مكتمل ✓
                      {completedOrders.length > 0 && (
                        <span className="mr-2 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{completedOrders.length}</span>
                      )}
                    </button>
                  </div>

                  {ordersError && submittedOrdersTab === 'pending' && (
                    <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                      <p className="font-medium">{ordersError}</p>
                      <p className="mt-2 text-amber-700 text-xs">إذا ظهر &quot;table not found&quot;: أنشئ جدول orders من Supabase → SQL Editor ثم شغّل الـ SQL في ملف ORDERS_SUPABASE.md. إذا الجدول موجود ولا تظهر الطلبات: Table Editor → orders → RLS وأضف سياسة SELECT لـ anon.</p>
                      <button type="button" onClick={fetchSubmittedOrders} className="mt-3 px-4 py-2 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium text-sm">Retry</button>
                    </div>
                  )}

                  {/* Pending Tab */}
                  {submittedOrdersTab === 'pending' && (
                    ordersLoading && submittedOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                        <p className="text-slate-500 font-medium">جاري التحميل…</p>
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
                            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-indigo-200 transition-all gap-4 cursor-pointer"
                          >
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold">#{order.id || i + 1}</span>
                                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                                  {new Date(order.created_at || order.order_date || Date.now()).toLocaleDateString()}
                                </span>
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">انتظار موافقة</span>
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
                          <div className="text-center py-20 bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]/50 rounded-3xl border border-dashed border-slate-200">
                            <Package size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-400 font-medium">لا توجد طلبيات بانتظار الموافقة.</p>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Completed Tab */}
                  {submittedOrdersTab === 'completed' && (
                    completedOrdersLoading && completedOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 size={48} className="animate-spin text-emerald-500 mb-4" />
                        <p className="text-slate-500 font-medium">جاري التحميل…</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {completedOrders.map((order, i) => (
                          <div
                            key={order.id || i}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedOrder(order)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedOrder(order); } }}
                            className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-emerald-200 transition-all gap-4 cursor-pointer"
                          >
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold">#{order.id || i + 1}</span>
                                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                                  {new Date(order.created_at || order.order_date || Date.now()).toLocaleDateString()}
                                </span>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">✓ مكتمل</span>
                              </div>
                              <h3 className="font-bold text-lg text-slate-800">{order.customer_name || 'Unknown Client'}</h3>
                              <p className="text-sm text-slate-500 mt-1">
                                Prepared by: <span className="font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{order.prepared_by}</span>
                              </p>
                              {order.customer_phone && <p className="text-xs text-slate-400 mt-1">{order.customer_phone}</p>}
                              {order.customer_address && <p className="text-xs text-slate-400">{order.customer_address}</p>}
                            </div>
                            <div className="text-left sm:text-right w-full sm:w-auto">
                              <p className="text-2xl font-black text-emerald-700">₪{Number(order.total_amount).toLocaleString()}</p>
                              <p className="text-xs text-slate-400 font-medium">{order.items?.length || 0} items</p>
                            </div>
                          </div>
                        ))}
                        {!completedOrdersLoading && completedOrders.length === 0 && (
                          <div className="text-center py-20 bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]/50 rounded-3xl border border-dashed border-slate-200">
                            <Package size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-400 font-medium">لا توجد طلبيات مكتملة بعد.</p>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Order detail modal — rendered in document.body so it always covers full viewport */}
                  {selectedOrder && createPortal(
                    <div
                      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                      onClick={() => !orderActionLoading && setSelectedOrder(null)}
                    >
                      <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90svh] overflow-hidden flex flex-col hide-on-print"
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
                                <thead className="bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]">
                                  <tr>
                                    <th className="text-right py-2 px-3 font-medium text-slate-600">الصنف</th>
                                    <th className="text-center py-2 px-2 font-medium text-slate-600">الكمية</th>
                                    <th className="text-left py-2 px-3 font-medium text-slate-600">السعر</th>
                                    <th className="text-left py-2 px-3 font-medium text-slate-600">الإجمالي</th>
                                    <th className="w-10"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selectedOrder.items || []).map((row, idx) => (
                                    <tr key={idx} className="border-t border-slate-100 group">
                                      <td className="py-2 px-3 text-slate-800">{row.name || row.barcode || '—'}</td>
                                      <td className="py-2 px-1 text-center">
                                        <input 
                                          type="number"
                                          value={row.qty ?? ''}
                                          onChange={(e) => updateSelectedItemField(idx, 'qty', e.target.value)}
                                          className="w-12 bg-slate-50 border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded p-1 text-center text-slate-600 outline-none transition-all"
                                        />
                                      </td>
                                      <td className="py-2 px-1 text-left">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400">₪</span>
                                          <input 
                                            type="number"
                                            value={row.price ?? ''}
                                            onChange={(e) => updateSelectedItemField(idx, 'price', e.target.value)}
                                            className="w-20 bg-slate-50 border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded p-1 text-left text-slate-600 outline-none transition-all"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 font-medium text-slate-800 text-left">₪{Number(row.total ?? 0).toLocaleString()}</td>
                                      <td className="py-2 px-2 text-center">
                                        <button 
                                          onClick={() => removeItemFromSelectedOrder(idx)}
                                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                          title="حذف الصنف"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Add Item Search in Modal */}
                          <div className="relative">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">إضافة منتج للطلبية</span>
                            <div className="relative group">
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                <Search size={16} />
                              </div>
                              <input 
                                type="text"
                                value={orderEditSearch}
                                onChange={(e) => setOrderEditSearch(e.target.value)}
                                placeholder="ابحث باسم المنتج أو الباركود..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm outline-none focus:border-indigo-400 transition-all"
                              />
                              {orderEditSearch.trim().length > 0 && (
                                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-[9999] p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2">
                                  {items
                                    .filter(it => 
                                      (it.name || '').toLowerCase().includes(orderEditSearch.toLowerCase()) || 
                                      (it.barcode || '').includes(orderEditSearch)
                                    )
                                    .slice(0, 10)
                                    .map(it => (
                                      <button
                                        key={it.barcode}
                                        onClick={() => {
                                          addItemToSelectedOrder(it);
                                          setOrderEditSearch('');
                                        }}
                                        className="w-full text-right p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between border border-transparent hover:border-slate-100 transition-all font-medium text-sm text-slate-700"
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-bold">{it.name}</span>
                                          <span className="text-[10px] opacity-50 font-mono">{it.barcode}</span>
                                        </div>
                                        <span className="text-emerald-600 font-black">₪{Number(it.priceAfterDiscount || it.price).toLocaleString()}</span>
                                      </button>
                                    ))
                                  }
                                  {items.filter(it => (it.name || '').toLowerCase().includes(orderEditSearch.toLowerCase()) || (it.barcode || '').includes(orderEditSearch)).length === 0 && (
                                    <div className="p-4 text-center text-slate-400 text-xs">لا توجد نتائج</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-lg font-black text-slate-800 pt-2">المجموع: ₪{Number(selectedOrder.total_amount ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex flex-wrap gap-3 shrink-0">

                          {/* Approve — DB update first, then refetch lists */}
                          <button
                            type="button"
                            onClick={handleApproveSubmittedOrder}
                            disabled={orderActionLoading}
                            className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {orderActionLoading ? <Loader2 size={18} className="animate-spin" /> : <div className="flex items-center gap-2"><span className="text-lg">✓</span> موافق</div>}
                          </button>

                          {/* Excel — نفس تنسيق تصدير الطلبية من شاشة المبيعات */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedOrder) return;
                              setOrderActionLoading(true);
                              try {
                                const raw = selectedOrder.details;
                                const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
                                const orderDateStr =
                                  d.orderDate ||
                                  selectedOrder.order_date ||
                                  (selectedOrder.created_at
                                    ? new Date(selectedOrder.created_at).toISOString().slice(0, 10)
                                    : new Date().toISOString().slice(0, 10));
                                const info = {
                                  companyName: (d.companyName || selectedOrder.customer_name || '').trim() || '—',
                                  merchantName: (d.merchantName || d.merchant_name || selectedOrder.customer_name || '').trim() || '—',
                                  customerNumber: String(d.customerNumber ?? selectedOrder.customer_number ?? ''),
                                  phone: String(d.phone ?? selectedOrder.customer_phone ?? ''),
                                  address: (String(d.address ?? selectedOrder.customer_address ?? '').trim()) || '—',
                                  orderDate: orderDateStr,
                                  paymentMethod: String(d.paymentMethod ?? selectedOrder.payment_method ?? ''),
                                  checksCount: d.checksCount != null && d.checksCount !== '' ? String(d.checksCount) : '',
                                  discountType: d.discountType || '',
                                  discountValue: d.discountValue != null && d.discountValue !== '' ? String(d.discountValue) : '',
                                  email: d.email || '',
                                  notes: d.notes || '',
                                };
                                const lines = (selectedOrder.items || []).map((row) => {
                                  const barcode = row.barcode || '';
                                  const liveItem = barcode ? items.find((it) => barcodesMatch(it.barcode, barcode)) : null;
                                  const consumer = Number(
                                    row.consumer_price != null && row.consumer_price !== ''
                                      ? row.consumer_price
                                      : (liveItem?.price ?? row.price ?? 0),
                                  );
                                  const unit = Number(
                                    row.unit_price != null && row.unit_price !== ''
                                      ? row.unit_price
                                      : (row.price ?? consumer),
                                  );
                                  return {
                                    barcode,
                                    qty: Number(row.qty) || 0,
                                    customName: row.name,
                                    product_type: row.product_type,
                                    name: row.name,
                                    item:
                                      liveItem || {
                                        barcode,
                                        name: row.name,
                                        group: row.group,
                                        productType: row.product_type,
                                        price: consumer,
                                        priceAfterDiscount: unit,
                                      },
                                    unitPrice: unit,
                                  };
                                });
                                const sub = lines.reduce((s, o) => s + getLineTotal(o), 0);
                                const exportTotal = Math.max(0, sub - getOrderDiscount(sub, info));
                                const safe = (s) => String(s || 'Order').replace(/[/\\:*?"<>|]/g, '');
                                const fileName = `Order-ID${selectedOrder.id}_${safe(info.companyName)}.xlsx`;
                                await downloadFormattedSalesOrderExcel(info, lines, exportTotal, fileName);
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

                          {/* Print Receipt Button */}
                          <button
                            type="button"
                            onClick={() => {
                              window.print();
                            }}
                            disabled={orderActionLoading}
                            className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <Printer size={18} /> طباعة للفاتورة
                          </button>

                          <button type="button" onClick={() => deleteOrder(selectedOrder)} disabled={orderActionLoading} className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                            {orderActionLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            حذف الطلب
                          </button>
                        </div>
                      </div>

                      {/* THERMAL RECEIPT (Only visible when printing) */}
                      <div className="hidden print:block print-receipt-only bg-white text-black p-4 w-[80mm] mx-auto text-sm" dir="rtl">
                        <div className="text-center mb-4">
                          <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-2">Maslamani Sales</h2>
                          <p className="font-bold text-lg">طلب مبيعات</p>
                          <p>رقم الطلب: {selectedOrder.id}</p>
                          <p>{selectedOrder.order_date || (selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : '—')}</p>
                        </div>

                        <div className="mb-4 text-xs font-bold leading-relaxed border-b border-black pb-2 border-dashed">
                          <p>العميل: {selectedOrder.customer_name || '—'}</p>
                          {selectedOrder.customer_phone && <p>الهاتف: {selectedOrder.customer_phone}</p>}
                          {selectedOrder.customer_address && <p>العنوان: {selectedOrder.customer_address}</p>}
                          <p>رقم العميل: {selectedOrder.customer_number || '—'}</p>
                          <p>المندوب: {selectedOrder.prepared_by || '—'}</p>
                        </div>

                        <table className="w-full text-xs font-bold mb-4">
                          <thead className="border-b border-black border-dashed">
                            <tr>
                              <th className="py-1 text-right w-1/2">الصنف</th>
                              <th className="py-1 text-center font-normal px-1 w-1/4">الكمية</th>
                              <th className="py-1 text-left w-1/4">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedOrder.items || []).map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-200 border-dotted border-opacity-30">
                                <td className="py-2 pr-1">{row.name || row.barcode || '—'}</td>
                                <td className="py-2 text-center text-[10px]">{row.qty} x ₪{row.price}</td>
                                <td className="py-2 text-left">₪{Number(row.total ?? 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="border-t-2 border-black pt-2 pb-6 flex justify-between font-black text-lg items-end">
                          <span>المجموع الكلي:</span>
                          <span className="text-2xl">₪{Number(selectedOrder.total_amount ?? 0).toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col items-center justify-center pt-4 border-t border-black border-dashed mt-4 text-xs">
                          <p className="mb-2">شكراً لتعاملكم معنا!</p>
                          <p className="font-mono">{selectedOrder.id || 'NO-ID'}</p>
                        </div>
                      </div>

                    </div>,
                    document.body
                  )}
                </div>
              )}

              {/* Categories — dir=ltr يحافظ على ترتيب All → Electrical → Kitchenware (الآباء dir=rtl يعكس صف flex) */}
              {!loading && mode !== 'submitted' && mode !== 'dashboard' && mode !== 'sales_hub' && mode !== 'offers' && mode !== 'settings' && mode !== 'customers' && mode !== 'reports' && mode !== 'inventory' && (
                <div dir="ltr" className={`sticky top-0 z-20 px-4 sm:px-6 py-4 transition-all duration-300 ${!showOrderPanel ? 'backdrop-blur-md bg-white/30 border-y border-white/40' : ''}`}>
                  <div className="flex flex-wrap justify-center gap-3">
                    {[
                      { key: null, label: 'All', count: items.length, icon: null, type: 'all' },
                      { key: '__electrical__', label: 'Electrical', count: items.filter((i) => isElectricalGroup(i.group)).length, icon: Zap, type: 'electrical' },
                      { key: '__home__', label: 'Kitchenware', count: items.filter((i) => !isElectricalGroup(i.group)).length, icon: UtensilsCrossed, type: 'household' },
                    ].map(({ key, label, count, icon: Icon, type }) => {
                      const isSelected = selectedGroup === key || (key === '__electrical__' && selectedGroup && isElectricalGroup(selectedGroup)) || (key === '__home__' && selectedGroup && !isElectricalGroup(selectedGroup));

                      let activeClass = 'bg-white/80 text-slate-600 hover:bg-white hover:shadow-md';
                      if (isSelected) {
                        if (type === 'electrical') activeClass = 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30';
                        else if (type === 'household') activeClass = 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30';
                        else activeClass = 'bg-slate-800 text-white shadow-lg';
                      }

                      return (
                        <button
                          key={key ?? 'all'}
                          onClick={() => handleCategorySwitch(key)}
                          className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border border-transparent ${activeClass}`}
                        >
                          {Icon && <Icon size={18} className={isSelected ? (type === 'electrical' ? 'text-blue-100' : type === 'household' ? 'text-amber-100' : '') : ''} />}
                          <span>{label}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isSelected ? 'bg-white/20' : 'bg-slate-200/50'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sub-categories — المجموعات الفرعية كما كانت سابقاً */}
                  {(selectedGroup === '__electrical__' || (selectedGroup && isElectricalGroup(selectedGroup))) && electricalGroupsSorted.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4 animate-fade-in">
                      <button onClick={() => handleCategorySwitch('__electrical__')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup === '__electrical__' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' : 'bg-white/60 text-slate-600 hover:bg-white'}`}>All</button>
                      {electricalGroupsSorted.map((g) => (
                        <button
                          key={g}
                          onClick={() => handleCategorySwitch(g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup && String(selectedGroup).trim().toLowerCase() === g.trim().toLowerCase() ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white/60 text-slate-600 hover:bg-white hover:text-blue-600'}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                  {(selectedGroup === '__home__' || (selectedGroup && selectedGroup !== '__electrical__' && !isElectricalGroup(selectedGroup))) && kitchenwareGroupsSorted.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4 animate-fade-in">
                      <button onClick={() => handleCategorySwitch('__home__')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup === '__home__' ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' : 'bg-white/60 text-slate-600 hover:bg-white'}`}>All</button>
                      {kitchenwareGroupsSorted.map((g) => (
                        <button
                          key={g}
                          onClick={() => handleCategorySwitch(g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedGroup && String(selectedGroup).trim().toLowerCase() === g.trim().toLowerCase() ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-white/60 text-slate-600 hover:bg-white hover:text-orange-600'}`}
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
                {(loading || isSwitchingCategory) ? (
                  <Suspense fallback={<div className="min-h-[40svh] animate-pulse bg-slate-100/50 rounded-2xl" />}>
                    <SkeletonGrid />
                  </Suspense>
                ) : mode === 'dashboard_preview' ? (
                  <ElectroMartDashboard />
                ) : mode === 'dashboard' ? (
                  /* لوحة التحكم الجديدة مع بيانات المشروع الفعلية */
                  <ElectroMartDashboard items={items} orders={dashboardOrders} ordersLoading={dashboardOrdersLoading} username={username} />
                ) : mode === 'reports' ? (
                  /* التقارير — الشكل الخارجي: أولاً "أي تقرير تريد أن تراه؟" ثم محتوى التقرير */
                  <div className="max-w-6xl mx-auto animate-fade-in">
                    {activeReportTab == null ? (
                      /* شاشة اختيار التقرير — مثل Sales Area */
                      <div className="flex flex-col items-center pt-10 pb-20 px-4">
                        <div className="text-center mb-10">
                          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">التقارير والإحصائيات</h2>
                          <p className="text-slate-500 mt-2 text-lg">أي تقرير تريد أن تراه؟</p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-6 items-stretch justify-center w-full max-w-4xl">
                          {/* تقرير المبيعات */}
                          <div className="flex-1 bg-white rounded-3xl p-8 shadow-xl shadow-indigo-900/5 border border-indigo-50 relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                            onClick={() => setActiveReportTab('sales')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveReportTab('sales'); } }}
                          >
                            <div className="absolute top-0 right-0 p-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                            <div className="relative z-10 flex flex-col h-full">
                              <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6 shadow-inner">
                                <FileText size={32} />
                              </div>
                              <h3 className="text-2xl font-black text-slate-800 mb-3">تقرير المبيعات</h3>
                              <p className="text-slate-500 mb-8 leading-relaxed flex-1">
                                إحصائيات المبيعات حسب الفترة، رسم بياني واتجاه النمو أو الانخفاض.
                              </p>
                              <div className="mt-auto">
                                <span className="inline-flex items-center gap-2 py-3 text-indigo-600 font-bold">
                                  <span>عرض التقرير</span>
                                  <ChevronRight size={20} />
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* تقرير المخزون */}
                          <div className="flex-1 bg-white rounded-3xl p-8 shadow-xl shadow-amber-900/5 border border-amber-50 relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                            onClick={() => setActiveReportTab('inventory')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveReportTab('inventory'); } }}
                          >
                            <div className="absolute top-0 right-0 p-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                            <div className="relative z-10 flex flex-col h-full">
                              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-6 shadow-inner">
                                <Package size={32} />
                              </div>
                              <h3 className="text-2xl font-black text-slate-800 mb-3">تقرير المخزون</h3>
                              <p className="text-slate-500 mb-8 leading-relaxed flex-1">
                                حالة المخزون الحالية، تصدير Excel/PDF للتجرد، وتنبيهات الأصناف المنخفضة.
                              </p>
                              <div className="mt-auto">
                                <span className="inline-flex items-center gap-2 py-3 text-amber-600 font-bold">
                                  <span>عرض التقرير</span>
                                  <ChevronRight size={20} />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* محتوى التقرير المختار + زر العودة لشاشة الاختيار */
                      <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => setActiveReportTab(null)}
                                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors flex items-center gap-1"
                                title="تغيير التقرير"
                              >
                                <ChevronRight size={20} className="rotate-180" />
                                <span className="text-sm font-bold">تغيير التقرير</span>
                              </button>
                              <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                  {activeReportTab === 'sales' ? 'تقرير المبيعات' : 'تقرير المخزون'}
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">
                                  {activeReportTab === 'sales' ? 'إحصائيات المبيعات حسب الفترة المختارة.' : 'حالة المخزون والتصدير للتجرد.'}
                                </p>
                              </div>
                            </div>
                            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl shrink-0 border border-slate-200/60 shadow-inner">
                              <button
                                onClick={() => setActiveReportTab('sales')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeReportTab === 'sales'
                                  ? 'bg-white text-indigo-700 shadow-md shadow-slate-200/50 scale-100'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50 scale-95'
                                  }`}
                              >
                                <FileText size={18} /> المبيعات
                              </button>
                              <button
                                onClick={() => setActiveReportTab('inventory')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeReportTab === 'inventory'
                                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-100'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50 scale-95'
                                  }`}
                              >
                                <Package size={18} /> المخزون
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 sm:p-8 relative min-h-[400px]">
                          <AnimatePresence mode="wait">
                            {activeReportTab === 'sales' ? (
                              /* Sales Report Tab — فلتر زمني + رسم */
                              <motion.div
                                key="sales"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="space-y-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-slate-600">الفترة:</span>
                                    {[7, 14, 30].map((d) => (
                                      <button
                                        key={d}
                                        onClick={() => { setReportSalesDays(d); fetchSalesLast7(d); }}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${reportSalesDays === d
                                          ? 'bg-indigo-600 text-white shadow-md'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                      >
                                        آخر {d} يوم
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-100">
                                  <div className="flex items-center justify-between mb-4 gap-4">
                                    <div>
                                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">إجمالي آخر {reportSalesDays} أيام</p>
                                      <p className="text-2xl font-black text-slate-900">
                                        ₪{salesLast7.reduce((sum, p) => sum + (p.value || 0), 0).toLocaleString('en-US')}
                                      </p>
                                    </div>
                                    {salesLast7.length > 1 && (
                                      <div
                                        className={`text-sm font-bold ${salesTrend > 0
                                          ? 'text-emerald-600'
                                          : salesTrend < 0
                                            ? 'text-rose-600'
                                            : 'text-slate-500'
                                          }`}
                                      >
                                        {salesTrend > 0
                                          ? '↑ نمو مقابل بداية الفترة'
                                          : salesTrend < 0
                                            ? '↓ انخفاض مقابل بداية الفترة'
                                            : 'مستقر'}
                                      </div>
                                    )}
                                  </div>

                                  <div className="h-24">
                                    {salesStatsLoading ? (
                                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                                        جارِ تحميل بيانات المبيعات...
                                      </div>
                                    ) : (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={salesLast7}>
                                          <Tooltip
                                            formatter={(v) => `₪${Number(v || 0).toLocaleString('en-US')}`}
                                            labelFormatter={() => ''}
                                            contentStyle={{ fontSize: 11, direction: 'rtl' }}
                                          />
                                          <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#4f46e5"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                          />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    )}
                                  </div>

                                  <div className="mt-3 flex justify-between text-[11px] text-slate-400">
                                    {salesLast7.map((p) => (
                                      <span key={p.date} className="flex-1 text-center">
                                        {p.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            ) : (
                              /* Inventory Report Tab — تصدير Excel / PDF وتنبيهات بصرية */
                              <motion.div
                                key="inventory"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="space-y-6"
                              >
                                {/* فلتر زمني اختياري للمخزون + أزرار التصدير */}
                                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                                  <p className="text-sm text-slate-600">
                                    حالة المخزون الحالية — تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}
                                  </p>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={requestStockAlertPermission}
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-md hover:bg-amber-600 transition-colors"
                                      title="إشعار عند نفاد صنف خلال 48 ساعة"
                                    >
                                      <Bell size={18} /> تفعيل تنبيهات المخزون
                                    </button>
                                    <button
                                      onClick={handleExportReportInventory}
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-700 transition-colors"
                                    >
                                      <FileDown size={18} /> تصدير Excel
                                    </button>
                                    <button
                                      onClick={handlePrintReportInventory}
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 text-white font-bold text-sm shadow-md hover:bg-slate-800 transition-colors"
                                    >
                                      <Printer size={18} /> طباعة / PDF
                                    </button>
                                  </div>
                                </div>
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                      <span className="font-bold text-2xl">₪</span>
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">إجمالي قيمة المخزون</p>
                                      <p className="text-2xl font-black text-slate-900 mt-1 truncate">₪{Math.round(inventoryMetrics.totalValue).toLocaleString()}</p>
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                                      <Package size={28} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">إجمالي القطع المتوفرة</p>
                                      <p className="text-2xl font-black text-slate-900 mt-1">{inventoryMetrics.totalItemsCount.toLocaleString()}</p>
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                      <Grid size={28} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">أنواع المنتجات (SKUs)</p>
                                      <p className="text-2xl font-black text-slate-900 mt-1">{inventoryMetrics.uniqueSKUs.toLocaleString()}</p>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-4">
                                    <div className="bg-white rounded-3xl p-4 shadow-xl shadow-rose-200/40 border border-rose-100 flex items-center gap-4 flex-1">
                                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                        <X size={20} />
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">نواقص تامة (كمية 0)</p>
                                        <p className="text-xl font-black text-rose-700 leading-tight">{inventoryMetrics.outOfStockCount.toLocaleString()}</p>
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-3xl p-4 shadow-xl shadow-amber-200/40 border border-amber-100 flex items-center gap-4 flex-1">
                                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                        <AlertTriangle size={20} />
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">أوشكت على النفاد (≤5)</p>
                                        <p className="text-xl font-black text-amber-700 leading-tight">{inventoryMetrics.lowStockItemsCount.toLocaleString()}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid lg:grid-cols-3 gap-6">
                                  {/* Category Breakdown */}
                                  <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col h-[400px]">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-sky-100 text-sky-600"><PieChartIcon size={18} /></div>
                                        <h3 className="font-bold text-slate-800">توزيع المخزون حسب الفئة</h3>
                                      </div>
                                      <div className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                                        {inventoryMetrics.categoryBreakdown.length} فئات نشطة
                                      </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col md:flex-row items-center justify-center relative min-h-[300px]">
                                      {inventoryMetrics.categoryBreakdown.length > 0 ? (
                                        <>
                                          <div className="w-full h-[250px] relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                              <PieChart>
                                                <Pie
                                                  data={inventoryMetrics.categoryBreakdown}
                                                  dataKey="value"
                                                  nameKey="group"
                                                  cx="50%"
                                                  cy="50%"
                                                  innerRadius={60}
                                                  outerRadius={90}
                                                  paddingAngle={5}
                                                >
                                                  {inventoryMetrics.categoryBreakdown.map((entry, index) => {
                                                    const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];
                                                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />;
                                                  })}
                                                </Pie>
                                                <Tooltip
                                                  formatter={(value) => `₪${Math.round(value).toLocaleString()}`}
                                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontWeight: 'bold' }}
                                                  itemStyle={{ color: '#0f172a' }}
                                                />
                                              </PieChart>
                                            </ResponsiveContainer>
                                            {/* Center Label */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                              <span className="text-xs font-semibold text-slate-400">الإجمالي</span>
                                              <span className="text-sm font-black text-slate-700">₪{Math.round(inventoryMetrics.totalValue).toLocaleString()}</span>
                                            </div>
                                          </div>
                                          {/* Legend */}
                                          <div className="w-full mt-4 flex flex-wrap justify-center gap-2 custom-scrollbar overflow-y-auto max-h-[120px] px-2 p-1">
                                            {inventoryMetrics.categoryBreakdown.map((cat, idx) => {
                                              const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];
                                              const percent = ((cat.value / inventoryMetrics.totalValue) * 100).toFixed(1);
                                              return (
                                                <div key={cat.group} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors shadow-sm whitespace-nowrap">
                                                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                                                  <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]" title={cat.group}>{cat.group}</span>
                                                  <span className="text-xs font-mono font-medium text-slate-500 bg-white px-1.5 rounded-md border border-slate-100">{percent}%</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400 h-full">
                                          <PieChartIcon size={40} className="mb-3 opacity-20" />
                                          <p>لا توجد بيانات متاحة</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Top 10 Value Items */}
                                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col h-[400px]">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><TrendingUp size={18} /></div>
                                        <h3 className="font-bold text-slate-800">أعلى 10 أصناف قيمةً في المخزن</h3>
                                      </div>
                                    </div>
                                    <div className="overflow-x-auto flex-1 custom-scrollbar border-t border-transparent">
                                      <table className="w-full text-sm text-right whitespace-nowrap">
                                        <thead className="bg-white sticky top-0 shadow-sm z-10 text-slate-500">
                                          <tr>
                                            <th className="py-3 px-4 font-semibold">الصنف</th>
                                            <th className="py-3 px-4 font-semibold">الباركود</th>
                                            <th className="py-3 px-4 font-semibold">الكمية</th>
                                            <th className="py-3 px-4 font-semibold">السعر</th>
                                            <th className="py-3 px-4 font-semibold text-amber-700">إجمالي القيمة</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {inventoryMetrics.topValueItems.map((item, idx) => {
                                            const qty = Number(item.qty ?? 0);
                                            const rowAlert = qty === 0 ? 'bg-red-50 border-r-4 border-red-400' : qty <= 5 ? 'bg-amber-50 border-r-4 border-amber-400' : '';
                                            return (
                                              <tr key={item.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${rowAlert}`}>
                                                <td className="py-3 px-4">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center shrink-0">
                                                      {idx + 1}
                                                    </div>
                                                    <div className={`font-semibold truncate max-w-[200px] ${qty === 0 ? 'text-red-800' : qty <= 5 ? 'text-amber-800' : 'text-slate-800'}`} title={item.name}>
                                                      {item.name || '—'}
                                                    </div>
                                                  </div>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-slate-500">{item.barcode || '—'}</td>
                                                <td className={`py-3 px-4 font-bold font-mono ${qty === 0 ? 'text-red-700' : qty <= 5 ? 'text-amber-700' : 'text-slate-700'}`}>{item.qty}</td>
                                                <td className="py-3 px-4 font-mono text-slate-500">₪{Math.round(item.price)}</td>
                                                <td className="py-3 px-4 font-black text-amber-600 font-mono">₪{Math.round(item.totalValue).toLocaleString()}</td>
                                              </tr>
                                            );
                                          })}
                                          {inventoryMetrics.topValueItems.length === 0 && (
                                            <tr>
                                              <td colSpan={5} className="py-12 text-center text-slate-400">لا توجد بيانات متاحة</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                {/* Best Sellers and Aging Stock Tables */}
                                <div className="grid lg:grid-cols-2 gap-6">
                                  {/* Best Sellers vs Stock */}
                                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col h-[400px]">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><TrendingUp size={18} /></div>
                                        <h3 className="font-bold text-slate-800">الأكثر مبيعاً مقابل المتوفر</h3>
                                      </div>
                                      <div className="text-xs font-semibold text-slate-500">
                                        (آخر 90 يوماً)
                                      </div>
                                    </div>
                                    <div className="overflow-x-auto flex-1 custom-scrollbar border-t border-transparent">
                                      <table className="w-full text-sm text-right whitespace-nowrap">
                                        <thead className="bg-white sticky top-0 shadow-sm z-10 text-slate-500">
                                          <tr>
                                            <th className="py-3 px-4 font-semibold">الصنف</th>
                                            <th className="py-3 px-4 font-semibold text-emerald-600">المبيعات</th>
                                            <th className="py-3 px-4 font-semibold">متوفر</th>
                                            <th className="py-3 px-4 font-semibold text-sky-600">معدل البيع/يوم</th>
                                            <th className="py-3 px-4 font-semibold text-amber-600">ينفد بعد</th>
                                            <th className="py-3 px-4 font-semibold">الحالة</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {inventoryMetrics.bestSellers.map((item) => {
                                            const needsRestock = item.qty < item.unitsSold * 0.5; // Example arbitrary condition
                                            const velocityStr = item.salesVelocity > 0 ? (item.salesVelocity < 0.1 ? item.salesVelocity.toFixed(2) : item.salesVelocity.toFixed(1)) : '—';
                                            const depletionStr = item.daysUntilDepletion != null ? `≈ ${item.daysUntilDepletion} يوم` : '—';
                                            return (
                                              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4">
                                                  <div className="font-semibold text-slate-800 truncate max-w-[150px]" title={item.name}>
                                                    {item.name || '—'}
                                                  </div>
                                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.barcode}</div>
                                                </td>
                                                <td className="py-3 px-4 font-black text-emerald-600 font-mono text-center">
                                                  {item.unitsSold}
                                                </td>
                                                <td className="py-3 px-4 font-bold text-slate-700 font-mono text-center">
                                                  {item.qty}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-sky-600 text-center" title="قطعة/يوم (آخر 30 يوماً)">
                                                  {velocityStr}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-amber-700 text-center font-semibold" title="تاريخ النفاد المتوقع">
                                                  {depletionStr}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                  {needsRestock ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                                                      <AlertTriangle size={12} /> اطلب كمية
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                                                      آمن
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          {(!inventoryMetrics.bestSellers || inventoryMetrics.bestSellers.length === 0) && (
                                            <tr>
                                              <td colSpan={6} className="py-12 text-center text-slate-400">لا توجد بيانات / لم تكتمل تزامن الطلبات</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Aging Stock (Boda'a Rakeda) */}
                                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col h-[400px]">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-rose-100 text-rose-600"><Clock size={18} /></div>
                                        <h3 className="font-bold text-slate-800">البضاعة الراكدة (لم تُباع)</h3>
                                      </div>
                                      <div className="text-xs font-semibold text-slate-500">
                                        (أكثر من 30 يوماً / أكثر كمية)
                                      </div>
                                    </div>
                                    <div className="overflow-x-auto flex-1 custom-scrollbar border-t border-transparent">
                                      <table className="w-full text-sm text-right whitespace-nowrap">
                                        <thead className="bg-white sticky top-0 shadow-sm z-10 text-slate-500">
                                          <tr>
                                            <th className="py-3 px-4 font-semibold">الصنف</th>
                                            <th className="py-3 px-4 font-semibold">تاريخ آخر بيع</th>
                                            <th className="py-3 px-4 font-semibold text-rose-600">كم يوم راكد؟</th>
                                            <th className="py-3 px-4 font-semibold">كمية محتجزة</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {inventoryMetrics.agingStock.map((item) => (
                                            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                              <td className="py-3 px-4">
                                                <div className="font-semibold text-slate-800 truncate max-w-[150px]" title={item.name}>
                                                  {item.name || '—'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.barcode}</div>
                                              </td>
                                              <td className="py-3 px-4 font-mono text-slate-500 text-xs">
                                                {item.lastSoldDate ? new Date(item.lastSoldDate).toLocaleDateString() : '—'}
                                              </td>
                                              <td className="py-3 px-4 font-black text-rose-600 font-mono text-center">
                                                {item.daysSinceLastSale ? `${item.daysSinceLastSale} يوم` : 'غير مباع'}
                                              </td>
                                              <td className="py-3 px-4 font-bold text-slate-700 font-mono text-center bg-slate-50/50">
                                                {item.qty}
                                              </td>
                                            </tr>
                                          ))}
                                          {(!inventoryMetrics.agingStock || inventoryMetrics.agingStock.length === 0) && (
                                            <tr>
                                              <td colSpan={4} className="py-12 text-center text-slate-400">لا توجد بضاعة راكدة حالياً</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                {/* التنبؤ الذكي بالمخزون: معدل سرعة البيع + تاريخ النفاد المتوقع */}
                                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-sky-100 text-sky-600"><TrendingUp size={18} /></div>
                                      <h3 className="font-bold text-slate-800">التنبؤ الذكي بالمخزون</h3>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-500">
                                      معدل البيع (آخر 30 يوماً) — طلب بضاعة قبل النفاد
                                    </div>
                                  </div>
                                  <div className="overflow-x-auto max-h-[400px] custom-scrollbar border-t border-transparent">
                                    <table className="w-full text-sm text-right whitespace-nowrap">
                                      <thead className="bg-white sticky top-0 shadow-sm z-10 text-slate-500">
                                        <tr>
                                          <th className="py-3 px-4 font-semibold">الصنف</th>
                                          <th className="py-3 px-4 font-semibold">الباركود</th>
                                          <th className="py-3 px-4 font-semibold">الكمية الحالية</th>
                                          <th className="py-3 px-4 font-semibold text-sky-600">معدل البيع (قطعة/يوم)</th>
                                          <th className="py-3 px-4 font-semibold text-amber-600">ينفد بعد (تقريباً)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {inventoryMetrics.depletionForecast && inventoryMetrics.depletionForecast.length > 0 ? (
                                          inventoryMetrics.depletionForecast.map((item) => {
                                            const velocityStr = item.salesVelocity < 0.1 ? item.salesVelocity.toFixed(2) : item.salesVelocity.toFixed(1);
                                            const isUrgent = item.daysUntilDepletion != null && item.daysUntilDepletion <= 14;
                                            const rowClass = isUrgent ? 'bg-amber-50 border-r-4 border-amber-400' : '';
                                            return (
                                              <tr key={item.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${rowClass}`}>
                                                <td className="py-3 px-4 font-semibold text-slate-800 truncate max-w-[180px]" title={item.name}>{item.name || '—'}</td>
                                                <td className="py-3 px-4 font-mono text-slate-500">{item.barcode || '—'}</td>
                                                <td className="py-3 px-4 font-bold font-mono text-slate-700">{item.qty}</td>
                                                <td className="py-3 px-4 font-mono text-sky-600 font-semibold">{velocityStr}</td>
                                                <td className="py-3 px-4 font-mono font-bold text-amber-700">
                                                  ≈ {item.daysUntilDepletion} يوم
                                                  {isUrgent && <span className="mr-1 text-[10px] text-amber-600">(يُنصح بالطلب قريباً)</span>}
                                                </td>
                                              </tr>
                                            );
                                          })
                                        ) : (
                                          <tr>
                                            <td colSpan={5} className="py-12 text-center text-slate-400">لا توجد بيانات تنبؤ (مطلوب مبيعات في آخر 30 يوماً)</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* قائمة المخزون للتجرد — تنبيهات بصرية: أحمر للنفاد، برتقالي لأوشك على النفاد */}
                                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600"><FileText size={18} /></div>
                                      <h3 className="font-bold text-slate-800">قائمة المخزون للتجرد الفعلي</h3>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                                      {items.length} صنف — استخدم تصدير Excel أو طباعة PDF أعلاه
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
                                    <table className="w-full text-sm text-right whitespace-nowrap">
                                      <thead className="bg-white sticky top-0 shadow-sm z-10 text-slate-500">
                                        <tr>
                                          <th className="py-3 px-4 font-semibold">الباركود</th>
                                          <th className="py-3 px-4 font-semibold">الاسم</th>
                                          <th className="py-3 px-4 font-semibold">الفئة</th>
                                          <th className="py-3 px-4 font-semibold">الكمية</th>
                                          <th className="py-3 px-4 font-semibold">السعر</th>
                                          <th className="py-3 px-4 font-semibold text-sky-600">معدل البيع/يوم</th>
                                          <th className="py-3 px-4 font-semibold text-amber-600">ينفد بعد</th>
                                          <th className="py-3 px-4 font-semibold">الحالة</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(items || []).map((i, idx) => {
                                          const qty = Number(i.stock_count ?? i.stock ?? 0);
                                          const insight = inventoryInsights && i.barcode ? inventoryInsights[i.barcode] : null;
                                          const velocity = insight?.salesVelocity ?? 0;
                                          const daysUntilDepletion = velocity > 0 && qty > 0 ? Math.ceil(qty / velocity) : null;
                                          const isOut = qty === 0;
                                          const isLow = qty >= 1 && qty <= 5;
                                          const rowClass = isOut ? 'bg-red-50 border-r-4 border-red-400' : isLow ? 'bg-amber-50 border-r-4 border-amber-400' : '';
                                          const status = isOut ? 'نفد' : isLow ? 'أوشك على النفاد' : 'متوفر';
                                          const velocityStr = velocity > 0 ? (velocity < 0.1 ? velocity.toFixed(2) : velocity.toFixed(1)) : '—';
                                          const depletionStr = daysUntilDepletion != null ? `≈ ${daysUntilDepletion} يوم` : '—';
                                          return (
                                            <tr key={i.barcode ? String(i.barcode) : `row-${idx}`} className={`border-b border-slate-50 hover:opacity-90 transition-colors ${rowClass}`}>
                                              <td className="py-2.5 px-4 font-mono text-slate-600">{i.barcode || '—'}</td>
                                              <td className={`py-2.5 px-4 font-semibold ${isOut ? 'text-red-800' : isLow ? 'text-amber-800' : 'text-slate-800'}`}>{i.name || '—'}</td>
                                              <td className="py-2.5 px-4 text-slate-600">{i.group || '—'}</td>
                                              <td className={`py-2.5 px-4 font-bold font-mono ${isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-slate-700'}`}>{qty}</td>
                                              <td className="py-2.5 px-4 font-mono text-slate-500">₪{Math.round(i.priceAfterDiscount ?? i.price ?? 0)}</td>
                                              <td className="py-2.5 px-4 font-mono text-sky-600 text-xs">{velocityStr}</td>
                                              <td className="py-2.5 px-4 font-mono text-amber-700 text-xs font-semibold">{depletionStr}</td>
                                              <td className="py-2.5 px-4">
                                                {isOut ? (
                                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-lg">نفد</span>
                                                ) : isLow ? (
                                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg"><AlertTriangle size={12} /> أوشك على النفاد</span>
                                                ) : (
                                                  <span className="text-slate-600 font-medium">{status}</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        {(!items || items.length === 0) && (
                                          <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-400">لا توجد أصناف</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>
                ) : mode === 'sales_hub' ? (
                  /* Sales Area Hub — لمستخدم البيع (customer) نعرض فقط: بدء البيع + الفواتير المعلقة */
                  <div className={`flex flex-col gap-6 items-stretch justify-center pt-10 pb-20 px-4 animate-fade-in max-w-5xl mx-auto ${userRole === 'customer' ? 'md:flex-row max-w-2xl' : 'md:flex-row'}`}>
                    {/* POS Choice */}
                    <div className="flex-1 bg-white rounded-3xl p-8 shadow-xl shadow-indigo-900/5 border border-indigo-50 relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                      <div className="absolute top-0 right-0 p-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6 shadow-inner">
                          <ShoppingCart size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-3">شاشة البيع (POS)</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed">
                          واجهة المبيعات السريعة والعملية لإنشاء طلبات وفواتير جديدة للعملاء مباشرة.
                        </p>
                        <div className="mt-auto space-y-4">
                          <button
                            onClick={() => { setMode('order'); setShowOrderPanel(false); }}
                            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                          >
                            <span>بدء البيع</span>
                            <ChevronRight size={20} />
                          </button>

                          {/* Held Orders Button Moved Here */}
                          <button
                            onClick={() => setShowHeldOrdersModal(true)}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border-2 ${heldOrders.length > 0
                              ? 'border-amber-500 text-amber-600 bg-amber-50 hover:bg-amber-100 shadow-sm'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                          >
                            <span>الفواتير المعلقة</span>
                            {heldOrders.length > 0 && (
                              <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-amber-500 text-white text-xs tabular-nums shadow-sm">
                                {heldOrders.length}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Catalog + Offers — تظهر فقط لغير مستخدم البيع (مشرف / أدمن) */}
                    {userRole !== 'customer' && (
                      <>
                        {/* Catalog Choice */}
                        <div className="flex-1 bg-white rounded-3xl p-8 shadow-xl shadow-rose-900/5 border border-rose-50 relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                          <div className="absolute top-0 right-0 p-32 bg-rose-50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-6 shadow-inner">
                              <Grid size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3">كتالوج المنتجات</h3>
                            <p className="text-slate-500 mb-8 leading-relaxed">
                              استعرض كتالوج المنتجات كاملاً مع الأسعار والتفاصيل للعملاء دون إدخال الطلب.
                            </p>
                            <div className="mt-auto">
                              <button
                                onClick={() => { setMode('catalog'); setShowOrderPanel(false); }}
                                className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-lg shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
                              >
                                <span>فتح الكتالوج</span>
                                <ChevronRight size={20} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Offers Choice */}
                        <div className="flex-1 bg-white rounded-3xl p-8 shadow-xl shadow-amber-900/5 border border-amber-50 relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                          <div className="absolute top-0 right-0 p-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-6 shadow-inner">
                              <Gift size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3">العروض الخاصة</h3>
                            <p className="text-slate-500 mb-8 leading-relaxed">
                              استعرض العروض الحصرية والباقات الترويجية لتقديم أفضل الخصومات للعملاء.
                            </p>
                            <div className="mt-auto">
                              <button
                                onClick={() => { setMode('offers'); setShowOrderPanel(false); }}
                                className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
                              >
                                <span>استعراض العروض</span>
                                <ChevronRight size={20} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : mode === 'offers' ? (
                  /* Custom Offers - اختيار المنتجات للعروض */
                  <div className="space-y-8 animate-fade-in">
                    {/* زر الرجوع لشاشة البيع لمستخدم البيع */}
                    {userRole === 'customer' && (
                      <div className="flex justify-start">
                        <button
                          onClick={() => setMode('order')}
                          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-all border border-indigo-600"
                        >
                          <Package size={20} />
                          <span>الرجوع لشاشة البيع</span>
                          <ChevronRight size={18} className="rtl:rotate-180" />
                        </button>
                      </div>
                    )}

                    {userRole === 'admin' && editingOffer && (
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          onClick={() => setEditingOffer(null)}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium"
                        >
                          إلغاء
                        </button>
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

                        {/* خانة إظهار العرض على شاشة البيع */}
                        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-white/70 border border-amber-200">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editingOffer.showOnSalesScreen !== false}
                              onChange={(e) => setEditingOffer((p) => ({ ...p, showOnSalesScreen: e.target.checked }))}
                              className="w-5 h-5 rounded border-2 border-amber-400 text-amber-600 focus:ring-amber-400"
                            />
                            <span className="text-sm font-bold text-slate-800">إظهار هذا العرض على شاشة البيع</span>
                          </label>
                          <span className="text-xs text-slate-500">عند التفعيل يظهر العرض لمستخدم البيع في قائمة العروض</span>
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
                                      className={`flex items-center gap-4 p-4 rounded-xl border shadow-sm ${it ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}
                                    >
                                      {it && getImage(it) ? (
                                        <img src={getImage(it)} alt="" loading="lazy" className="w-14 h-14 object-contain rounded-lg" />
                                      ) : (
                                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center">
                                          <Package size={24} className="text-slate-400" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold break-words leading-tight ${it ? 'text-slate-800' : 'text-red-600 italic'}`}>
                                          {it?.name || `Removed Product (${entry.barcode})`}
                                        </p>
                                        <p className="text-xs text-slate-500">الكمية: {entry.quantity} {it ? '' : '(Not Available)'}</p>
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

                    {/* Offer cards - عرض للعملاء والأدمن (للبيع: فقط العروض المفعّلة لشاشة البيع) */}
                    <div className="flex flex-col gap-12 max-w-7xl mx-auto px-4 sm:px-6">
                      {(userRole === 'customer'
                        ? customOffers.filter(offer => offer.items && offer.items.length > 0 && offer.showOnSalesScreen !== false)
                        : customOffers.filter(offer => offer.items && offer.items.length > 0)
                      ).map((offer) => (
                        <OfferCard
                          key={offer.id}
                          offer={offer}
                          getItemByBarcode={getItemByBarcode}
                          getImage={getImage}
                          getImageFallback={getImageFallback}
                          getStockStatus={getStockStatus}
                          getLogoUrl={getLogoUrl}
                          getDisplayGroup={getDisplayGroup}
                          userRole={userRole}
                          onEdit={startEditOffer}
                          onDelete={deleteOffer}
                          onItemClick={setSelectedItem}
                          addOfferToOrder={(o) => {
                            o.items.forEach((e) => {
                              const it = getItemByBarcode(e.barcode);
                              if (it) addToOrder({ ...it, priceAfterDiscount: e.isFree ? 0 : e.offerPrice }, e.quantity);
                            });
                            if (userRole === 'admin') { setShowOrderPanel(true); setMode('order'); }
                          }}
                        />
                      ))}
                    </div>

                    {customOffers.length === 0 && !editingOffer && (
                      <div className="text-center py-20 rounded-3xl bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] border-2 border-dashed border-slate-200">
                        <Gift size={64} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">لا توجد عروض حالياً</p>
                      </div>
                    )}
                  </div>
                ) : mode === 'settings' ? (
                  /* Settings View */
                  <div className="max-w-3xl mx-auto py-10 px-4 animate-fade-in flex flex-col gap-6">

                    {/* Offers Management */}
                    <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-2">
                        <Gift size={32} />
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">إدارة العروض الخاصة</h2>
                      <p className="text-slate-500 max-w-sm mx-auto text-sm">
                        إنشاء وإدارة الباقات الترويجية والعروض للعملاء.
                      </p>

                      {userRole === 'admin' ? (
                        <button
                          onClick={() => { setMode('offers'); createNewOffer(); }}
                          className="mt-4 flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          <Plus size={20} /> إنشاء عرض جديد
                        </button>
                      ) : (
                        <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold flex items-center gap-2">
                          <Lock size={14} /> خاصية إدارية
                        </div>
                      )}
                    </div>

                    {/* App Sorting Management */}
                    <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
                      <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-2">
                          <PieChartIcon size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800">إدارة ترتيب المنتجات</h2>
                        <p className="text-slate-500 max-w-sm mx-auto text-sm">
                          تحديد ترتيب ظهور المنتجات في الصفحة الرئيسية لكل فئة.
                        </p>

                        {userRole === 'admin' ? (
                          <div className="flex flex-col sm:flex-row gap-4 mt-6">
                            <button
                              onClick={() => { setSortingCategory('electrical'); setIsSortingMode(true); }}
                              className="px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-3 shrink-0 ring-1 ring-indigo-500/50"
                            >
                              <Zap size={20} />
                              <span>ترتيب الأجهزة الكهربائية</span>
                            </button>
                            <button
                              onClick={() => { setSortingCategory('household'); setIsSortingMode(true); }}
                              className="px-6 py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-lg shadow-sky-500/30 hover:shadow-sky-500/40 transition-all flex items-center justify-center gap-3 shrink-0 ring-1 ring-sky-500/50"
                            >
                              <UtensilsCrossed size={20} />
                              <span>ترتيب الأدوات المنزلية</span>
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold flex items-center gap-2">
                            <Lock size={14} /> خاصية إدارية
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Brand Logos Management */}
                    <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
                      <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center text-purple-500 mb-2">
                          <Tag size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800">إدارة شعارات الماركات (Logos)</h2>
                        <p className="text-slate-500 max-w-sm mx-auto text-sm">
                          رفع وتعديل شعارات الماركات التجارية لتظهر بدلاً من الأسماء النصية على بطاقات المنتجات.
                        </p>
                        
                        {userRole === 'admin' ? (
                          <>
                            {!showBrandLogosDetails ? (
                              <button
                                type="button"
                                onClick={() => setShowBrandLogosDetails(true)}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-purple-100 text-purple-700 font-bold hover:bg-purple-200 transition-colors border border-purple-200"
                              >
                                <ChevronRight size={20} className="rtl:rotate-180" />
                                الدخول إلى إدارة الشعارات
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowBrandLogosDetails(false)}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm"
                                >
                                  <ChevronRight size={18} className="rtl:rotate-180" />
                                  إخفاء التفاصيل
                                </button>
                                <div className="w-full mt-2 text-right border-t border-slate-100 pt-6">
                                  {logosLoading ? (
                                    <div className="flex justify-center py-4"><Loader2 size={28} className="animate-spin text-purple-500" /></div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {[...new Set(items.map(i => i.group).filter(Boolean))].sort().map(groupName => {
                                          const existingLogo = getLogoUrl(groupName);
                                          return (
                                              <div key={groupName} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                                                  <div className="flex items-center justify-between w-full h-12">
                                                      <p className="font-bold text-slate-800 text-sm max-w-[60%] shrink-0 break-words" title={groupName} dir="auto">{groupName}</p>
                                                      {existingLogo ? (
                                                          <div className="h-10 w-20 bg-white rounded-lg p-1 border border-slate-200 flex items-center justify-center shrink-0">
                                                              <img src={existingLogo} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                                                          </div>
                                                      ) : (
                                                          <div className="h-10 w-20 bg-slate-200 rounded-lg flex items-center justify-center text-[10px] text-slate-500 font-bold shrink-0">بدون لوجو</div>
                                                      )}
                                                  </div>
                                                  <div className="flex items-center gap-2 mt-2 w-full">
                                                      <label className="flex-1 cursor-pointer bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center justify-center gap-1 transition-colors py-2">
                                                          <Upload size={14} />
                                                          <span>رفع</span>
                                                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                              if(e.target.files && e.target.files[0]) {
                                                                  await uploadLogo(groupName, e.target.files[0]);
                                                              }
                                                          }} />
                                                      </label>
                                                      {existingLogo && (
                                                          <button onClick={() => removeLogo(groupName)} className="bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 shadow-sm transition-colors flex items-center justify-center gap-1 py-2 px-3">
                                                              <Trash2 size={14} /> حذف
                                                          </button>
                                                      )}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold flex items-center gap-2">
                            <Lock size={14} /> خاصية إدارية
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Session Management + إدارة المستخدمين وكلمات المرور */}
                    <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
                      <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-2">
                          <Power size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800">إدارة الجلسات</h2>
                        <p className="text-slate-500 max-w-sm mx-auto text-sm">
                          تسجيل خروج الجميع، وإدارة المستخدمين وتغيير كلمات المرور من هنا.
                        </p>

                        {userRole === 'admin' ? (
                          <>
                            {!showSessionManagementDetails ? (
                              <button
                                type="button"
                                onClick={() => setShowSessionManagementDetails(true)}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-100 text-rose-700 font-bold hover:bg-rose-200 transition-colors border border-rose-200"
                              >
                                <ChevronRight size={20} className="rtl:rotate-180" />
                                الدخول إلى إدارة الجلسات والحسابات
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowSessionManagementDetails(false)}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm"
                                >
                                  <ChevronRight size={18} className="rtl:rotate-180" />
                                  إخفاء التفاصيل
                                </button>
                                <button
                              onClick={handleForceLogoutAll}
                              className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              <Power size={20} /> تسجيل خروج جميع الأجهزة
                            </button>

                            {/* إدارة المستخدمين وكلمات المرور */}
                            <div className="w-full mt-8 text-right border-t border-slate-100 pt-6">
                              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Users size={20} /> إدارة المستخدمين وكلمات المرور
                              </h3>
                              {salesUsersLoading ? (
                                <div className="flex items-center justify-center py-8"><Loader2 size={28} className="animate-spin text-rose-500" /></div>
                              ) : salesUsers.length === 0 ? (
                                <p className="text-slate-500 text-sm py-4">لا يوجد جدول مستخدمين. أنشئ جدول <code className="bg-slate-100 px-1 rounded">sales_users</code> في Supabase (انظر USERS_SUPABASE.md) ثم حدّث الصفحة.</p>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="w-full text-sm text-right">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="px-4 py-3 font-bold text-slate-600">اسم المستخدم</th>
                                        <th className="px-4 py-3 font-bold text-slate-600">الدور</th>
                                        <th className="px-4 py-3 font-bold text-slate-600">تغيير كلمة المرور</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {salesUsers.map((u) => (
                                        <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                          <td className="px-4 py-3 font-semibold text-slate-800">{u.username}</td>
                                          <td className="px-4 py-3 text-slate-600">{u.role === 'admin' ? 'أدمن' : u.role === 'supervisor' ? 'مشرف' : 'بيع'}</td>
                                          <td className="px-4 py-3">
                                            <button
                                              type="button"
                                              onClick={() => { setEditingPasswordUser(u); setNewPassword(''); }}
                                              className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-bold hover:bg-indigo-200 transition-colors text-xs flex items-center gap-1"
                                            >
                                              <Lock size={14} /> تغيير
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold flex items-center gap-2">
                            <Lock size={14} /> خاصية إدارية
                          </div>
                        )}
                      </div>
                    </div>

                    {/* مودال تغيير كلمة المرور */}
                    {editingPasswordUser && userRole === 'admin' && createPortal(
                      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl" onClick={() => { setEditingPasswordUser(null); setNewPassword(''); }}>
                        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                          <h3 className="text-lg font-bold text-slate-800 mb-2">تغيير كلمة المرور — {editingPasswordUser.username}</h3>
                          <p className="text-slate-500 text-sm mb-4">أدخل كلمة المرور الجديدة (يُستحسن 6 أحرف أو أكثر).</p>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="كلمة المرور الجديدة"
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 mb-4"
                            autoFocus
                          />
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => { setEditingPasswordUser(null); setNewPassword(''); }}
                              className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              disabled={passwordUpdateLoading || newPassword.length < 3}
                              onClick={() => handleUpdateUserPassword(editingPasswordUser.id, newPassword)}
                              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {passwordUpdateLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                              حفظ
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}

                  </div>
                ) : mode === 'inventory' ? (
                  /* شاشة المخزون — تصميم حديث مثل Sales Area */
                  <div className="flex flex-col pt-10 pb-20 px-4 animate-fade-in max-w-5xl mx-auto">
                    <div className="bg-white rounded-3xl shadow-xl shadow-amber-900/5 border border-amber-50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                      <div className="relative z-10 p-6 sm:p-8 flex flex-col gap-6">
                        {/* Header مثل Sales Area */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                              <Package size={32} />
                            </div>
                            <div>
                              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">المخزون</h1>
                              <p className="text-slate-500 mt-1">عرض الكميات، تعديل السعر والكمية، وتصدير قائمة للتجرد</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => { openAddModal(); }}
                              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={20} />
                              <span>إضافة صنف</span>
                              <ChevronRight size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={handleExportInventory}
                              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-amber-200 bg-white text-amber-700 font-bold hover:bg-amber-50 transition-all"
                            >
                              <FileDown size={20} />
                              تصدير Excel
                            </button>
                            {userRole === 'admin' && (
                            <button
                              type="button"
                              onClick={handleSyncStockFromSheet}
                              disabled={syncingStock}
                              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-emerald-200 bg-white text-emerald-700 font-bold hover:bg-emerald-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {syncingStock ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                              {syncingStock ? 'جاري المزامنة...' : 'مزامنة المخزون من Sheet'}
                            </button>
                            )}
                          </div>
                        </div>

                        {/* مسح الباركود — شريط واحد واضح */}
                        <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4">
                          <label className="block text-sm font-bold text-slate-600 mb-2">مسح الباركود</label>
                          <input
                            ref={inventoryBarcodeScanRef}
                            type="text"
                            dir="ltr"
                            placeholder="امسح الباركود أو أدخل الرقم واضغط Enter"
                            className="w-full max-w-md pr-4 pl-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-base font-mono"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                openEditPanelFromBarcode(e.target.value);
                              }
                            }}
                          />
                        </div>

                        {/* فلترة وبحث — في صف واحد أنيق */}
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="relative flex-1">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              value={inventorySearch}
                              onChange={(e) => setInventorySearch(e.target.value)}
                              placeholder="بحث بالاسم أو الباركود أو الفئة..."
                              className="w-full pr-12 pl-5 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-base"
                            />
                          </div>
                          <select
                            value={inventoryCategoryFilter}
                            onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                            className="px-5 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 font-semibold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-base min-w-[180px]"
                          >
                            <option value="">كل الفئات</option>
                            {allGroups.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-3 cursor-pointer px-5 py-3 rounded-xl border-2 border-slate-200 bg-white hover:border-amber-200 transition-colors shrink-0">
                            <input type="checkbox" checked={inventoryLowStockOnly} onChange={(e) => setInventoryLowStockOnly(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                            <span className="font-semibold text-slate-700">المخزون المنخفض فقط (≤5)</span>
                          </label>
                        </div>

                        {/* جدول المخزون — داخل بطاقة فرعية */}
                        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                          {loading ? (
                            <div className="p-16 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-amber-500" /></div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-right border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="px-3 py-4 font-bold text-slate-600 w-16">صورة</th>
                                    <th className="px-4 py-4 font-bold text-slate-600">الباركود</th>
                                    <th className="px-4 py-4 font-bold text-slate-600">الاسم</th>
                                    <th className="px-4 py-4 font-bold text-slate-600">الفئة</th>
                                    <th className="px-4 py-4 font-bold text-slate-600">الكمية</th>
                                    <th className="px-4 py-4 font-bold text-slate-600">السعر</th>
                                    <th className="px-4 py-4 font-bold text-slate-600">الحالة</th>
                                    <th className="px-4 py-4 font-bold text-slate-600">تعديل</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredInventoryItems.length === 0 ? (
                                    <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500 font-medium">{inventorySearch || inventoryLowStockOnly || inventoryCategoryFilter ? 'لا توجد نتائج مطابقة للبحث أو الفلتر.' : 'لا توجد أصناف في المخزون.'}</td></tr>
                                  ) : (
                                    filteredInventoryItems.map((item) => {
                                      const status = getStockStatus(item);
                                      const qty = Number(item.stock_count ?? item.stock ?? 0);
                                      const qtyColor = qty === 0 ? 'text-rose-600' : qty <= 5 ? 'text-amber-600' : 'text-slate-700';
                                      const qtyBg = qty === 0 ? 'bg-rose-100 text-rose-700' : qty <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      const imgSrc = getImage(item) || getImageFallback(item);
                                      return (
                                        <tr key={item.id} className="border-b border-slate-50 hover:bg-amber-50/30 transition-colors">
                                          <td className="px-3 py-2 align-middle">
                                            <div className="inv-thumb w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                                              {imgSrc ? (
                                                <>
                                                  <img src={imgSrc} alt="" className="w-full h-full object-contain" loading="lazy" onError={(e) => { e.target.style.display = 'none'; const wrap = e.target.closest('.inv-thumb'); if (wrap) wrap.querySelector('.inv-thumb-fallback')?.classList.remove('hidden'); }} />
                                                  <span className="inv-thumb-fallback hidden absolute inset-0 flex items-center justify-center bg-slate-100"><Package size={24} className="text-slate-300" /></span>
                                                </>
                                              ) : (
                                                <Package size={24} className="text-slate-300" />
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 font-mono text-slate-600">{item.barcode || '—'}</td>
                                          <td className="px-4 py-3 font-semibold text-slate-800">{item.name || '—'}</td>
                                          <td className="px-4 py-3 text-slate-600 font-bold">{getDisplayGroup(item) || '—'}</td>
                                          <td className="px-4 py-3"><span className={`font-bold ${qtyColor}`}>{qty}</span></td>
                                          <td className="px-4 py-3 font-semibold text-slate-700">₪{Math.round(item.priceAfterDiscount ?? item.price ?? 0)}</td>
                                          <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${qtyBg}`}>{status}</span></td>
                                          <td className="px-4 py-3"><button type="button" onClick={() => { setEditingItem(item); setShowCatalogPanel(true); }} className="px-4 py-2 rounded-xl bg-amber-100 text-amber-800 font-bold hover:bg-amber-200 transition-colors text-sm">تعديل</button></td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* سجل التغييرات — بطاقة فرعية بنفس الأسلوب */}
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/30 overflow-hidden">
                          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <Clock size={18} className="text-amber-500" />
                              سجل التغييرات
                            </h3>
                            <button type="button" onClick={fetchActivityLogs} disabled={activityLogsLoading} className="text-sm font-semibold text-amber-600 hover:text-amber-700 disabled:opacity-50 flex items-center gap-1">
                              {activityLogsLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                              تحديث
                            </button>
                          </div>
                          <div className="overflow-x-auto max-h-56 overflow-y-auto">
                            {activityLogsLoading && activityLogs.length === 0 ? (
                              <div className="p-8 flex justify-center"><Loader2 size={28} className="animate-spin text-amber-500" /></div>
                            ) : activityLogs.length === 0 ? (
                              <p className="p-6 text-center text-slate-500 text-sm">لا توجد سجلات. سيظهر هنا من غيّر السعر أو الكمية بعد إنشاء جدول activity_logs في Supabase.</p>
                            ) : (
                              <table className="w-full text-right border-collapse text-sm">
                                <thead>
                                  <tr className="bg-white/80 border-b border-slate-100">
                                    <th className="px-3 py-2 font-bold text-slate-600">الوقت</th>
                                    <th className="px-3 py-2 font-bold text-slate-600">المستخدم</th>
                                    <th className="px-3 py-2 font-bold text-slate-600">الباركود</th>
                                    <th className="px-3 py-2 font-bold text-slate-600">التغيير</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activityLogs.map((log) => (
                                    <tr key={log.id} className="border-b border-slate-50 hover:bg-white/50">
                                      <td className="px-3 py-2 text-slate-600 font-mono text-xs">{log.created_at ? new Date(log.created_at).toLocaleString('ar-SA') : '—'}</td>
                                      <td className="px-3 py-2 font-semibold text-slate-700">{log.username || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-slate-600">{log.entity_id || '—'}</td>
                                      <td className="px-3 py-2 text-slate-700">{log.description || log.field_name || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : mode === 'customers' ? (
                  /* Customers View — واجهة حديثة + عرض الأسماء بالكامل */
                  <div className="max-w-5xl mx-auto py-6 sm:py-10 px-4 animate-fade-in flex flex-col gap-8" dir="rtl">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                          <Users size={32} className="text-white" />
                        </div>
                        <div>
                          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">العملاء</h1>
                          <p className="text-slate-500 text-sm sm:text-base mt-1">إدارة بيانات العملاء ونقاط الولاء</p>
                        </div>
                      </div>
                      {customersSectionTab === 'directory' && (
                        <button
                          onClick={() => setEditingCustomer({ company_name: '', name: '', phone: '', address: '', customer_number: '', loyalty_points: 0, total_spent: 0, outstanding_debt: 0, credit_limit: null })}
                          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all duration-300"
                        >
                          <Plus size={22} /> إضافة عميل
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-slate-100/80 border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setCustomersSectionTab('directory')}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${customersSectionTab === 'directory' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        <Users size={18} /> دليل العملاء
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomersSectionTab('ar')}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${customersSectionTab === 'ar' ? 'bg-white text-emerald-700 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        <Wallet size={18} /> ذمم العملاء (A/R)
                      </button>
                    </div>

                    {customersSectionTab === 'ar' ? (
                      <CustomerArPanel
                        customers={customers}
                        loading={customersLoading}
                        search={arSearch}
                        onSearchChange={setArSearch}
                        filter={arFilter}
                        onFilterChange={setArFilter}
                        onOpenLedger={(c) => {
                          setArLedgerCustomer(c);
                          fetchArLedger(c.id);
                        }}
                      />
                    ) : null}

                    {customersSectionTab === 'directory' && (
                    <>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={customersPageSearch}
                        onChange={(e) => setCustomersPageSearch(e.target.value)}
                        placeholder="بحث بالاسم أو اسم الشركة أو رقم الهاتف..."
                        className="w-full pr-12 pl-5 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-base"
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
                      {customersLoading ? (
                        <div className="p-16 flex items-center justify-center">
                          <Loader2 size={40} className="animate-spin text-indigo-500" />
                        </div>
                      ) : (
                        <div className="p-4 sm:p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            {filteredCustomersPage.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setViewingCustomer(c)}
                                className="text-right w-full rounded-2xl border-2 border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-lg hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 flex items-center justify-center flex-shrink-0 text-xl font-black group-hover:from-indigo-200 group-hover:to-violet-200 transition-colors">
                                    {((c.company_name || c.name) || '؟').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-900 text-base sm:text-lg break-words leading-snug">
                                      {c.company_name || c.name || '—'}
                                    </p>
                                    {c.company_name && c.name && (
                                      <p className="text-slate-600 text-sm break-words leading-snug mt-1">
                                        {c.name}
                                      </p>
                                    )}
                                    <p className="text-slate-500 text-sm font-mono mt-2">{c.phone || '—'}</p>
                                    <div className="flex flex-wrap gap-2 mt-4">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">
                                        {c.loyalty_points ?? 0} نقطة
                                      </span>
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                        ₪{Number(c.total_spent ?? 0).toFixed(0)}
                                      </span>
                                      {Number(c.outstanding_debt ?? 0) > 0 && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold">
                                          رصيد سابق ₪{Number(c.outstanding_debt).toFixed(0)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 flex-shrink-0 mt-1 transition-colors" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {!customersLoading && filteredCustomersPage.length === 0 && (
                        <div className="p-16 text-center">
                          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Users size={40} className="text-slate-400" />
                          </div>
                          <p className="text-slate-600 font-medium">
                            {(customersPageSearch || '').trim() ? 'لا يوجد عملاء مطابقون للبحث' : 'لا يوجد عملاء مسجلون بعد'}
                          </p>
                          <p className="text-slate-400 text-sm mt-1">
                            {(customersPageSearch || '').trim() ? 'جرّب كلمات أخرى أو أضف عميلاً جديداً' : 'أضف عميلاً جديداً باستخدام الزر "إضافة عميل" أعلاه'}
                          </p>
                        </div>
                      )}
                    </div>
                    </>
                    )}

                    {/* مودال عرض تفاصيل العميل — النقر على عميل يفتح بياناته، ومنها يمكن التعديل */}
                    {viewingCustomer && createPortal(
                      <div className="fixed inset-0 z-[110] flex items-center justify-center min-h-screen w-full p-4 bg-slate-900/60 backdrop-blur-md" dir="rtl" onClick={() => setViewingCustomer(null)}>
                        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-300/50 border border-slate-200/80 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 to-white">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 text-2xl font-black">
                                {((viewingCustomer.company_name || viewingCustomer.name) || '؟').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-xl font-black text-slate-800 break-words">{viewingCustomer.company_name || viewingCustomer.name || '—'}</h3>
                                {viewingCustomer.company_name && viewingCustomer.name && <p className="text-slate-500 text-sm break-words mt-0.5">{viewingCustomer.name}</p>}
                                <p className="text-slate-500 text-sm font-mono mt-0.5">{viewingCustomer.phone || '—'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                            <div className="grid gap-4">
                              <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">اسم الشركة</p>
                                <p className="text-slate-800 font-semibold">{viewingCustomer.company_name || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">اسم التاجر</p>
                                <p className="text-slate-800 font-semibold">{viewingCustomer.name || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">رقم الهاتف</p>
                                <p className="text-slate-800 font-mono font-semibold">{viewingCustomer.phone || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">العنوان</p>
                                <p className="text-slate-800 font-medium">{viewingCustomer.address || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">رقم العميل (في الشركة)</p>
                                <p className="text-slate-800 font-medium">{viewingCustomer.customer_number || '—'}</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="rounded-xl bg-amber-50 p-4 border border-amber-100">
                                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">نقاط الولاء</p>
                                  <p className="text-amber-800 font-black text-lg">{viewingCustomer.loyalty_points ?? 0}</p>
                                </div>
                                <div className="rounded-xl bg-slate-100 p-4 border border-slate-200">
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">إجمالي المشتريات</p>
                                  <p className="text-slate-800 font-black text-lg">₪{Number(viewingCustomer.total_spent ?? 0).toFixed(0)}</p>
                                </div>
                                <div className="rounded-xl bg-rose-50 p-4 border border-rose-200">
                                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">الرصيد السابق</p>
                                  <p className="text-rose-800 font-black text-lg">
                                    {Number(viewingCustomer.outstanding_debt ?? 0) > 0
                                      ? `₪${Number(viewingCustomer.outstanding_debt).toFixed(0)}`
                                      : 'لا يوجد'}
                                  </p>
                                </div>
                              </div>
                              {viewingCustomer.credit_limit != null && Number(viewingCustomer.credit_limit) > 0 && (
                                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">سقف الذمم المسموح</p>
                                  <p className="text-emerald-900 font-black text-lg">₪{Number(viewingCustomer.credit_limit).toFixed(0)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-6 py-4 flex flex-wrap gap-3 justify-start border-t border-slate-100 bg-slate-50/50">
                            <button
                              onClick={() => {
                                setEditingCustomer({
                                  id: viewingCustomer.id,
                                  company_name: viewingCustomer.company_name || '',
                                  name: viewingCustomer.name || '',
                                  phone: viewingCustomer.phone || '',
                                  address: viewingCustomer.address || '',
                                  customer_number: viewingCustomer.customer_number || '',
                                  loyalty_points: viewingCustomer.loyalty_points ?? 0,
                                  total_spent: viewingCustomer.total_spent ?? 0,
                                  outstanding_debt: viewingCustomer.outstanding_debt ?? 0,
                                  credit_limit: viewingCustomer.credit_limit ?? null,
                                });
                                setViewingCustomer(null);
                              }}
                              className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all"
                            >
                              <Pencil size={18} /> تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setArLedgerCustomer(viewingCustomer);
                                fetchArLedger(viewingCustomer.id);
                                setViewingCustomer(null);
                                setCustomersSectionTab('ar');
                              }}
                              className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all"
                            >
                              <Wallet size={18} /> سجل الذمم
                            </button>
                            <button
                              onClick={() => {
                                deleteCustomerFromPage(viewingCustomer.id);
                                setViewingCustomer(null);
                              }}
                              className="px-5 py-3 rounded-xl border-2 border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-all flex items-center gap-2"
                            >
                              <Trash2 size={18} /> حذف
                            </button>
                            <button
                              onClick={() => setViewingCustomer(null)}
                              className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-all"
                            >
                              إغلاق
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}

                    {/* Modal إضافة/تعديل عميل — يُعرض في جذر الصفحة ليكون دائماً في منتصف الشاشة */}
                    {editingCustomer && createPortal(
                      <div className="fixed inset-0 z-[110] flex items-center justify-center min-h-screen w-full p-4 bg-slate-900/60 backdrop-blur-md" dir="rtl" onClick={() => !customersLoading && setEditingCustomer(null)}>
                        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-300/50 border border-slate-200/80 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                          {/* Header بنفس أسلوب الصفحة */}
                          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 to-white">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                {editingCustomer.id ? <Pencil size={24} /> : <Users size={24} />}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-800">{editingCustomer.id ? 'تعديل العميل' : 'إضافة عميل جديد'}</h3>
                                <p className="text-slate-500 text-sm mt-0.5">{editingCustomer.id ? 'تحديث بيانات العميل ونقاط الولاء' : 'أدخل بيانات العميل الجديد'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 text-right">اسم الشركة</label>
                              <input
                                value={editingCustomer.company_name || ''}
                                onChange={e => setEditingCustomer(prev => ({ ...prev, company_name: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                                placeholder="اسم الشركة"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 text-right">اسم التاجر</label>
                              <input
                                value={editingCustomer.name || ''}
                                onChange={e => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                                placeholder="اسم التاجر"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 text-right">رقم الهاتف *</label>
                              <input
                                type="tel"
                                value={editingCustomer.phone || ''}
                                onChange={e => {
                                  const val = toEnglishDigits(e.target.value);
                                  setEditingCustomer(prev => ({ ...prev, phone: val }));
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right font-mono"
                                placeholder="05xxxxxxxx"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 text-right">العنوان</label>
                              <input
                                value={editingCustomer.address || ''}
                                onChange={e => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                                placeholder="العنوان"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 text-right">رقم العميل (في الشركة)</label>
                              <input
                                value={editingCustomer.customer_number || ''}
                                onChange={e => setEditingCustomer(prev => ({ ...prev, customer_number: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                                placeholder="رقم العميل في الشركة"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 text-right">نقاط الولاء</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={editingCustomer.loyalty_points ?? 0}
                                  onChange={e => setEditingCustomer(prev => ({ ...prev, loyalty_points: +e.target.value || 0 }))}
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 text-right">إجمالي المشتريات ₪</label>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={editingCustomer.total_spent ?? 0}
                                  onChange={e => setEditingCustomer(prev => ({ ...prev, total_spent: +e.target.value || 0 }))}
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 text-right">الرصيد السابق (دين غير مدفوع) ₪</label>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={editingCustomer.outstanding_debt ?? 0}
                                onChange={e => setEditingCustomer(prev => ({ ...prev, outstanding_debt: +e.target.value || 0 }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 text-right">سقف الذمم المسموح (₪) — اختياري</label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={editingCustomer.credit_limit == null ? '' : editingCustomer.credit_limit}
                                onChange={e => {
                                  const v = e.target.value;
                                  setEditingCustomer(prev => ({
                                    ...prev,
                                    credit_limit: v === '' ? null : Math.max(0, +v || 0),
                                  }));
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                                placeholder="اتركه فارغاً إذا لا يوجد سقف"
                              />
                            </div>
                          </div>
                          <div className="px-6 py-4 flex gap-3 justify-start border-t border-slate-100 bg-slate-50/50">
                            <button
                              onClick={() => saveCustomerFromPage(editingCustomer)}
                              disabled={customersLoading || !(editingCustomer.phone || '').trim()}
                              className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all"
                            >
                              {customersLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                              حفظ
                            </button>
                            <button
                              onClick={() => !customersLoading && setEditingCustomer(null)}
                              className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-all"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}

                    {arLedgerCustomer && createPortal(
                      <div className="fixed inset-0 z-[115] flex items-center justify-center min-h-screen w-full p-4 bg-slate-900/60 backdrop-blur-md" dir="rtl" onClick={() => !arPaymentSubmitting && setArLedgerCustomer(null)}>
                        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-l from-emerald-50/90 to-white flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-lg font-black text-slate-900 truncate">سجل الذمم</h3>
                              <p className="text-sm text-slate-600 truncate">{arLedgerCustomer.company_name || arLedgerCustomer.name}</p>
                              <p className="text-xs font-mono text-slate-500">{arLedgerCustomer.phone}</p>
                            </div>
                            <button type="button" onClick={() => !arPaymentSubmitting && setArLedgerCustomer(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X size={22} /></button>
                          </div>
                          <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/50">
                            <span className="inline-flex px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-sm font-bold">
                              رصيد: ₪{Number(arLedgerCustomer.outstanding_debt ?? 0).toFixed(2)}
                            </span>
                            {arLedgerCustomer.credit_limit != null && Number(arLedgerCustomer.credit_limit) > 0 && (
                              <span className="inline-flex px-3 py-1.5 rounded-xl bg-slate-200 text-slate-800 text-sm font-bold">
                                سقف: ₪{Number(arLedgerCustomer.credit_limit).toFixed(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                            {arLedgerLoading ? (
                              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={36} /></div>
                            ) : arLedgerEntries.length === 0 ? (
                              <p className="text-center text-slate-500 text-sm py-8">لا توجد حركات مسجّلة بعد. يمكنك أدناه تسجيل <strong className="text-slate-700">دين سابق</strong>، أو يُضاف تلقائياً عند البيع بـ «آجل / ذمم» أو «تقسيط».</p>
                            ) : (
                              <ul className="space-y-2">
                                {arLedgerEntries.map((row) => (
                                  <li key={row.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <div>
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${row.entry_type === 'debit' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                        {row.entry_type === 'debit' ? 'عليه' : 'دفعة'}
                                      </span>
                                      <p className="text-sm text-slate-700 mt-1">{row.description || '—'}</p>
                                      <p className="text-[11px] text-slate-400 font-mono">{row.created_at ? new Date(row.created_at).toLocaleString('ar-SA') : ''}</p>
                                    </div>
                                    <div className="font-black text-slate-900" dir="ltr">
                                      {row.entry_type === 'debit' ? '+' : '−'}₪{Number(row.amount_ils || 0).toFixed(2)}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="px-6 py-4 border-t border-slate-100 space-y-4 bg-white">
                            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
                              <p className="text-sm font-bold text-rose-900 flex items-center gap-2">
                                <AlertTriangle size={18} className="shrink-0 text-rose-600" />
                                تسجيل دين سابق (قبل النظام أو ترحيل)
                              </p>
                              <p className="text-xs text-rose-800/90 leading-relaxed">يُضاف للرصيد ويظهر في السجل كـ «عليه». استخدمه للزبائن الذين كان عليهم دين قبل استخدام التطبيق.</p>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={arOpeningAmount}
                                onChange={(e) => setArOpeningAmount(e.target.value)}
                                placeholder="مبلغ الدين السابق ₪"
                                className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white font-mono text-left"
                                dir="ltr"
                                disabled={arPaymentSubmitting}
                              />
                              <input
                                type="text"
                                value={arOpeningNotes}
                                onChange={(e) => setArOpeningNotes(e.target.value)}
                                placeholder="ملاحظة (مثلاً: فاتورة قديمة، رقم مرجعي)"
                                className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white text-right"
                                disabled={arPaymentSubmitting}
                              />
                              <button
                                type="button"
                                onClick={submitArOpeningDebit}
                                disabled={arPaymentSubmitting}
                                className="w-full py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {arPaymentSubmitting ? <Loader2 size={20} className="animate-spin" /> : <TrendingUp size={20} />}
                                حفظ الدين السابق
                              </button>
                            </div>

                            <div className="border-t border-slate-200 pt-4 space-y-3">
                              <p className="text-sm font-bold text-slate-700">تسجيل دفعة (يقلّل الرصيد)</p>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={arPaymentAmount}
                                onChange={(e) => setArPaymentAmount(e.target.value)}
                                placeholder="المبلغ ₪"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-mono text-left"
                                dir="ltr"
                                disabled={arPaymentSubmitting}
                              />
                              <input
                                type="text"
                                value={arPaymentNotes}
                                onChange={(e) => setArPaymentNotes(e.target.value)}
                                placeholder="ملاحظة (اختياري)"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-right"
                                disabled={arPaymentSubmitting}
                              />
                              <button
                                type="button"
                                onClick={submitArPayment}
                                disabled={arPaymentSubmitting}
                                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {arPaymentSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Banknote size={20} />}
                                حفظ الدفعة
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                ) : mode === 'submitted' ? null : (
                  <div className="space-y-12">
                    {productSections.map(({ title, items: sorted, color, icon: Icon }) => {
                      if (sorted.length === 0) return null;
                      return (
                        <section key={title} className="animate-fade-in">
                          <div className="flex items-center gap-3 mb-6 ml-2">
                            <div className={`p-2 rounded-xl ${color === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-sky-100 text-sky-600'}`}>
                              <Icon size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200/50 text-slate-500">{sorted.length}</span>
                          </div>

                          <motion.div
                            layout
                            initial="hidden"
                            animate="show"
                            variants={{
                              hidden: { opacity: 0 },
                              show: {
                                opacity: 1,
                                transition: {
                                  staggerChildren: 0.05
                                }
                              }
                            }}
                            className="product-grid"
                          >
                            <AnimatePresence mode="popLayout">
                              {sorted.map((item) => {
                                const stockStatus = getStockStatus(item);
                                const isOutOfStock = stockStatus === 'Out of Stock';
                                return (
                                <motion.div
                                  layout
                                  initial="hidden"
                                  animate="show"
                                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                  variants={{
                                    hidden: { opacity: 0, scale: 0.95, y: 10 },
                                    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                                  }}
                                  whileHover={isOutOfStock ? {
                                    boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                                    transition: { duration: 0.2, ease: 'easeOut' }
                                  } : {
                                    y: -6,
                                    boxShadow: "0 8px 16px rgba(0,0,0,0.04), 0 24px 48px -12px rgba(0,0,0,0.08)",
                                    transition: { duration: 0.2, ease: "easeOut" }
                                  }}
                                  key={item.id}
                                  className={`group flex flex-col h-full cursor-pointer transition-colors rounded-3xl overflow-hidden border glass-card shadow-lg ${
                                    isOutOfStock
                                      ? 'opacity-[0.82] saturate-[0.65] border-slate-300/80 bg-slate-100/40 ring-1 ring-slate-200/60 hover:shadow-md'
                                      : 'border-white/80 hover:shadow-xl'
                                  }`}
                                  onDoubleClick={(e) => { if (!e.target.closest('button')) setSelectedItem(item); }}
                                >
                                  {getDisplayGroup(item) && (
                                    <div className="absolute top-0 left-3 z-10 -mt-1">
                                      {getLogoUrl(getDisplayGroup(item)) ? (
                                        <div className="shadow-sm rounded-lg py-1 px-1.5 flex items-center justify-center bg-white/95 border border-slate-100">
                                          <img src={getLogoUrl(getDisplayGroup(item))} alt={getDisplayGroup(item)} loading="lazy" className="h-6 object-contain" />
                                        </div>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm uppercase tracking-wide bg-white/95 text-slate-600 border border-slate-100">
                                          {getDisplayGroup(item)}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div className={`aspect-[4/3] p-6 relative flex items-center justify-center bg-gradient-to-b ${isOutOfStock ? 'from-slate-200/60 to-slate-200/90' : 'from-slate-50/80 to-slate-100/80'}`}>
                                    {getImage(item) ? (
                                      <img
                                        src={getImage(item)}
                                        alt={item.name}
                                        loading="lazy"
                                        decoding="async"
                                        className={`w-full h-full object-contain filter drop-shadow-xl transition-transform duration-500 ${isOutOfStock ? 'grayscale-[0.35] opacity-90' : 'group-hover:scale-110'}`}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-full h-full flex items-center justify-center ${getImage(item) ? 'hidden' : ''}`}>
                                      <Package size={48} className="text-slate-200" />
                                    </div>

                                    {stockStatus === 'Out of Stock' ? (
                                      <div className="absolute top-2 right-2 z-10">
                                        <div className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                                          Out of Stock
                                        </div>
                                      </div>
                                    ) : stockStatus === 'Low Stock' ? (
                                      <div className="absolute top-2 right-2 z-10 animate-pulse">
                                        <div className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-1 border border-amber-400/50" dir="ltr">
                                          <Flame size={12} className="text-amber-200" fill="currentColor" />
                                          <span>Last {item.stock_count} units</span>
                                        </div>
                                      </div>
                                    ) : null}

                                    {/* Offer Toggle (Admin Only in Offers Mode) */}
                                    {mode === 'offers' && userRole === 'admin' && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleOffer(item); }}
                                        className={`absolute top-2 right-2 z-20 p-1.5 rounded-full shadow-md transition-all ${item.isOffer ? 'bg-amber-500 text-white' : 'bg-white text-slate-300 hover:bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]'}`}
                                        title="Toggle Offer"
                                      >
                                        <Star size={16} fill={item.isOffer ? 'currentColor' : 'none'} />
                                      </button>
                                    )}

                                    {/* Offer Badge (Visible when not in Offers mode or for non-admins) */}
                                    {item.isOffer && (mode !== 'offers' || userRole !== 'admin') && (
                                      <div className={`absolute right-2 z-10 ${stockStatus === 'Out of Stock' ? 'top-10' : stockStatus === 'Low Stock' ? 'top-10' : 'top-2'}`}>
                                        <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                                          <Star size={10} fill="currentColor" /> Offer
                                        </span>
                                      </div>
                                    )}

                                    {userRole === 'admin' && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); triggerCardImageUpload(item); }}
                                        className="absolute bottom-3 right-3 p-2 rounded-full shadow-md transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                      >
                                        {uploading && cardUploadItemRef.current?.id === item.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                      </button>
                                    )}

                                  </div>

                                  <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                      <div className="flex flex-col mb-1 min-h-[2.5em] justify-start w-full text-right" dir="rtl">
                                        {item.productType ? (
                                          <h3 className="text-sm font-bold leading-tight text-slate-800">
                                            {item.productType}
                                          </h3>
                                        ) : (
                                          <h3 className="text-sm font-bold italic text-slate-400">
                                          </h3>
                                        )}
                                        <p className="text-xs font-medium line-clamp-1 mt-0.5 text-slate-500" title={item.name}>
                                          {item.name || 'Unknown Product'}
                                        </p>
                                      </div>
                                      {userRole === 'admin' && mode !== 'order' && (
                                        <div className="flex flex-col gap-1 -mt-1 -mr-1">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openNameEditModal(item); }}
                                            className={`p-1.5 rounded-lg shrink-0 transition-colors text-slate-400 hover:text-indigo-600 hover:bg-indigo-50`}
                                            title="Quick Edit Name"
                                          >
                                            <FileText size={16} />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openTypeEditModal(item); }}
                                            className={`p-1.5 rounded-lg shrink-0 transition-colors text-slate-400 hover:text-indigo-600 hover:bg-indigo-50`}
                                            title="Quick Edit Product Type"
                                          >
                                            <Tag size={16} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-sm font-mono mb-1.5 text-slate-500">{item.barcode}</p>
                                    <div className="flex items-center gap-1 mb-4">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-sm shadow-emerald-500/20 border border-white/20">
                                        <ShieldCheck size={10} className="opacity-90" />
                                        {item.warranty || '1 Year Warranty'}
                                      </span>
                                    </div>

                                    <div className="mt-auto space-y-3">
                                      <div className="flex items-end justify-between">
                                        <div>
                                          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Price</p>
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

                                      <div className="flex items-center justify-between pt-3 border-t relative border-slate-100">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-bold uppercase text-slate-400">Stock</span>
                                          {stockStatus === 'Out of Stock' ? (
                                            <span className="text-xs font-bold text-red-500">Out of Stock</span>
                                          ) : stockStatus === 'Low Stock' ? (
                                            <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                                              {item.stock_count} <span className="text-[10px]">Last 5 units</span>
                                            </span>
                                          ) : (
                                            <span className="text-xs font-bold text-emerald-500">Available</span>
                                          )}
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] font-bold uppercase text-slate-400">Box</span>
                                          <span className="text-xs font-bold text-slate-700">{item.box || '-'}</span>
                                        </div>

                                        {/* Restock Request Button Overlay */}
                                        {item.stock_count > 0 && item.stock_count <= 2 && (
                                          <div className="absolute top-[-36px] right-0 z-20">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                console.log(`[RESTOCK REQUEST] Item ID: ${item.id}, Barcode: ${item.barcode}, Name: ${item.name}, Current Stock: ${item.stock_count}`);
                                                // Alert the user that it worked locally for now
                                                const originalText = e.target.innerText;
                                                e.target.innerHTML = '✓ تم الطلب';
                                                e.target.className = 'bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-200 transition-all shadow-sm flex items-center gap-1';
                                                setTimeout(() => {
                                                  e.target.innerHTML = originalText;
                                                  e.target.className = 'bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-200 transition-all shadow-sm flex items-center gap-1 active:scale-95';
                                                }, 3000);
                                              }}
                                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-200 transition-all shadow-sm flex items-center gap-1 active:scale-95"
                                              title="إرسال طلب تزويد للمخزن"
                                            >
                                              <span>📦</span> طلب تزويد
                                            </button>
                                          </div>
                                        )}
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
                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                            : 'bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] text-slate-600 hover:bg-rose-50 hover:text-rose-600 border border-slate-200'
                                            }`}
                                        >
                                            {catalogItems.some((i) => i.id === item.id) ? (
                                            <><Trash2 size={16} /> إزالة</>
                                          ) : (
                                            <><FileText size={16} /> الكتالوج</>
                                          )}
                                        </button>
                                      ) : (
                                        <motion.button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const clientX = e.clientX;
                                            const clientY = e.clientY;
                                            playSuccess();
                                            setAddToCartPressedId(item.id);
                                            handleOpenQuantityModal(item, { clientX, clientY });
                                          }}
                                          whileTap={{ scale: 0.95 }}
                                          className={`w-full py-3 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 min-h-[44px] transition-all duration-200 ease-out ${
                                            addToCartPressedId === item.id
                                              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-orange-500/30'
                                              : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-700 hover:shadow-xl hover:shadow-slate-600/20 hover:-translate-y-0.5 active:bg-slate-800 active:shadow-inner'
                                          }`}
                                        >
                                          <motion.span
                                            key={addToCartPressedId === item.id ? 'added' : 'default'}
                                            initial={addToCartPressedId === item.id ? { opacity: 0, scale: 0.85 } : false}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                            className="flex items-center justify-center gap-2"
                                          >
                                            <ShoppingCart size={18} className="shrink-0" />
                                            <span>Add to Cart</span>
                                          </motion.span>
                                        </motion.button>
                                      )}
                                    </div>
                                  </div>

                                  {userRole === 'admin' && (
                                    <div className="absolute top-3 right-3 flex gap-1 transform translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                                      <button onClick={(e) => { e.stopPropagation(); openTypeEditModal(item); }} className="p-2 rounded-lg shadow bg-white/90 text-indigo-600 hover:bg-indigo-50" title="تعديل نوع المنتج"><Tag size={14} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); handlePrintQR(item); }} className="p-2 rounded-lg shadow bg-white/90 text-slate-600 hover:text-indigo-600" title="طباعة QR"><Smartphone size={14} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="p-2 rounded-lg shadow bg-white/90 text-slate-600 hover:text-indigo-600" title="تعديل"><FileText size={14} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete(item.barcode); }} className="p-2 rounded-lg shadow bg-white/90 text-slate-600 hover:text-rose-600" title="حذف"><Trash2 size={14} /></button>
                                    </div>
                                  )}
                                </motion.div>
                              );
                              })}
                            </AnimatePresence>
                          </motion.div>
                        </section>
                      );
                    })}
                  </div>
                )}

                {hasMore && items.length > 0 && (
                  <div ref={loadMoreRef} className="flex justify-center py-12">
                    {loadingMore && <div className="w-10 h-10 border-4 rounded-full animate-spin border-indigo-200 border-t-indigo-500"></div>}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {
        !showOrderPanel && !showCartOverlay && mode === 'order' && (
          <motion.button
            ref={cartIconRef}
            onClick={() => setShowCartOverlay(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 py-4 px-4 rounded-2xl bg-gradient-to-b from-orange-500 to-amber-600 text-white shadow-xl shadow-orange-500/30 border border-white/20 hover:shadow-orange-500/40 transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingCart size={20} strokeWidth={2.25} className="text-white" />
            </div>
            <motion.span
              className="text-xs font-bold text-white/90 leading-none inline-block"
              animate={cartPing ? { scale: [1, 1.5, 1] } : {}}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {orderLines.length} {orderLines.length === 1 ? 'قطعة' : 'قطع'}
            </motion.span>
            <span className="text-sm font-black tracking-tight leading-none" dir="ltr">
              ₪{orderSubtotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </motion.button>
        )
      }

      {/* Glassmorphism Slide-over Cart — سلة جانبية مع صور مصغرة وعداد كمية */}
      <AnimatePresence>
        {showCartOverlay && mode === 'order' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[48] bg-black/25 backdrop-blur-sm"
              onClick={() => setShowCartOverlay(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-[min(360px,100vw)] z-[49] flex flex-col overflow-hidden border-l border-white/40 shadow-2xl bg-white/70 backdrop-blur-2xl"
            >
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200/60 bg-white/50">
                <h3 className="text-lg font-black text-slate-800">سلة المشتريات</h3>
                <button
                  onClick={() => setShowCartOverlay(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {orderLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <ShoppingCart className="text-slate-400" size={28} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-bold text-slate-600">السلة فارغة</p>
                    <p className="text-xs text-slate-500 mt-1">أضف منتجات من القائمة</p>
                  </div>
                ) : (
                  orderLines.map((o) => (
                    <motion.div
                      key={o.id}
                      layout
                      className="flex items-center gap-3 p-3 rounded-2xl bg-white/80 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200/60 flex items-center justify-center">
                        {getImage(o.item) ? (
                          <img src={getImage(o.item)} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                        ) : (
                          <Package size={20} className="text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {o.customName || o.name || o.item?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">{o.item?.barcode}</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200/80 p-1 shrink-0" dir="ltr">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => changeOrderQtyBy(o.id, -1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-orange-500 transition-colors"
                          aria-label="تقليل"
                        >
                          <Minus size={16} strokeWidth={2.5} />
                        </motion.button>
                        <span className="w-8 text-center text-sm font-black text-slate-800 tabular-nums">
                          {o.qty ?? 0}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => changeOrderQtyBy(o.id, 1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-orange-500 transition-colors"
                          aria-label="زيادة"
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </motion.button>
                      </div>
                      <button
                        onClick={() => removeFromOrder(o.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                        aria-label="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
              {orderLines.length > 0 && (
                <div className="flex-shrink-0 p-4 border-t border-slate-200/60 bg-white/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600">المجموع</span>
                    <span className="text-lg font-black text-slate-900" dir="ltr">₪{orderSubtotal.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => { setShowCartOverlay(false); setShowOrderPanel(true); }}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 hover:shadow-orange-500/30 transition-all active:scale-[0.98]"
                  >
                    تفاصيل وإتمام الطلب
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {
        !showCatalogPanel && mode === 'catalog' && (
          <button
            onClick={() => setShowCatalogPanel(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 py-8 px-3 rounded-l-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-lg font-bold shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 border-l-2 border-white/20"
            style={{ writingMode: 'vertical-rl' }}
          >
            عرض الكتالوج
          </button>
        )
      }

      {
        showOrderPanel && mode === 'order' && (
          <aside className="pos-panel flex-shrink-0 min-h-0 w-[min(520px,100vw)] sm:w-[500px] flex flex-col overflow-hidden border-l shadow-2xl z-50 transition-all duration-500 backdrop-blur-xl bg-white/95 border-slate-200 text-slate-800">
            {/* Header / Tabs */}
            <div className="flex-shrink-0 z-20">
              <div className="flex items-center justify-between px-8 py-6">
                <div>
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-800">
                    <div className="flex items-center gap-1">
                      <span>Maslamani</span><span className="text-orange-500 font-light">POS</span>
                    </div>
                    {isOnline ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full" title="متصل بالإنترنت">
                        <Cloud size={12} className="fill-emerald-400/50" />
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700`}
                        title="أوفلاين — المنتجات من IndexedDB إن وُجدت؛ الطلبات تُحفظ محلياً وتُزامن عند عودة الإنترنت"
                      >
                        <CloudOff size={12} />
                      </div>
                    )}
                  </h2>
                </div>
                <button onClick={() => setShowOrderPanel(false)} className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:rotate-90 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800">
                  <X size={24} />
                </button>
              </div>

              {/* السلة — تفاصيل العميل تُعرض عند اتمام الطلبية */}
              <div className="px-8 pb-4">
                <div className="flex w-full items-center justify-center gap-2 py-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25 text-sm font-bold">
                  <span>Items</span>
                  <span className="min-w-[1.75rem] text-center px-2 py-0.5 rounded-lg bg-white/20 text-[11px]">{orderLines.length}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar transition-colors duration-500 bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9]/50">

              <div className="p-4 space-y-3">
                  {orderLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-32 text-center px-10 rounded-2xl border bg-white border-slate-100">
                      <ShoppingCart className="mb-6 text-slate-400" size={64} strokeWidth={1.5} />
                      <p className="text-lg font-bold mb-2 text-slate-800">No items in cart</p>
                      <p className="text-sm text-slate-500">Click products to add</p>
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
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Box {box}</span>
                              <div className="h-px flex-1 bg-slate-200"></div>
                            </div>
                          )}
                          <SwipeToDeleteItem onDelete={() => removeFromOrder(o.id)}>
                            <div className={`group relative rounded-3xl p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${(o.item?.stock_count === 1 || (o.qty > 0 && o.qty === o.item?.stock_count))
                              ? 'bg-amber-50 border border-amber-300 shadow-[0_4px_20px_-4px_rgba(251,191,36,0.3)] hover:shadow-[0_8px_30px_-4px_rgba(251,191,36,0.4)]'
                              : 'bg-white hover:bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] border border-slate-100 hover:border-slate-200 hover:shadow-slate-200/50'
                              }`}>
                              {(o.item?.stock_count === 1 || (o.qty > 0 && o.qty === o.item?.stock_count)) && (
                                <div className="absolute -top-3 -right-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md shadow-amber-500/20 flex items-center gap-1 animate-pulse border-2 border-white">
                                  <span>⚠️</span> آخر قطعة بالمخزون!
                                </div>
                              )}
                              <div className="flex gap-4">
                                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border relative pointer-events-none ${(o.item?.stock_count === 1 || (o.qty > 0 && o.qty === o.item?.stock_count)) ? 'bg-amber-100/50 border-amber-200' : 'bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] border-slate-100'
                                  }`}>
                                  {getImage(o.item) ? (
                                    <img src={getImage(o.item)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
                                  ) : (
                                    <Package size={24} className={(o.item?.stock_count === 1 || (o.qty > 0 && o.qty === o.item?.stock_count)) ? "text-amber-400" : "text-slate-300"} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-3">
                                    <input
                                      className="text-base font-bold leading-snug w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-orange-500 outline-none transition-colors placeholder-slate-400 text-slate-800"
                                      value={o.customName || o.name || o.item?.name || ''}
                                      onChange={(e) => setOrderLineName(o.id, e.target.value)}
                                      placeholder="Product Name"
                                      onPointerDown={(e) => e.stopPropagation()}
                                    />
                                    <motion.button whileTap={{ scale: 0.8, rotate: 10 }} onClick={() => removeFromOrder(o.id)} onPointerDown={(e) => e.stopPropagation()} className="transition-colors bg-transparent p-2.5 rounded-xl -mt-2 -mr-2 flex-shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50">
                                      <Trash2 size={16} />
                                    </motion.button>
                                  </div>
                                  <p className={`text-[10px] font-mono mt-1 flex items-center gap-2 pointer-events-none text-slate-500`}>
                                    <span className="px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">{o.item?.barcode}</span>
                                    {o.item?.group && <span className="text-slate-400 font-bold">• {o.item?.group}</span>}
                                  </p>

                                  <div className="flex flex-col sm:flex-row items-stretch gap-4 mt-6 notranslate" dir="rtl">
                                    {/* Qty Control */}
                                    <div className="flex flex-col justify-center items-center rounded-2xl p-1.5 border shadow-sm shrink-0 w-14 bg-white border-slate-200" dir="ltr" onPointerDown={(e) => e.stopPropagation()}>
                                      <motion.button
                                        whileTap={{ scale: 0.8 }}
                                        onClick={() => changeOrderQtyBy(o.id, 1)}
                                        className={`w-full h-8 flex items-center justify-center rounded-lg transition-colors text-slate-400 hover:text-indigo-600 hover:bg-indigo-50`}
                                      >
                                        <Plus size={18} strokeWidth={3} />
                                      </motion.button>
                                      <input
                                        className="w-full bg-transparent text-center text-lg font-black outline-none my-1 text-slate-700"
                                        value={o.qty ?? ''}
                                        onChange={(e) => setOrderQty(o.id, e.target.value)}
                                      />
                                      <motion.button
                                        whileTap={{ scale: 0.8 }}
                                        onClick={() => changeOrderQtyBy(o.id, -1)}
                                        className={`w-full h-8 flex items-center justify-center rounded-lg transition-colors text-slate-400 hover:text-indigo-600 hover:bg-indigo-50`}
                                      >
                                        <Minus size={18} strokeWidth={3} />
                                      </motion.button>
                                    </div>

                                    {/* Pricing Squares Grid */}
                                    <div className="flex-1 w-full grid grid-cols-2 gap-3" onPointerDown={(e) => e.stopPropagation()}>

                                      {/* Card 1: Consumer Price */}
                                      <div className="rounded-2xl p-3 border flex flex-col items-center justify-center gap-1 text-center shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/80 border-slate-200/60">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>سعر المستهلك</span>
                                        <span className="font-bold text-sm sm:text-base font-mono text-slate-600">₪{getLineOriginalPrice(o)}</span>
                                      </div>

                                      {/* Card 2: Discount */}
                                      <div className={`rounded-2xl p-3 border flex flex-col items-center justify-center gap-1 text-center shadow-sm transition-all ${getLineDiscountPercent(o) > 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200' : 'bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] border-slate-100 opacity-60'}`}>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>نسبة الخصم</span>
                                        <span className={`font-bold text-sm sm:text-base font-mono ${getLineDiscountPercent(o) > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>{getLineDiscountPercent(o)}%</span>
                                      </div>

                                      {/* Card 3: Price After Discount (Input) */}
                                      <div className="rounded-2xl p-2 border shadow-sm flex flex-col items-center justify-center gap-1 text-center relative focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-white border-slate-200 hover:border-indigo-200">
                                        <span className="text-[10px] font-bold text-indigo-500/80 uppercase tracking-wider">بعد الخصم</span>
                                        <div className="flex items-center justify-center gap-0.5" dir="ltr">
                                          <span className={`font-bold text-xs mb-0.5 text-slate-400`}>₪</span>
                                          <input
                                            type="number"
                                            className={`w-20 bg-transparent text-center font-black outline-none text-lg sm:text-lg text-slate-800`}
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
                          </SwipeToDeleteItem>
                        </div>
                      );
                    })
                  )}
                </div>
            </div>

            {/* Discount Section */}
            {orderLines.length > 0 && (
              <div className="flex-shrink-0 border-t p-4 z-10 transition-colors duration-500 bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold mr-1 text-slate-500">نوع الخصم إضافي</label>
                    <select
                      value={orderInfo.discountType || ''}
                      onChange={(e) => {
                        setOrderInfoField('discountType', e.target.value);
                        if (!e.target.value) setOrderInfoField('discountValue', '');
                      }}
                      className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 bg-white border-slate-200 text-slate-700 focus:border-indigo-500 focus:ring-indigo-100"
                    >
                      <option value="">لا يوجد خصم</option>
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="amount">مبلغ مالي (₪)</option>
                    </select>
                  </div>
                    {orderInfo.discountType && (
                    <div className="flex-1 space-y-1.5 animate-fade-in">
                      <label className="text-[10px] font-bold mr-1 text-slate-500">قيمة الخصم</label>
                      <input
                        type="number"
                        min="0"
                        step={orderInfo.discountType === 'percentage' ? "1" : "0.5"}
                        value={orderInfo.discountValue}
                        onChange={(e) => setOrderInfoField('discountValue', e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 font-mono text-left bg-white border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-100"
                        placeholder="0"
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sticky Order Totals */}
            <div className="flex-shrink-0 backdrop-blur-xl border-t p-8 z-20 transition-colors duration-500 bg-white/90 border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">

              {/* Discount Lines */}
              {finalOrderDiscount > 0 && (
                <div className="flex flex-col gap-1 mb-4 border-b pb-4 border-slate-100">
                  <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                    <span>المجموع قبل الخصم:</span>
                    <span className="font-mono text-slate-700">₪{orderSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-emerald-500 font-bold">
                    <span>الخصم الإضافي:</span>
                    <span className="font-mono">-₪{finalOrderDiscount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end mb-5">
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-1 text-slate-500">
                    <span>{finalOrderDiscount > 0 ? "Final Total" : "Total Amount"}</span>
                  </p>
                  <p className="text-4xl font-black tracking-tighter drop-shadow-sm text-slate-800">
                    <span className="text-2xl mr-1 text-slate-400">₪</span>
                    <span>{itemTotalWithTax(orderLines).toFixed(2)}</span>
                  </p>

                  {(() => {
                    const totalOriginalPrice = orderLines.reduce((sum, o) => sum + (getLineOriginalPrice(o) * (o.qty || 0)), 0);
                    const totalSavings = Math.max(0, totalOriginalPrice - itemTotalWithTax(orderLines));
                    return totalSavings > 0 ? (
                      <p className="text-emerald-500 text-[11px] font-bold mt-1.5 flex items-center justify-start gap-1 animate-fade-in" dir="rtl">
                        <span className="inline-block animate-bounce">🎉</span>
                        لقد وفرت {totalSavings.toFixed(2)} ₪ في هذا الطلب!
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-widest mb-1 text-slate-500">Items Included</p>
                  <div className="inline-flex items-center px-3 py-1 rounded-lg border bg-slate-100 border-slate-200">
                    <span className="text-lg font-bold text-slate-700">{orderLines.length}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleOpenPdfOrder} disabled={orderLines.length === 0} className="py-4 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-rose-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                  <FileDown size={20} /> <span>PDF Preview</span>
                </button>
                <button type="button" onClick={handleOpenSaveExportModal} className="py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/20 text-white font-bold rounded-2xl border transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                  <span>اتمام الطلبية</span>
                </button>
              </div>

              <div className="flex justify-between mt-4 px-1 opacity-90 hover:opacity-100 transition-opacity">
                <button onClick={clearOrder} className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-widest transition-colors flex items-center gap-2">
                  <Trash2 size={12} /> <span>Clear Order</span>
                </button>
                <button
                  type="button"
                  onClick={handleHoldOrder}
                  className="text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100"
                >
                  <Clock size={12} /> <span>تعليق الفاتورة</span>
                </button>
              </div>
            </div>
          </aside>
        )
      }

      {/* معلومات الطلبية — قبل اتمام الطلبية */}
      {showOrderSubmitModal && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-submit-modal-title"
          onClick={() => setShowOrderSubmitModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[min(92vh,880px)] flex flex-col border border-slate-100 overflow-hidden"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
              <h2 id="order-submit-modal-title" className="text-xl font-black text-slate-900">
                معلومات الطلبية
              </h2>
              <button
                type="button"
                onClick={() => setShowOrderSubmitModal(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-4 space-y-4">
              {/* 1. التلفون */}
              <div className="space-y-1.5 relative">
                <label className="text-[11px] font-bold text-slate-500 mr-1 flex items-center justify-between">
                  <span>التلفون <span className="text-rose-500">*</span></span>
                  {orderInfo.phone && currentCustomerByPhone && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                      <Star size={10} fill="currentColor" />
                      {currentCustomerByPhone.loyalty_points || 0} نقطة
                    </span>
                  )}
                </label>
                {orderInfo.phone && currentCustomerByPhone && (() => {
                  const debt = Number(currentCustomerByPhone.outstanding_debt ?? 0);
                  if (debt <= 0) return null;
                  return (
                    <div className="mb-1.5 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 flex items-center justify-between text-[11px] text-rose-700 font-bold">
                      <span>تنبيه: هذا العميل لديه رصيد سابق غير مدفوع بقيمة ₪{debt.toFixed(0)}</span>
                    </div>
                  );
                })()}
                <input
                  value={orderInfo.phone}
                  onChange={(e) => {
                    const val = toEnglishDigits(e.target.value);
                    setOrderInfoField('phone', val);
                    setCustomerSearch(val);
                    setShowCustomerPredictions(true);
                    if (val.length >= 7) {
                      const exactMatch = customers.find(c => c.phone === val);
                      if (exactMatch) {
                        setOrderInfo(prev => ({
                          ...prev,
                          merchantName: prev.merchantName || exactMatch.name || '',
                          companyName: exactMatch.company_name || exactMatch.name || prev.companyName || '',
                          address: prev.address || exactMatch.address || '',
                          customerNumber: prev.customerNumber || exactMatch.customer_number || '',
                        }));
                        fetchCustomerInsights(exactMatch.phone);
                      } else {
                        setCustomerInsights(null);
                      }
                    }
                  }}
                  onFocus={() => setShowCustomerPredictions(true)}
                  onBlur={() => setTimeout(() => setShowCustomerPredictions(false), 200)}
                  className="w-full bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm font-mono text-left"
                  placeholder="05..."
                  dir="ltr"
                  lang="en"
                  autoComplete="off"
                />
                {showCustomerPredictions && customerSearch.length >= 2 && (
                  <div className="absolute z-[270] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {filteredCustomersByPhone.length === 0 ? (
                      <div className="p-3 bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] border-b border-slate-100 text-center">
                        <p className="text-sm text-slate-500 mb-2">زبون جديد (لم يسبق تسجيله)</p>
                        <button
                          type="button"
                          onPointerDown={(e) => { e.preventDefault(); }}
                          onClick={(e) => {
                            e.preventDefault();
                            setQuickAddCustomerData({
                              companyName: orderInfo.companyName || '',
                              name: orderInfo.merchantName || orderInfo.companyName || '',
                              phone: customerSearch,
                              address: orderInfo.address || '',
                              customerNumber: orderInfo.customerNumber || ''
                            });
                            setShowQuickAddCustomer(true);
                            setShowCustomerPredictions(false);
                          }}
                          className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2 px-4 rounded-xl transition-colors shadow-sm text-sm border border-indigo-200"
                        >
                          ➕ إضافة زبون جديد سريعاً
                        </button>
                      </div>
                    ) : (
                      filteredCustomersByPhone.map(cust => (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setOrderInfo(prev => ({
                              ...prev,
                              phone: cust.phone,
                              merchantName: cust.name || prev.merchantName,
                              companyName: cust.company_name || cust.name || prev.companyName,
                              address: cust.address || prev.address,
                              customerNumber: cust.customer_number || prev.customerNumber,
                            }));
                            setCustomerSearch(cust.phone);
                            setShowCustomerPredictions(false);
                            fetchCustomerInsights(cust.phone);
                          }}
                          className="p-3 hover:bg-orange-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between transition-colors"
                        >
                          <div className="text-right flex-1">
                            <div className="font-bold text-slate-800 text-sm">{cust.name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                              <span className="font-mono" dir="ltr">{cust.phone}</span>
                              {cust.address && <span>• {cust.address}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{cust.loyalty_points || 0} pts</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {loadingInsights ? (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-pulse flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-indigo-200 rounded w-1/3" />
                    <div className="h-3 bg-indigo-100 rounded w-1/2" />
                  </div>
                </div>
              ) : customerInsights ? (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-4 rounded-xl border border-indigo-200/60 shadow-sm relative overflow-hidden">
                  <div className="absolute -left-4 -top-4 text-indigo-100 opacity-50">
                    <Star size={64} fill="currentColor" />
                  </div>
                  <div className="relative z-10 space-y-2">
                    <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5 mb-2">
                      <span className="text-indigo-600">💡</span> ملاحظات الزبون السابقة
                    </p>
                    {customerInsights.lastPurchaseDate && (
                      <p className="text-[11px] text-slate-600 flex items-center gap-1">
                        <span className="font-bold">آخر شراء:</span>{' '}
                        <span className="text-indigo-900 font-medium">{customerInsights.lastPurchaseDate}</span>
                      </p>
                    )}
                    {customerInsights.lastItems && customerInsights.lastItems.length > 0 && (
                      <p className="text-[11px] text-slate-600 flex gap-1">
                        <span className="font-bold block w-max">اشترى مؤخراً:</span>
                        <span className="truncate text-indigo-900 font-medium">{customerInsights.lastItems.join('، ')}</span>
                      </p>
                    )}
                    {customerInsights.favoriteBrands && customerInsights.favoriteBrands.length > 0 && (
                      <p className="text-[11px] text-slate-600 flex gap-1">
                        <span className="font-bold">يفضل ماركات:</span>
                        <span className="text-indigo-700 font-bold">{customerInsights.favoriteBrands.join('، ')}</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 mr-1">اسم الشركة ( المشتري ) <span className="text-rose-500">*</span></label>
                <input
                  value={orderInfo.companyName}
                  onChange={(e) => setOrderInfoField('companyName', e.target.value)}
                  className="w-full bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                  placeholder="أدخل اسم الشركة..."
                  dir="rtl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 mr-1">اسم التاجر ( المشتري ) <span className="text-rose-500">*</span></label>
                <input
                  value={orderInfo.merchantName}
                  onChange={(e) => setOrderInfoField('merchantName', e.target.value)}
                  className="w-full bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                  placeholder="أدخل اسم التاجر..."
                  dir="rtl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 mr-1">العنوان <span className="text-rose-500">*</span></label>
                <input
                  value={orderInfo.address}
                  onChange={(e) => setOrderInfoField('address', e.target.value)}
                  className="w-full bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                  placeholder="المدينة، الشارع..."
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 mr-1">التاريخ <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    value={orderInfo.orderDate}
                    onChange={(e) => setOrderInfoField('orderDate', e.target.value)}
                    className="w-full bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 mr-1">رقم الزبون ( في الشركة )</label>
                  <input
                    value={orderInfo.customerNumber}
                    onChange={(e) => setOrderInfoField('customerNumber', toEnglishDigits(e.target.value))}
                    className="w-full bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-mono text-left"
                    placeholder="#"
                    dir="ltr"
                    lang="en"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500">طريقة الدفع</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 has-[:checked]:text-orange-700">
                    <input
                      type="radio"
                      name="paymentMethodOrderSubmitModal"
                      value="Cash"
                      checked={orderInfo.paymentMethod === 'Cash'}
                      onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)}
                      className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="font-bold text-sm">نقدي (Cash)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 has-[:checked]:text-orange-700">
                    <input
                      type="radio"
                      name="paymentMethodOrderSubmitModal"
                      value="Checks"
                      checked={orderInfo.paymentMethod === 'Checks'}
                      onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)}
                      className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="font-bold text-sm">شيكات (Checks)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-rose-300 transition-colors has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50 has-[:checked]:text-rose-800">
                    <input
                      type="radio"
                      name="paymentMethodOrderSubmitModal"
                      value="Credit"
                      checked={orderInfo.paymentMethod === 'Credit'}
                      onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)}
                      className="w-4 h-4 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="font-bold text-sm">آجل / ذمم (Credit / A/R)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-violet-300 transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50 has-[:checked]:text-violet-800">
                    <input
                      type="radio"
                      name="paymentMethodOrderSubmitModal"
                      value="Installment"
                      checked={orderInfo.paymentMethod === 'Installment'}
                      onChange={(e) => setOrderInfoField('paymentMethod', e.target.value)}
                      className="w-4 h-4 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="font-bold text-sm">تقسيط (Installment)</span>
                  </label>
                </div>
              </div>

              {orderInfo.paymentMethod === 'Checks' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[11px] font-bold text-slate-500 mr-1">عدد الشيكات</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={orderInfo.checksCount}
                    onChange={(e) => setOrderInfoField('checksCount', toEnglishDigits(e.target.value))}
                    className="w-full bg-gradient-to-br from-[#f6f7fb] to-[#eef2f9] hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                    placeholder="أدخل عدد الشيكات (مثلاً ٦ أو 6)..."
                  />
                </div>
              )}
            </div>

            <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row gap-3 px-5 pb-5 pt-3 border-t border-slate-100 bg-white">
              <button
                type="button"
                onClick={() => setShowOrderSubmitModal(false)}
                className="flex-1 py-3.5 rounded-2xl font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmOrderSubmitModal}
                className="flex-1 py-3.5 rounded-2xl font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-lg transition-colors"
              >
                إرسال الطلبية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview — نافذة منبثقة زجاجية (Light Glassmorphism Modal) */}
      <AnimatePresence>
        {showPdfPreviewModal && pdfPreviewBlobUrl && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePdfPreviewModal}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-4 sm:inset-8 z-[201] flex flex-col rounded-3xl overflow-hidden bg-white/70 backdrop-blur-2xl border border-white/50 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.5)_inset]"
            >
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/40 bg-white/40 backdrop-blur-md">
                <h3 className="text-lg font-bold text-slate-800">PDF Preview — معاينة الفاتورة</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { window.open(pdfPreviewBlobUrl, '_blank'); closePdfPreviewModal(); }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
                  >
                    Open in New Tab
                  </button>
                  <button
                    onClick={closePdfPreviewModal}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-slate-100/50 rounded-b-3xl">
                <iframe
                  title="PDF Preview"
                  src={pdfPreviewBlobUrl}
                  className="w-full h-full border-0 rounded-b-3xl bg-white"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {
        showCatalogPanel && (
          <aside className="flex-shrink-0 min-h-0 w-[min(520px,42vw)] min-w-[320px] flex flex-col overflow-hidden rounded-l-2xl bg-gradient-to-b from-white to-slate-50/80 shadow-[0_0_40px_-12px_rgba(0,0,0,0.15),-4px_0_24px_-8px_rgba(0,0,0,0.08)] border-l border-slate-200/60 transition-all duration-300">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 flex justify-between items-center bg-white/80 backdrop-blur-sm border-b border-slate-200/60">
              <h2 className="text-base font-bold text-slate-800">الكتالوج <span className="text-rose-500" dir="ltr">({catalogItems.length})</span></h2>
              <button onClick={() => setShowCatalogPanel(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors flex items-center justify-center text-sm font-medium">✕</button>
            </div>

            {/* Quick Add Buttons */}
            <div className="flex-shrink-0 px-3 py-2.5 border-b border-slate-100 bg-slate-50/60 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">إضافة سريعة</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => addAllToCatalog(filteredItems.filter(i => i.visible !== false))}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors text-center"
                >
                  إضافة الكل ({filteredItems.filter(i => i.visible !== false).length})
                </button>
                <button
                  type="button"
                  onClick={() => addAllToCatalog(filteredItems.filter(i => i.visible !== false && isElectricalGroup(i.group)))}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors text-center"
                >
                  ⚡ كهربائي ({filteredItems.filter(i => i.visible !== false && isElectricalGroup(i.group)).length})
                </button>
                <button
                  type="button"
                  onClick={() => addAllToCatalog(filteredItems.filter(i => i.visible !== false && !isElectricalGroup(i.group)))}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors text-center"
                >
                  🏠 منزلي ({filteredItems.filter(i => i.visible !== false && !isElectricalGroup(i.group)).length})
                </button>
              </div>

              {/* Price display toggle */}
              <button
                type="button"
                onClick={() => setCatalogShowFinalPriceOnly(v => !v)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${
                  catalogShowFinalPriceOnly
                    ? 'bg-orange-100 text-orange-800 border border-orange-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>السعر الأصلي فقط (بدون سعر الخصم)</span>
                <span className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${catalogShowFinalPriceOnly ? 'bg-orange-500' : 'bg-slate-300'}`}>
                  <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${catalogShowFinalPriceOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </button>
            </div>

            {/* Products List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
              {catalogItems.length === 0 ? (
                <div className="text-center py-14 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100/80 border-2 border-dashed border-slate-200/80 text-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <FileText className="mx-auto text-slate-400 mb-2" size={40} />
                  <p className="text-sm font-medium">ستظهر المنتجات المختارة هنا</p>
                  <p className="text-xs text-slate-400 mt-1">استخدم أزرار الإضافة السريعة أعلاه</p>
                </div>
              ) : (
                catalogItems.map(item => (
                  <div key={item.id} className="group relative rounded-3xl p-3.5 bg-gradient-to-br from-white via-white to-rose-50/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100/80 flex gap-3 items-center">
                    <div className="w-12 h-12 shrink-0 rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                      {getImage(item) && <img src={getImage(item)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 break-words leading-tight">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 rounded">{item.barcode}</span>
                        {getDisplayGroup(item) && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded">{getDisplayGroup(item)}</span>}
                      </div>
                      <div className="mt-2 flex items-baseline gap-3">
                        {catalogShowFinalPriceOnly ? (
                          <span className="text-base font-black text-slate-700">₪{item.price}</span>
                        ) : item.priceAfterDiscount && item.priceAfterDiscount < item.price ? (
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
                <button onClick={handlePrintCatalog} className="w-full py-2.5 rounded-2xl bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-sm font-bold shadow-lg shadow-rose-500/25 transition-all">طباعة / عرض الكتالوج</button>
                <button onClick={clearCatalog} className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-all">مسح الكتالوج</button>
              </div>
            )}
          </aside>
        )
      }

      {/* Modern Product Detail Modal */}
      {
        selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/60 backdrop-blur-2xl px-4" onClick={() => setSelectedItem(null)}>
            <motion.div
              layoutId={`modal-${selectedItem.id}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="rounded-[2.5rem] max-w-5xl w-full max-h-[90svh] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.6)] border flex flex-col transition-colors duration-500 bg-white border-slate-100"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-8 py-6 border-b shrink-0 border-slate-100`}>
                <div className="flex flex-col">
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-600">Product Selection</p>
                  <h2 className="text-xl font-black mt-1 text-slate-900">{selectedItem.productType || 'Detailed Overview'}</h2>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)} 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="grid md:grid-cols-2 gap-12">
                  {/* Image Container */}
                  <div className="aspect-square rounded-[2rem] relative flex items-center justify-center overflow-hidden transition-all duration-500 bg-gradient-to-br from-slate-50 to-slate-100">
                    <div className="absolute inset-0 opacity-20" />
                    {getImageFull(selectedItem) ? (
                      <motion.img 
                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        src={getImageFull(selectedItem)} alt="" className="w-full h-full object-contain p-12 z-10 filter drop-shadow-[0_20px_60px_rgba(0,0,0,0.3)]" 
                      />
                    ) : (
                      <Package size={120} className="text-slate-200" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-col">
                    <div className="mb-8">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600">
                          {selectedItem.group || 'General'}
                        </span>
                        <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                          {getStockLabel(selectedItem)}
                        </span>
                      </div>
                      <h1 className="text-4xl font-black leading-tight mb-4 text-slate-900">{selectedItem.name}</h1>
                      <div className="flex items-baseline gap-4">
                        <p className="text-5xl font-black text-slate-900" dir="ltr">
                          <span className="text-xl font-medium opacity-50 mr-1">₪</span>
                          {Math.round(selectedItem.priceAfterDiscount ?? selectedItem.price ?? 0)}
                        </p>
                        {selectedItem.priceAfterDiscount && selectedItem.priceAfterDiscount < selectedItem.price && (
                          <p className="text-2xl text-slate-500 line-through opacity-50" dir="ltr">₪{selectedItem.price}</p>
                        )}
                      </div>
                    </div>

                    <div className="p-8 rounded-3xl mb-8 bg-slate-50 border border-slate-100">
                      <h3 className="text-xs font-black uppercase tracking-widest mb-4 text-slate-500">Adjust Quantity</h3>
                      <div className="flex items-center gap-5">
                        <div className="flex items-center p-1.5 rounded-2xl border bg-white border-slate-200 shadow-sm">
                          <button onClick={() => setProductDetailQty((q) => Math.max(1, (q || 1) - 1))} className="w-12 h-12 flex items-center justify-center rounded-xl transition-all hover:bg-slate-100 text-slate-800">
                            <Minus size={20} />
                          </button>
                          <input type="number" min={1} value={productDetailQty} onChange={(e) => setProductDetailQty(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-20 text-center text-2xl font-black bg-transparent outline-none text-slate-900" />
                          <button onClick={() => setProductDetailQty((q) => (q || 1) + 1)} className="w-12 h-12 flex items-center justify-center rounded-xl transition-all hover:bg-slate-100 text-slate-800">
                            <Plus size={20} />
                          </button>
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-bold text-slate-700">
                            {selectedItem.box ? `${selectedItem.box} Items per Box` : 'Single Item'}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] mt-1 text-slate-400">Availability: High</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 mt-auto">
                      {mode !== 'catalog' && (
                        <button
                          onClick={(e) => { addToOrder(selectedItem, productDetailQty, e); setSelectedItem(null); }}
                          className="w-full py-5 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-black shadow-xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                          <ShoppingCart size={24} strokeWidth={2.5} />
                          <span>Add to Selection</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!selectedItem}
                        onClick={() => copyWhatsAppMessage(selectedItem)}
                        title={selectedItem?.barcode ? getProductPublicShareUrl(selectedItem) : ''}
                        className="group w-full flex items-center justify-between bg-white border border-green-100 hover:bg-green-50 p-4 rounded-[2rem] transition-all duration-300 shadow-sm hover:shadow-md disabled:pointer-events-none disabled:opacity-40"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="bg-green-500 p-2 rounded-full text-white shrink-0 group-hover:scale-110 transition-transform">
                            <MessageCircle size={20} aria-hidden />
                          </div>
                          <div className="text-right min-w-0">
                            <p className="text-sm font-bold text-gray-800">نسخ تفاصيل الواتساب</p>
                            <p className="text-xs text-gray-500">سيتم نسخ السعر والرابط والوصف</p>
                          </div>
                        </div>
                        <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-green-100 transition-colors shrink-0">
                          <Copy size={16} className="text-gray-400 group-hover:text-green-600" aria-hidden />
                        </div>
                      </button>
                      <div className="grid grid-cols-2 gap-4">
                        {mode === 'catalog' && (
                          <button 
                            onClick={() => { catalogItems.some((i) => i.id === selectedItem.id) ? removeFromCatalog(selectedItem.id) : addToCatalog(selectedItem); setSelectedItem(null); }} 
                            className={`py-4 rounded-2xl font-black transition-all border ${catalogItems.some((i) => i.id === selectedItem.id) ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                          >
                            {catalogItems.some((i) => i.id === selectedItem.id) ? 'Remove Catalog' : 'Add to Catalog'}
                          </button>
                        )}
                         {userRole === 'admin' && (
                           <button type="button" onClick={(e) => { e.stopPropagation(); openEditModal(selectedItem); }} className="py-4 rounded-2xl font-black transition-all border bg-white border-slate-200 text-slate-700 hover:bg-slate-50">تعديل التفاصيل</button>
                         )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub Features Section */}
                <div className="mt-12 pt-8 border-t border-slate-100">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-slate-400">Product Specifications</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { label: 'Packaging', value: selectedItem.box || 'Standard Box' },
                      { label: 'Warranty', value: selectedItem.warranty || '12 Months' },
                      { label: 'List Price', value: `₪${selectedItem.price || 0}` },
                      { label: 'SKU / Ident.', value: selectedItem.barcode || 'N/A' }
                    ].map((spec, idx) => (
                      <div key={idx} className="p-5 rounded-[1.5rem] border bg-slate-50 border-slate-100">
                        <p className="text-[10px] font-black uppercase mb-1.5 opacity-40 text-slate-900">{spec.label}</p>
                        <p className="font-black text-sm truncate text-slate-900">{spec.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )
      }

      {/* Modern Quantity Modal */}
      {
        showQuantityModal && quantityItem && (() => {
          const boxCount = quantityItem.box ? parseInt(quantityItem.box, 10) : 1;
          const step = boxCount > 0 ? boxCount : 1;
          const getValidQty = (val) => {
            const parsed = parseInt(val, 10);
            if (isNaN(parsed) || parsed <= 0) return step;
            return Math.max(step, Math.round(parsed / step) * step);
          };

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian-950/60 backdrop-blur-2xl" onClick={() => setShowQuantityModal(false)}>
              <div className="rounded-[2rem] p-8 max-w-sm w-full shadow-[0_30px_100px_rgba(0,0,0,0.6)] border transition-all duration-500 bg-white border-slate-100" onClick={(e) => e.stopPropagation()}>
                <div className="mb-6">
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] mb-1 text-indigo-600">Stock Adjustment</p>
                  <h3 className="text-xl font-black text-slate-900">Select Quantity</h3>
                </div>

                <div className="p-4 rounded-2xl mb-6 bg-slate-50 border border-slate-100">
                    <p className="text-sm font-black mb-1 text-slate-700" dir="auto" style={{ direction: 'rtl' }}>
                    {quantityItem.productType || quantityItem.name}
                  </p>
                  <p className={`text-[10px] font-black uppercase tracking-widest opacity-40 text-slate-900`}>
                    Available in multiples of {step}
                  </p>
                </div>

                <div className="mb-8" dir="ltr">
                  <div className="flex items-stretch rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => setQuantityValue((v) => Math.max(step, getValidQty(v) - step))}
                      className="w-14 h-14 flex items-center justify-center shrink-0 border-r border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      aria-label="تقليل"
                    >
                      <Minus size={22} strokeWidth={2.5} />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={quantityValue}
                      onChange={(e) => {
                        let val = e.target.value;
                        const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
                        for (let i = 0; i < 10; i++) val = val.replace(arabicNumbers[i], i.toString());
                        val = val.replace(/[^0-9]/g, '');
                        setQuantityValue(val);
                      }}
                      onBlur={() => setQuantityValue(getValidQty(quantityValue))}
                      className="flex-1 min-w-0 h-14 text-center text-2xl font-black outline-none bg-transparent text-slate-900 focus:ring-0 border-0"
                      autoFocus
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => setQuantityValue((v) => getValidQty(v) + step)}
                      className="w-14 h-14 flex items-center justify-center shrink-0 border-l border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      aria-label="زيادة"
                    >
                      <Plus size={22} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowQuantityModal(false)}
                    className="flex-1 py-4 rounded-2xl font-black text-sm transition-all border bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const finalVal = getValidQty(quantityValue);
                      if (quantityItem && finalVal > 0) {
                        addToOrder(quantityItem, finalVal, quantityEventClick);
                        setShowQuantityModal(false);
                        setQuantityItem(null);
                        setQuantityValue(1);
                      }
                    }}
                    className="flex-1 py-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      }

      {
        modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xl px-4" onClick={() => setModalOpen(false)}>
            <div className="rounded-[2.5rem] max-w-xl w-full max-h-[90svh] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.6)] border flex flex-col transition-all duration-500 bg-white border-slate-100" onClick={(e) => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-8 py-6 border-b shrink-0 border-slate-100`}>
                <div className="flex flex-col">
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-600">Management</p>
                  <h2 className="text-xl font-black mt-1 text-slate-900">{editingItem ? 'Edit Product' : 'Add New Entry'}</h2>
                </div>
                <button onClick={() => setModalOpen(false)} className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-slate-100 text-slate-500">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Barcode Identifier</span>
                    <input required value={formData.barcode} onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))} disabled={!!editingItem} dir="ltr" className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-mono text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Display Name</span>
                      <input value={formData.eng_name} onChange={(e) => setFormData((p) => ({ ...p, eng_name: e.target.value }))} className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-bold text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Category Group</span>
                      <input value={formData.brand_group} onChange={(e) => setFormData((p) => ({ ...p, brand_group: e.target.value }))} className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-bold text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Product Type (Arabic)</span>
                    <input value={formData.product_type} onChange={(e) => setFormData((p) => ({ ...p, product_type: e.target.value }))} dir="rtl" className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-bold text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Stock Level</span>
                      <input type="number" min={0} value={formData.stock_count} onChange={(e) => setFormData((p) => ({ ...p, stock_count: e.target.value }))} className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-bold text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                      {(() => {
                        const v = formData.stock_count;
                        if (v === '' || v == null) {
                          return (
                            <p className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 leading-relaxed" dir="rtl">
                              لم تُدخل كمية مخزون — سيُحفظ الصنف بدون مخزون (غير متوفر) حتى تُحدَّث الكمية.
                            </p>
                          );
                        }
                        const n = parseInt(String(v), 10);
                        if (!Number.isNaN(n) && n === 0) {
                          return (
                            <p className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 leading-relaxed" dir="rtl">
                              المخزون صفر — سيظهر الصنف كغير متوفر حتى إدخال كمية.
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Box Count</span>
                      <input type="number" value={formData.box_count} onChange={(e) => setFormData((p) => ({ ...p, box_count: e.target.value }))} className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-bold text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Standard Price</span>
                      <input type="number" step="0.01" value={formData.full_price} onChange={(e) => setFormData((p) => ({ ...p, full_price: e.target.value }))} className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-bold text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block opacity-50 text-slate-900">Offer Price</span>
                      <input type="number" step="0.01" value={formData.price_after_disc} onChange={(e) => setFormData((p) => ({ ...p, price_after_disc: e.target.value }))} className="w-full rounded-2xl border px-4 py-3.5 outline-none transition-all font-bold text-sm bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400" />
                    </label>
                  </div>
                </div>

                <div className="p-6 rounded-3xl space-y-4 border bg-slate-50 border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Public Visibility</span>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, visible: !(p.visible !== false) }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.visible !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {formData.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span>{formData.visible !== false ? 'Live' : 'Hidden'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Special Offer</span>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, is_offer: !p.is_offer }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.is_offer ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}
                    >
                      <Tag size={14} />
                      <span>{formData.is_offer ? 'Offer Active' : 'No Offer'}</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Media Asset</span>
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-[1.5rem] flex-shrink-0 flex items-center justify-center overflow-hidden border transition-all duration-500 bg-white border-slate-200">
                        {(formData.image_url && getPublicImageUrl(formData.image_url, { thumb: false })) ? (
                          <img key={formData.image_url} src={getPublicImageUrl(formData.image_url, { thumb: false })} alt="" className="w-full h-full object-contain p-3" />
                        ) : (
                          <Package size={24} className="opacity-20" />
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          placeholder="Image URL..."
                          value={formData.image_url || ''}
                          onChange={(e) => setFormData((p) => ({ ...p, image_url: e.target.value.trim() }))}
                          className="w-full rounded-xl border px-3 py-2 text-xs outline-none bg-white border-slate-200"
                        />
                        <label className="block text-center cursor-pointer">
                          <input ref={fileInputRef} type="file" accept="image/*" disabled={uploading || !formData.barcode} onChange={(e) => handleImageUpload(e, editingItem || { barcode: formData.barcode })} className="sr-only" />
                          <div className={`py-2 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${uploading ? 'opacity-50' : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
                            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                            {uploading ? 'Processing...' : 'Upload Asset'}
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-4 rounded-2xl font-black text-sm border transition-all bg-white border-slate-200 text-slate-500 hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="flex-1 py-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
                    Commit Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {showStockZeroConfirm && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          dir="rtl"
          onClick={cancelStockZeroConfirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-zero-confirm-title"
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 p-2 rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 id="stock-zero-confirm-title" className="text-lg font-black text-slate-900">تنبيه مخزون</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  المخزون غير محدد أو يساوي صفراً. سيظهر الصنف كغير متوفر في الكتالوج ولن يُباع حتى تحديث الكمية في المخزون. هل تريد المتابعة؟
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={cancelStockZeroConfirm}
                className="px-5 py-3 rounded-2xl font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => { void confirmStockZeroSave(); }}
                className="px-5 py-3 rounded-2xl font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-600/25 transition-colors"
              >
                نعم، احفظ
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Edit Name Modal */}
      {
        editingNameItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian-950/60 backdrop-blur-2xl" onClick={() => setEditingNameItem(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={`rounded-[2rem] p-8 max-w-sm w-full shadow-[0_30px_100px_rgba(0,0,0,0.6)] border transition-all duration-500 bg-white border-slate-100`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] mb-1 text-indigo-600">Edit Meta</p>
                <h3 className="text-xl font-black text-slate-900">Product Name</h3>
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-2xl border px-5 py-4 text-sm font-bold outline-none transition-all mb-8 bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400"
                placeholder="Entry name..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveNameEdit()}
              />
              <div className="flex gap-4">
                <button onClick={() => setEditingNameItem(null)} className="flex-1 py-4 rounded-2xl font-black text-sm border transition-all bg-white border-slate-200 text-slate-500">Cancel</button>
                <button onClick={saveNameEdit} className="flex-1 py-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )
      }

      {/* Modern Edit Type Modal */}
      {
        editingTypeItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian-950/60 backdrop-blur-2xl px-4" onClick={() => setEditingTypeItem(null)} dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={`rounded-[2rem] p-8 max-w-sm w-full shadow-[0_30px_100px_rgba(0,0,0,0.6)] border transition-all duration-500 bg-white border-slate-100`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 text-right">
                <p className={`text-[10px] uppercase font-black tracking-[0.2em] mb-1 text-indigo-600`}>Edit Meta</p>
                <h3 className="text-xl font-black text-slate-900">تغيير النوع</h3>
              </div>
              <input
                list="quick-edit-type-list"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className={`w-full rounded-2xl border px-5 py-4 text-sm font-bold outline-none transition-all mb-8 text-right bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400`}
                placeholder="نوع المنتج..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveTypeEdit()}
              />
              <datalist id="quick-edit-type-list">
                {allProductTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <div className="flex gap-4">
                <button onClick={() => setEditingTypeItem(null)} className="flex-1 py-4 rounded-2xl font-black text-sm border transition-all bg-white border-slate-200 text-slate-500">إلغاء</button>
                <button onClick={saveTypeEdit} className="flex-1 py-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">حفظ النوع</button>
              </div>
            </motion.div>
          </div>
        )
      }

      {/* Modern Quick Category Modal */}
      {
        quickEditCategoryItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian-950/60 backdrop-blur-2xl" onClick={() => !quickEditCategorySaving && setQuickEditCategoryItem(null)} dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-[2rem] p-8 max-w-sm w-full shadow-[0_30px_100px_rgba(0,0,0,0.6)] border transition-all duration-500 bg-white border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 text-right">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] mb-1 text-indigo-600">Edit Meta</p>
                <h3 className="text-xl font-black text-slate-900">تغيير التصنيف</h3>
                <p className="text-[10px] font-bold opacity-40 mt-1 text-slate-900">{quickEditCategoryItem.name || quickEditCategoryItem.productType || quickEditCategoryItem.barcode}</p>
              </div>
              <input
                list="quick-edit-category-list"
                value={quickEditCategoryValue}
                onChange={(e) => setQuickEditCategoryValue(e.target.value)}
                className="w-full rounded-2xl border px-5 py-4 text-sm font-bold outline-none transition-all mb-8 text-right bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400"
                placeholder="اختر التصنيف..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleQuickSaveCategory()}
              />
              <datalist id="quick-edit-category-list">
                {allGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <div className="flex gap-4">
                <button
                  onClick={() => !quickEditCategorySaving && setQuickEditCategoryItem(null)}
                  disabled={quickEditCategorySaving}
                  className="flex-1 py-4 rounded-2xl font-black text-sm border transition-all bg-white border-slate-200 text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleQuickSaveCategory}
                  disabled={quickEditCategorySaving}
                  className="flex-1 py-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {quickEditCategorySaving && <Loader2 size={16} className="animate-spin" />}
                  <span>حفظ التصنيف</span>
                </button>
              </div>
            </motion.div>
          </div>
        )
      }

      {/* Modern Quick Add Customer Modal */}
      {
        showQuickAddCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian-950/60 backdrop-blur-2xl" onPointerDown={(e) => e.target === e.currentTarget && setShowQuickAddCustomer(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-[2.5rem] overflow-hidden w-full max-w-md shadow-[0_30px_100px_rgba(0,0,0,0.6)] border transform transition-all flex flex-col bg-white border-slate-100"
              onPointerDown={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between px-8 py-6 border-b shrink-0 border-slate-100">
                <div className="flex flex-col">
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-600">Registration</p>
                  <h2 className="text-xl font-black mt-1 text-slate-900">Quick Customer Add</h2>
                </div>
                <button onClick={() => setShowQuickAddCustomer(false)} className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-slate-100 text-slate-500">✕</button>
              </div>

              <div className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest block opacity-50 text-slate-900">رقم الجوال / معرف الزبون <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={quickAddCustomerData.phone}
                    onChange={(e) => setQuickAddCustomerData({ ...quickAddCustomerData, phone: toEnglishDigits(e.target.value) })}
                    className="w-full rounded-2xl border px-5 py-4 text-sm font-bold outline-none transition-all text-left font-mono bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400"
                    placeholder="05..."
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest block opacity-50 text-slate-900">اسم التاجر / المشتري <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={quickAddCustomerData.name}
                    onChange={(e) => setQuickAddCustomerData({ ...quickAddCustomerData, name: e.target.value })}
                    className="w-full rounded-2xl border px-5 py-4 text-sm font-bold outline-none transition-all bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400"
                    placeholder="اسم المشتري..."
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest block opacity-50 text-slate-900">المؤسسة</label>
                    <input
                      type="text"
                      value={quickAddCustomerData.companyName}
                      onChange={(e) => setQuickAddCustomerData({ ...quickAddCustomerData, companyName: e.target.value })}
                      className="w-full rounded-2xl border px-5 py-4 text-xs font-bold outline-none transition-all bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400"
                      placeholder="..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest block opacity-50 text-slate-900">العنوان</label>
                    <input
                      type="text"
                      value={quickAddCustomerData.address}
                      onChange={(e) => setQuickAddCustomerData({ ...quickAddCustomerData, address: e.target.value })}
                      className="w-full rounded-2xl border px-5 py-4 text-xs font-bold outline-none transition-all bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-400"
                      placeholder="..."
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 pt-0 flex gap-4">
                <button onClick={() => setShowQuickAddCustomer(false)} className={`flex-1 py-4 rounded-2xl font-black text-sm border transition-all bg-white border-slate-200 text-slate-500`}>إلغاء</button>
                <button
                  onClick={handleQuickAddCustomer}
                  disabled={!quickAddCustomerData.name || !quickAddCustomerData.phone}
                  className="flex-1 py-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Commit Entry
                </button>
              </div>
            </motion.div>
          </div>
        )
      }

      {/* Modern Held Orders Modal */}
      {
        showHeldOrdersModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian-950/60 backdrop-blur-2xl" onClick={() => setShowHeldOrdersModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-[2.5rem] overflow-hidden w-full max-w-2xl shadow-[0_30px_100px_rgba(0,0,0,0.6)] border flex flex-col max-h-[90vh] transition-all duration-500 bg-white border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-8 py-6 border-b shrink-0 border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-all bg-amber-100 border-amber-200 text-amber-600">
                    <Clock size={24} />
                  </div>
                  <div className="flex flex-col text-left">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-amber-600">Archived Slots</p>
                    <h2 className="text-xl font-black mt-1 text-slate-900">Held Orders</h2>
                  </div>
                </div>
                <button onClick={() => setShowHeldOrdersModal(false)} className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-slate-100 text-slate-500">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                {heldOrders.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center opacity-20 space-y-4">
                    <Clock size={48} />
                    <p className="text-lg font-black uppercase tracking-widest text-center">No active holds</p>
                  </div>
                ) : (
                  <div className="space-y-4" dir="rtl">
                    {heldOrders.map((order) => {
                      const dateObj = new Date(order.timestamp);
                      const timeString = dateObj.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                      const dateString = dateObj.toLocaleDateString('ar-SA');
                      const firstItemNames = order.orderItems.slice(0, 2).map((i) => i.customName || i.name).join(', ');

                      return (
                        <div key={order.id} className="group p-6 rounded-[2rem] border transition-all bg-white border-slate-100 hover:border-amber-200 shadow-sm">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            <div className="flex gap-4 items-center">
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all bg-slate-50 text-slate-400 group-hover:text-amber-500">
                                <ShoppingCart size={24} />
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-black text-slate-900">{timeString}</span>
                                  <span className="opacity-40 text-[10px]">• {dateString}</span>
                                </div>
                                <p className="text-xs font-bold leading-relaxed mb-1 text-slate-500">
                                  {order.totalItems} Items — <span className="text-slate-900">₪{order.totalAmount?.toFixed(2) || '0.00'}</span>
                                </p>
                                {firstItemNames && <p className="text-[10px] opacity-30 truncate max-w-[150px]">{firstItemNames}</p>}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <button
                                onClick={() => handleRestoreHeldOrder(order)}
                                className="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                                <ShoppingCart size={16} /> Restore
                              </button>
                              <button
                                onClick={() => handleRemoveHeldOrder(order.id)}
                                className="p-3 rounded-xl transition-all bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 border border-slate-100"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50">
                <button onClick={() => setShowHeldOrdersModal(false)} className="w-full py-4 rounded-2xl font-black text-sm transition-all border bg-white border-slate-200 text-slate-700 hover:bg-slate-50">إغلاق</button>
              </div>
            </motion.div>
          </div>
        )
      }
      {/* Mobile Bottom Nav */}
      <BottomNav
        mode={mode}
        setMode={setMode}
        cartCount={orderLines.length}
        cartTotal={orderSubtotal}
        cartPing={cartPing}
        onOpenCart={() => setShowCartOverlay(true)}
        hasOffers={userRole === 'customer' ? customOffers.some(o => o.items && o.items.length > 0 && o.showOnSalesScreen !== false) : customOffers.length > 0}
        cartButtonRef={cartNavRef}
      />

      {/* Render Flying Items — أكبر عند الظهور */}
      {flyingItems.map(item => {
        const size = 160; // أكبر شوي لظهور أوضح وأحلى
        const half = size / 2;
        return (
          <div
            key={item.id}
            className="fixed z-[100] pointer-events-none transition-all duration-700 ease-out"
            style={{
              left: item.startX - half,
              top: item.startY - half,
              transform: item.flying
                ? `translate(${item.endX - item.startX}px, ${item.endY - item.startY}px) scale(0.15) rotate(360deg)`
                : 'translate(0px, 0px) scale(1) rotate(0deg)',
              opacity: item.flying ? 0.25 : 0.95,
              width: `${size}px`,
              height: `${size}px`,
            }}
          >
            {item.image ? (
              <img src={item.image} alt="" loading="lazy" className="w-full h-full object-contain drop-shadow-2xl rounded-xl" />
            ) : (
              <div className="w-full h-full bg-slate-200 rounded-xl flex items-center justify-center shadow-lg"><Package size={56} className="text-slate-400" /></div>
            )}
          </div>
        );
      })}
  </>
);
}

export default App;
