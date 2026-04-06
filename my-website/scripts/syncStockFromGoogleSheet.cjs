/**
 * ====================================================
 * syncStockFromGoogleSheet.cjs
 * مزامنة المخزون (stock_count) من Google Sheet إلى Supabase
 * ====================================================
 *
 * الإعداد:
 *  1) تأكد أن GOOGLE_SHEET_EXPORT_URL موجود في my-website/.env
 *     مثال: GOOGLE_SHEET_EXPORT_URL="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=xlsx&gid=GID"
 *  2) تأكد أن الجدول مشارك «أي شخص لديه الرابط» للعرض
 *  3) تأكد أن VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY موجودان في .env
 *
 * التشغيل:
 *   node scripts/syncStockFromGoogleSheet.cjs
 *   أو مع رابط مباشر:
 *   node scripts/syncStockFromGoogleSheet.cjs "https://docs.google.com/spreadsheets/d/.../export?format=xlsx"
 *
 * الأعمدة المتوقعة في Google Sheet (تلقائي):
 *   - الباركود: Barcode / barcode / باركود / الباركود / Code / كود
 *   - المخزون:  Stock / stock / المخزون / الكمية المخزنة / Inventory / Qty stock / الكمية / Qty / Quantity / Count
 *
 * ملاحظة: الأصناف الموجودة في Supabase لكن غير موجودة في الكشف → stock_count = 0
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// ─── مفاتيح الأعمدة ────────────────────────────────
const BARCODE_KEYS = ['Barcode', 'barcode', 'باركود', 'الباركود', 'Barcode number', 'رمز الباركود', 'Code', 'كود'];
const STOCK_KEYS   = ['Stock', 'stock', 'المخزون', 'الكمية المخزنة', 'Inventory', 'Qty stock', 'الكمية', 'Qty', 'Quantity', 'Count'];
const NAME_KEYS    = ['Eng-Name', 'Eng Name', 'الوصف', 'Description', 'Name', 'Item', 'اسم القطعة'];

// ─── مساعدات ───────────────────────────────────────
function findCol(row, keys) {
  if (!row || !Array.isArray(row)) return -1;
  const low = (v) => String(v ?? '').toLowerCase().trim();
  for (let i = 0; i < row.length; i++) {
    const c = low(row[i]);
    if (keys.some((k) => c === k.toLowerCase() || c.includes(k.toLowerCase().split(/[\s/]+/)[0])))
      return i;
  }
  return -1;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : Math.max(0, Math.round(n));
}

function toStr(v) {
  return String(v ?? '').trim();
}

function canonicalBarcode(s) {
  if (s == null || s === '') return '';
  let x = String(s).trim().replace(/\s/g, '');
  if (/^\d+$/.test(x)) x = x.replace(/^0+/, '') || '0';
  return x;
}

// ─── إعداد البيئة .env ─────────────────────────────
function parseEnvFile(content) {
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (key) process.env[key] = val;
  });
}

function loadEnv() {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'my-website', '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  const seen = new Set();
  for (const p of candidates) {
    const resolved = path.resolve(p);
    if (seen.has(resolved) || !fs.existsSync(resolved)) continue;
    seen.add(resolved);
    let raw = fs.readFileSync(resolved, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    parseEnvFile(raw);
    console.log('✓ Loaded .env from:', resolved);
  }
}

// ─── تحميل Google Sheet ────────────────────────────
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; StockSync/1.0)',
  Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, */*',
};

function extractSpreadsheetId(u) {
  const m = String(u).match(/\/spreadsheets\/d\/([^/]+)/);
  return m ? m[1] : null;
}

function buildExportUrls(originalUrl) {
  const id = extractSpreadsheetId(originalUrl);
  const gidMatch = String(originalUrl).match(/[?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  const list = [originalUrl.trim()];
  if (id) {
    list.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx&gid=${gid}`);
    list.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`);
  }
  return [...new Set(list)];
}

async function fetchSheetBuffer(originalUrl) {
  const id = extractSpreadsheetId(originalUrl);
  if (!id) throw new Error('الرابط لا يحتوي على معرّف الجدول (/spreadsheets/d/معرّف/)');

  let lastErr = null;
  for (const url of buildExportUrls(originalUrl)) {
    let res;
    try {
      res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    } catch (e) {
      lastErr = e;
      continue;
    }
    if (!res.ok) {
      lastErr = new Error(`HTTP ${res.status}`);
      if (res.status === 404) continue;
      throw new Error(`فشل تحميل الجدول: ${lastErr.message}`);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    // تحقق ألا يكون HTML (صفحة تسجيل دخول)
    const sample = buf.slice(0, 200).toString('utf8').replace(/^\uFEFF/, '').trimStart();
    if (ct.includes('text/html') || sample.startsWith('<!') || sample.toLowerCase().startsWith('<html')) {
      lastErr = new Error('الرابط يعيد HTML بدلاً من ملف. تأكد من مشاركة الجدول للعموم.');
      continue;
    }
    return { buf, isCsv: ct.includes('csv') || url.includes('format=csv') };
  }
  throw new Error(
    `فشل تحميل الجدول: ${lastErr ? lastErr.message : 'غير معروف'}.\n` +
    'تأكد من:\n' +
    '  1) الجدول مشارك «أي شخص لديه الرابط» → عرض\n' +
    '  2) الرابط يحتوي على معرف صحيح في /d/معرّف/\n' +
    '  3) افتح الرابط في المتصفح للتأكد أنه يحمّل ملف xlsx'
  );
}

// ─── قراءة بيانات المخزون من الورقة ───────────────
function readStockFromWorkbook(wb) {
  /** { بارcoderCanonical: stockNumber } */
  const stockMap = {};
  let totalRows = 0;

  for (const sheetName of (wb.SheetNames || [])) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!data || data.length < 2) continue;

    const header = data[0];
    const barcodeIdx = findCol(header, BARCODE_KEYS);
    const stockIdx   = findCol(header, STOCK_KEYS);
    const nameIdx    = findCol(header, NAME_KEYS);

    if (barcodeIdx < 0) {
      console.warn(`  ⚠ الورقة "${sheetName}": لم يُعثر على عمود الباركود (${BARCODE_KEYS.join(' / ')})`);
      continue;
    }

    if (stockIdx < 0) {
      console.warn(`  ⚠ الورقة "${sheetName}": لم يُعثر على عمود المخزون (${STOCK_KEYS.join(' / ')})`);
      console.warn(`    الأعمدة الموجودة: ${header.slice(0, 15).join(' | ')}`);
      continue;
    }

    console.log(`  ◈ الورقة "${sheetName}": باركود=عمود[${barcodeIdx}] (${header[barcodeIdx]}) | مخزون=عمود[${stockIdx}] (${header[stockIdx]})`);

    let sheetRows = 0;
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const rawBarcode = toStr(row[barcodeIdx]);
      if (!rawBarcode) continue;
      const bc = canonicalBarcode(rawBarcode);
      if (!bc) continue;

      const stock = toNum(row[stockIdx]);
      // إذا وُجد الباركود مرتين، نأخذ القيمة الأعلى (لتجنب مسح بيانات صحيحة)
      if (bc in stockMap) {
        if (stock !== null && (stockMap[bc] === null || stock > stockMap[bc])) {
          stockMap[bc] = stock;
        }
      } else {
        stockMap[bc] = stock ?? 0;
      }
      // احفظ أيضاً الباركود الخام
      const rawKey = rawBarcode.replace(/\s/g, '');
      if (rawKey !== bc) {
        stockMap[rawKey] = stockMap[bc];
      }
      sheetRows++;
    }
    console.log(`    → ${sheetRows} صف مقروء`);
    totalRows += sheetRows;
  }

  console.log(`\nإجمالي الصفوف المقروءة: ${totalRows} | باركودات فريدة: ${Object.keys(stockMap).length}`);
  return stockMap;
}

// ─── جلب كل الأصناف من Supabase ───────────────────
async function fetchAllSupabaseItems(supabase) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('barcode, stock_count')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ─── التحديث الرئيسي ───────────────────────────────
async function syncStock(supabase, stockMap) {
  console.log('\nجاري جلب الأصناف من Supabase...');
  const supabaseItems = await fetchAllSupabaseItems(supabase);
  console.log(`أصناف Supabase: ${supabaseItems.length}`);

  const toUpdate = []; // [{ barcode, newStock, oldStock }]

  for (const item of supabaseItems) {
    const rawBc = String(item.barcode || '').trim();
    const canBc = canonicalBarcode(rawBc);
    const cleanBc = rawBc.replace(/\s/g, '');

    // ابحث بأشكال مختلفة للباركود
    let newStock = stockMap[rawBc] ?? stockMap[canBc] ?? stockMap[cleanBc] ?? null;

    // إذا لم يوجد في الكشف → مخزون 0
    if (newStock === null) newStock = 0;

    const oldStock = item.stock_count ?? 0;

    if (newStock !== oldStock) {
      toUpdate.push({ barcode: rawBc, newStock, oldStock });
    }
  }

  if (toUpdate.length === 0) {
    console.log('\n✅ المخزون محدّث بالفعل — لا توجد تغييرات مطلوبة.');
    return;
  }

  console.log(`\nأصناف تحتاج تحديث المخزون: ${toUpdate.length}`);

  // عرض أول 15 تغيير للمراجعة
  console.log('\nأول التغييرات:');
  toUpdate.slice(0, 15).forEach(({ barcode, oldStock, newStock }) => {
    const arrow = newStock === 0 ? '⬇ 0' : `${oldStock} → ${newStock}`;
    console.log(`  ${barcode.padEnd(20)} ${arrow}`);
  });
  if (toUpdate.length > 15) {
    console.log(`  ... و${toUpdate.length - 15} أخرى`);
  }

  // تحديث على دفعات
  const BATCH = 50;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);

    // نجمّع الأصناف حسب قيمة المخزون لتقليل عدد الطلبات
    const byStock = {};
    for (const { barcode, newStock } of batch) {
      const key = String(newStock);
      if (!byStock[key]) byStock[key] = { stock: newStock, barcodes: [] };
      byStock[key].barcodes.push(barcode);
    }

    for (const { stock, barcodes } of Object.values(byStock)) {
      const { error } = await supabase
        .from('items')
        .update({ stock_count: stock })
        .in('barcode', barcodes);

      if (error) {
        console.error(`\n❌ خطأ في تحديث دفعة (stock=${stock}):`, error.message);
        failed += barcodes.length;
      } else {
        updated += barcodes.length;
      }
    }

    process.stdout.write(`\rالتقدم: ${Math.min(i + BATCH, toUpdate.length)} / ${toUpdate.length}`);
  }

  console.log(`\n\n${failed === 0 ? '✅' : '⚠'} اكتمل — تم تحديث: ${updated} | فشل: ${failed}`);
  if (failed > 0) {
    console.error('تحقق من صلاحيات Supabase (RLS Policy) للسماح بالتحديث.');
  }
}

// ─── الدالة الرئيسية ───────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(' مزامنة المخزون من Google Sheet → Supabase ');
  console.log('═══════════════════════════════════════════════\n');

  loadEnv();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ مفاتيح Supabase غير موجودة في .env');
    console.error('الملف يجب أن يحتوي على: VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const exportUrl =
    process.env.GOOGLE_SHEET_EXPORT_URL ||
    process.env.GOOGLE_SHEETS_EXPORT_URL ||
    (process.argv[2] && String(process.argv[2]).trim());

  if (!exportUrl) {
    console.error('❌ رابط Google Sheet غير موجود.');
    console.error('أضف في my-website/.env:');
    console.error('  GOOGLE_SHEET_EXPORT_URL="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=xlsx&gid=GID"');
    console.error('أو مرّر الرابط مباشرة:');
    console.error('  node scripts/syncStockFromGoogleSheet.cjs "https://..."');
    process.exit(1);
  }

  console.log('الرابط:', exportUrl.slice(0, 80) + (exportUrl.length > 80 ? '...' : ''));
  console.log('\nجاري تحميل جدول Google Sheet...');

  const { buf, isCsv } = await fetchSheetBuffer(exportUrl);
  console.log(`✓ تم التحميل (${(buf.length / 1024).toFixed(1)} KB، نوع: ${isCsv ? 'CSV' : 'XLSX'})\n`);

  const wb = isCsv
    ? XLSX.read(buf.toString('utf8'), { type: 'string' })
    : XLSX.read(buf, { type: 'buffer' });

  const stockMap = readStockFromWorkbook(wb);

  if (Object.keys(stockMap).length === 0) {
    console.error('\n❌ لم يُقرأ أي مخزون من الجدول.');
    console.error('تأكد من أن أسماء الأعمدة صحيحة:');
    console.error('  الباركود:', BARCODE_KEYS.join(' / '));
    console.error('  المخزون:', STOCK_KEYS.join(' / '));
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  await syncStock(supabase, stockMap);
}

main().catch((err) => {
  console.error('\n❌ خطأ غير متوقع:', err.message || err);
  process.exit(1);
});
