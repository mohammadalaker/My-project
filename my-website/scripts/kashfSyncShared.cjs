/**
 * منطق مشترك: قراءة باركودات «الكشف» ومقارنتها بـ Supabase وتحديث غير الموجودين.
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const NAME_KEYS = ['Eng-Name', 'Eng Name', 'الوصف', 'Description', 'Name', 'Item', 'اسم القطعة'];
const QTY_KEYS = ['Qty', 'Quantity', 'الكمية', 'Count'];
const PRICE_KEYS = ['Price', 'price', 'السعر', 'Unit Price', 'Cost'];
const BARCODE_KEYS = ['Barcode', 'barcode', 'باركود', 'الباركود', 'Barcode number', 'رمز الباركود', 'Code', 'كود'];

function findCol(row, keys) {
  if (!row || !Array.isArray(row)) return -1;
  const low = (v) => String(v ?? '').toLowerCase().trim();
  for (let i = 0; i < row.length; i++) {
    const c = low(row[i]);
    if (keys.some((k) => c === k.toLowerCase() || (k.split(/[\s/]+/)[0] && c.includes(k.toLowerCase().split(/[\s/]+/)[0]))))
      return i;
  }
  return -1;
}
function toNum(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function toStr(v) {
  return String(v ?? '').trim();
}

function canonicalBarcode(s) {
  if (s == null || s === '') return '';
  let x = String(s).trim().replace(/\s/g, '');
  if (/^\d+$/.test(x)) {
    x = x.replace(/^0+/, '') || '0';
  }
  return x;
}

const DEFAULT_KASHF_NAME = 'كشف القطع الصغيرة و المنزلي.xlsx';

function resolveExcelPath() {
  const arg = process.argv[2];
  if (arg && String(arg).trim()) {
    const p = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
    if (fs.existsSync(p)) return p;
    console.error('Excel file not found (from argument):', p);
    process.exit(1);
  }
  const fromEnv = process.env.KASHF_EXCEL_PATH || process.env.EXCEL_KASHF_PATH;
  if (fromEnv && String(fromEnv).trim()) {
    const p = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    if (fs.existsSync(p)) return p;
    console.error('Excel file not found (from KASHF_EXCEL_PATH):', p);
    process.exit(1);
  }
  const candidates = [...new Set([
    path.join(__dirname, '..', '..', DEFAULT_KASHF_NAME),
    path.join(__dirname, '..', DEFAULT_KASHF_NAME),
    path.join(process.cwd(), DEFAULT_KASHF_NAME),
  ])];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  console.error('Excel file not found. Expected name:', DEFAULT_KASHF_NAME);
  console.error('Searched in:');
  candidates.forEach((p) => console.error('  -', p));
  console.error('');
  console.error('Fix: put the file in the project root (next to my-website), or run:');
  console.error('  KASHF_EXCEL_PATH="/full/path/to/file.xlsx" npm run delete-not-in-excel');
  console.error('  node scripts/deleteNotInExcel.cjs "/full/path/to/file.xlsx"');
  process.exit(1);
}

function parseEnvFile(content) {
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const exportMatch = trimmed.match(/^export\s+(.+)$/i);
    const m = exportMatch ? exportMatch[1] : trimmed;
    const eq = m.indexOf('=');
    if (eq <= 0) return;
    const key = m.slice(0, eq).trim();
    let val = m.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (key) process.env[key] = val;
  });
}

/**
 * يحمّل كل ملفات .env الموجودة (بدون تكرار المسار).
 * الترتيب: مجلد التشغيل الحالي → my-website من cwd → جذر المشروع من موقع السكربت → my-website من السكربت.
 * الملفات اللاحقة تطغى المتغيرات السابقة.
 */
function loadEnv() {
  const seen = new Set();
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'my-website', '.env'),
    path.join(__dirname, '..', '..', '.env'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const envPath of candidates) {
    let resolved;
    try {
      resolved = path.resolve(envPath);
    } catch {
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (!fs.existsSync(resolved)) continue;
    let raw = fs.readFileSync(resolved, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    parseEnvFile(raw);
  }
}

/** للتشخيص عندما لا يُقرأ المتغير */
function listEnvFileStatus() {
  const candidates = [
    ['cwd/.env', path.join(process.cwd(), '.env')],
    ['cwd/my-website/.env', path.join(process.cwd(), 'my-website', '.env')],
    ['repo/.env (من السكربت)', path.join(__dirname, '..', '..', '.env')],
    ['my-website/.env (من السكربت)', path.join(__dirname, '..', '.env')],
  ];
  console.error('مسارات .env التي تم التحقق منها:');
  for (const [label, p] of candidates) {
    const resolved = path.resolve(p);
    const ok = fs.existsSync(resolved);
    console.error(`  ${ok ? '✓' : '✗'} ${label}`);
    console.error(`     ${resolved}`);
  }
}

function getBarcodesFromWorkbook(wb) {
  const sheetNames = wb.SheetNames || [];
  const set = new Set();
  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!data || data.length < 2) continue;
    const header = data[0];
    const nameIdx = findCol(header, NAME_KEYS);
    const qtyIdx = findCol(header, QTY_KEYS);
    const priceIdx = findCol(header, PRICE_KEYS);
    const barcodeIdx = findCol(header, BARCODE_KEYS);
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const name = nameIdx >= 0 ? toStr(row[nameIdx]) : toStr(row[0]);
      const qty = qtyIdx >= 0 ? toNum(row[qtyIdx]) : toNum(row[1]);
      const price = priceIdx >= 0 ? toNum(row[priceIdx]) : toNum(row[2]);
      if (!name && qty === 0 && price === 0) continue;
      const barcode = barcodeIdx >= 0 ? toStr(row[barcodeIdx]) : '';
      if (barcode) {
        const key = canonicalBarcode(barcode);
        if (key) set.add(key);
      }
    }
  }
  return set;
}

function getBarcodesFromExcelFile(excelPath) {
  const buf = fs.readFileSync(excelPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  return getBarcodesFromWorkbook(wb);
}

async function fetchAllSupabaseBarcodes(supabase) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('items')
      .select('barcode')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row && row.barcode != null && String(row.barcode).trim() !== '') {
        all.push(String(row.barcode).trim());
      }
    }
    hasMore = data.length === pageSize;
    from += pageSize;
  }
  return all;
}

function isZeroStockOnlyMode() {
  const v = process.env.KASHF_ZERO_STOCK_ONLY;
  return v === '1' || v === 'true' || v === 'yes';
}

async function markItemsNotInKashf(supabase, excelBarcodes) {
  const zeroOnly = isZeroStockOnlyMode();
  console.log('Fetching all barcodes from Supabase (items)...');
  const supabaseBarcodes = await fetchAllSupabaseBarcodes(supabase);
  console.log('Items in Supabase:', supabaseBarcodes.length);

  const rows = supabaseBarcodes.map((b) => ({ raw: b, key: canonicalBarcode(b) }));
  const toUpdate = rows.filter((r) => r.key && !excelBarcodes.has(r.key));
  if (toUpdate.length === 0) {
    console.log('No items to update. All Supabase items exist in the kashf (by barcode match).');
    return;
  }

  const modeLabel = zeroOnly
    ? 'stock_count=0 فقط (KASHF_ZERO_STOCK_ONLY) — حقل visible لا يُغيَّر'
    : 'stock_count=0 + visible=false (إخفاء من كتالوج البيع)';
  console.log('Barcodes in Supabase but NOT in current kashf:', toUpdate.length, '—', modeLabel);

  const batchSize = 100;
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    const rawBarcodes = batch.map((r) => r.raw);

    const payload = zeroOnly ? { stock_count: 0 } : { stock_count: 0, visible: false };
    let { error } = await supabase.from('items').update(payload).in('barcode', rawBarcodes);

    if (error && !zeroOnly) {
      console.warn('Update (stock + visible) failed, retrying stock_count only:', error.message);
      const r2 = await supabase.from('items').update({ stock_count: 0 }).in('barcode', rawBarcodes);
      error = r2.error;
      if (error) {
        console.error('Update batch error:', error.message);
        break;
      }
    } else if (error) {
      console.error('Update batch error:', error.message);
      break;
    }
    updated += batch.length;
    console.log('Updated', updated, '/', toUpdate.length);
  }
  console.log(
    'Done.',
    updated,
    zeroOnly
      ? 'item(s) set to stock 0 (barcode absent from current Sheet export).'
      : 'item(s) set to stock 0 and hidden from catalog.',
  );
}

module.exports = {
  loadEnv,
  listEnvFileStatus,
  resolveExcelPath,
  canonicalBarcode,
  getBarcodesFromWorkbook,
  getBarcodesFromExcelFile,
  fetchAllSupabaseBarcodes,
  markItemsNotInKashf,
};
