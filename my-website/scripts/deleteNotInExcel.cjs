/**
 * أصناف غير موجودة في ملف الإكسل المحلي → تحديث Supabase.
 * انظر أيضاً: deleteNotInGoogleSheet.cjs إذا كان الكشف على Google Sheets.
 */
const { createClient } = require('@supabase/supabase-js');
const k = require('./kashfSyncShared.cjs');

async function main() {
  k.loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const excelPath = k.resolveExcelPath();
  console.log('Using Excel file:', excelPath);
  console.log('Reading barcodes from Excel...');
  const excelBarcodes = k.getBarcodesFromExcelFile(excelPath);
  console.log('Barcodes in Excel:', excelBarcodes.size);

  const supabase = createClient(url, key);
  await k.markItemsNotInKashf(supabase, excelBarcodes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
