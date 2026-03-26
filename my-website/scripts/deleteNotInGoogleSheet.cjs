/**
 * نفس منطق delete-not-in-excel لكن مصدر الباركودات = تصدير Google Sheets (رابط).
 *
 * الإعداد:
 * 1) افتح جدول Google Sheet → مشاركة → أي شخص لديه الرابط يمكنه العرض (أو استخدم حساب خدمة لاحقاً).
 * 2) انسخ رابط التصدير بصيغة xlsx:
 *    https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=xlsx
 *    (استبدل SPREADSHEET_ID من رابط الجدول في المتصفح)
 * 3) ضع الرابط في my-website/.env:
 *    GOOGLE_SHEET_EXPORT_URL="https://docs.google.com/spreadsheets/d/....../export?format=xlsx"
 *
 * التشغيل: npm run delete-not-in-google-sheet
 * أو: node scripts/deleteNotInGoogleSheet.cjs "https://..."
 */
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const k = require('./kashfSyncShared.cjs');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; KashfSync/1.0)',
  Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, */*',
};

function extractSpreadsheetId(u) {
  const m = String(u).match(/\/spreadsheets\/d\/([^/]+)/);
  return m ? m[1] : null;
}

function looksLikePlaceholderId(id) {
  if (!id) return true;
  const s = String(id).toLowerCase();
  if (s === 'spreadsheet_id' || s.includes('your_spreadsheet') || s.includes('your-sheet') || s.includes('placeholder')) {
    return true;
  }
  // معرّفات Google عادة 25+ حرفاً؛ القيم القصيرة غالباً خطأ أو placeholder
  return s.length < 25;
}

/** إذا كان المعرّف قصيراً جداً أو placeholder واضح */
function validateSpreadsheetId(id) {
  if (!id || looksLikePlaceholderId(id)) {
    throw new Error(
      'معرّف الجدول في الرابط غير صالح أو ما زال placeholder. انسخ المعرف من شريط العنوان بين ‎/d/‎ و‎/edit‎ (مثلاً طوله ~44 حرفاً) ثم ضع الرابط: https://docs.google.com/spreadsheets/d/المعرف/export?format=xlsx'
    );
  }
}

function withQueryParam(url, key, value) {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + `${key}=${value}`;
}

function buildExportUrls(originalUrl) {
  const id = extractSpreadsheetId(originalUrl);
  const gidMatch = String(originalUrl).match(/[?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  const list = [originalUrl.trim()];
  if (id) {
    list.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx&gid=${gid}`);
    if (!/[?&]gid=/.test(originalUrl)) {
      list.push(withQueryParam(originalUrl, 'gid', gid));
    }
    list.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`);
  }
  return [...new Set(list)];
}

async function fetchExportBuffer(originalUrl) {
  const id = extractSpreadsheetId(originalUrl);
  if (!id) {
    throw new Error(
      'الرابط لا يحتوي على ‎/spreadsheets/d/المعرف/‎. مثال صحيح: https://docs.google.com/spreadsheets/d/xxxxxxxx/export?format=xlsx'
    );
  }
  validateSpreadsheetId(id);

  let lastErr = null;
  const urls = buildExportUrls(originalUrl);

  for (const url of urls) {
    const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    if (!res.ok) {
      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
      if (res.status === 404) continue;
      throw new Error(`فشل تحميل التصدير: ${lastErr.message}. تأكد من مشاركة الجدول (عرض) أو صحة الرابط.`);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    const sample = buf.slice(0, 400).toString('utf8').replace(/^\uFEFF/, '').trimStart();
    const looksHtml =
      ct.includes('text/html') ||
      sample.startsWith('<!') ||
      sample.toLowerCase().startsWith('<html');
    if (looksHtml) {
      lastErr = new Error('HTML');
      continue;
    }
    return { buf, isCsv: ct.includes('csv') || url.includes('format=csv') };
  }

  throw new Error(
    `فشل تحميل التصدير: ${lastErr ? lastErr.message : '404'}. تأكد من: (1) استبدال معرّف الجدول الحقيقي في الرابط، (2) مشاركة «أي شخص لديه الرابط» للعرض، (3) فتح الرابط في المتصفح بدون تسجيل دخول يحمّل ملفاً وليس صفحة خطأ.`
  );
}

async function main() {
  k.loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const exportUrl =
    process.env.GOOGLE_SHEET_EXPORT_URL ||
    process.env.GOOGLE_SHEETS_EXPORT_URL ||
    (process.argv[2] && String(process.argv[2]).trim());

  if (!exportUrl) {
    console.error('Missing GOOGLE_SHEET_EXPORT_URL (لم يُقرأ من .env ولا من وسيط سطر الأوامر).');
    console.error('');
    k.listEnvFileStatus();
    console.error('');
    console.error('أضف سطرًا في ملف .env الموجود (✓ أعلاه)، مثال:');
    console.error('  GOOGLE_SHEET_EXPORT_URL="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=xlsx"');
    console.error('أو شغّل مرة واحدة مع الرابط:');
    console.error('  node my-website/scripts/deleteNotInGoogleSheet.cjs "https://docs.google.com/spreadsheets/d/.../export?format=xlsx"');
    process.exit(1);
  }

  console.log('Downloading Google Sheet export...');
  const { buf, isCsv } = await fetchExportBuffer(exportUrl);
  const wb = isCsv
    ? XLSX.read(buf.toString('utf8'), { type: 'string' })
    : XLSX.read(buf, { type: 'buffer' });
  const excelBarcodes = k.getBarcodesFromWorkbook(wb);
  console.log('Barcodes in Sheet (kashf):', excelBarcodes.size);

  const supabase = createClient(url, key);
  await k.markItemsNotInKashf(supabase, excelBarcodes);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
