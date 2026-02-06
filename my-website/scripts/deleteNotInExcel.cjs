/**
 * حذف أي منتج في Supabase (جدول items) غير موجود في ملف الإكسل المرفوع.
 * يشترط وجود ملف الإكسل: كشف القطع الصغيرة و المنزلي.xlsx (في المجلد الأعلى من my-website)
 * ومتغيرات البيئة: VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env
 *
 * التشغيل: node scripts/deleteNotInExcel.cjs
 * أو: npm run delete-not-in-excel
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const NAME_KEYS = ['Eng-Name', 'Eng Name', 'الوصف', 'Description', 'Name', 'Item', 'اسم القطعة'];
const QTY_KEYS = ['Qty', 'Quantity', 'الكمية', 'Count'];
const PRICE_KEYS = ['Price', 'price', 'السعر', 'Unit Price', 'Cost'];
const GROUP_KEYS = ['group', 'Group', 'المجموعة', 'الفئة', 'Category', 'صنف', 'ماركة', 'Brand', 'الصنف'];
const BARCODE_KEYS = ['Barcode', 'barcode', 'باركود', 'الباركود', 'Barcode number', 'رمز الباركود', 'Code', 'كود'];
const BOX_KEYS = ['Box', 'box', 'صندوق', 'الصندوق', 'الخانة', 'خانة', 'مربع', 'المربع', 'ص.'];

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

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
    return;
  }
}

function getBarcodesFromExcel(excelPath) {
  const buf = fs.readFileSync(excelPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
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
      if (barcode) set.add(String(barcode).trim());
    }
  }
  return set;
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

async function main() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const excelPath = path.join(__dirname, '..', '..', 'كشف القطع الصغيرة و المنزلي.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('Excel file not found:', excelPath);
    process.exit(1);
  }

  console.log('Reading barcodes from Excel...');
  const excelBarcodes = getBarcodesFromExcel(excelPath);
  console.log('Barcodes in Excel:', excelBarcodes.size);

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, key);

  console.log('Fetching all barcodes from Supabase (items)...');
  const supabaseBarcodes = await fetchAllSupabaseBarcodes(supabase);
  console.log('Items in Supabase:', supabaseBarcodes.length);

  const toDelete = supabaseBarcodes.filter((b) => !excelBarcodes.has(b));
  if (toDelete.length === 0) {
    console.log('No items to delete. All Supabase items exist in Excel.');
    return;
  }

  console.log('Items to delete (not in Excel):', toDelete.length);
  const batchSize = 100;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const { error } = await supabase.from('items').delete().in('barcode', batch);
    if (error) {
      console.error('Delete batch error:', error.message);
      break;
    }
    deleted += batch.length;
    console.log('Deleted', deleted, '/', toDelete.length);
  }
  console.log('Done. Deleted', deleted, 'item(s) that were not in Excel.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
