const XLSX = require('xlsx');
const JSZip = require('jszip');
const path = require('path');
const fs = require('fs');

const NAME_KEYS = ['Eng-Name', 'Eng Name', 'الوصف', 'Description', 'Name', 'Item', 'اسم القطعة'];
const QTY_KEYS = ['Qty', 'Quantity', 'الكمية', 'Count'];
const PRICE_KEYS = ['Price', 'price', 'السعر', 'Unit Price', 'Cost'];
const PRICE_AFTER_DISCOUNT_KEYS = ['Price after dic', 'price after dic', 'Price after discount', 'price after discount', 'السعر بعد الخصم', 'سعر بعد الخصم', 'بعد الخصم', 'السعر النهائي', 'Net price'];
const GROUP_KEYS = ['group', 'Group', 'المجموعة', 'الفئة', 'Category', 'صنف', 'ماركة', 'Brand', 'الصنف'];
const BARCODE_KEYS = ['Barcode', 'barcode', 'باركود', 'الباركود', 'Barcode number', 'رمز الباركود', 'Code', 'كود'];
const BOX_KEYS = ['Box', 'box', 'صندوق', 'الصندوق', 'الخانة', 'خانة', 'مربع', 'المربع', 'ص.'];
const STOCK_KEYS = ['Stock', 'stock', 'المخزون', 'الكمية المخزنة', 'Inventory', 'Qty stock'];
const DISCOUNT_AMOUNT_KEYS = ['مبلغ الخصم', 'مبلغ خصم', 'Discount amount', 'discount amount', 'Discount', 'discount', 'الخصم', 'خصم', 'Discount value'];

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

function sanitizeBarcode(s) {
  return String(s ?? '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 48);
}

function loadElectricByBarcode() {
  const jsonPath = path.join(__dirname, '..', 'src', 'data', 'electricByBarcode.json');
  if (!fs.existsSync(jsonPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.warn('Could not load electricByBarcode.json:', e.message);
    return {};
  }
}

function normalizeBarcode(s) {
  return String(s ?? '').replace(/\D/g, '');
}

async function extractImages(buf, outDir, barcodesByRowIndex) {
  const images = [];
  const barcodeToUrl = {};
  const used = new Set();
  try {
    const zip = await JSZip.loadAsync(buf);
    const xl = zip.folder('xl');
    if (!xl) return { urls: images, barcodeToUrl };
    const media = xl.folder('media');
    if (!media) return { urls: images, barcodeToUrl };
    const names = [];
    media.forEach((p, file) => { if (!file.dir) names.push(p); });
    names.sort((a, b) => String(a).localeCompare(b, undefined, { numeric: true }));
    fs.mkdirSync(outDir, { recursive: true });
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const ext = path.extname(name) || '.png';
      const barcode = (barcodesByRowIndex && barcodesByRowIndex[i]) ? toStr(barcodesByRowIndex[i]) : '';
      const sb = sanitizeBarcode(barcode);
      let outName;
      if (sb && barcode) {
        if (used.has(sb + ext)) {
          outName = `image${i + 1}${ext}`;
        } else {
          used.add(sb + ext);
          outName = sb + ext;
          barcodeToUrl[barcode] = `/inventory-images/${outName}`;
        }
      } else {
        outName = `image${i + 1}${ext}`;
      }
      const outPath = path.join(outDir, outName);
      const blob = await media.file(name).async('nodebuffer');
      fs.writeFileSync(outPath, blob);
      images.push(`/inventory-images/${outName}`);
    }
  } catch (e) {
    console.warn('Could not extract images:', e.message);
  }
  return { urls: images, barcodeToUrl };
}

function parseSheetRows(sheetName, data) {
  if (!data || data.length < 2) return { rows: [], barcodes: [] };
  const header = data[0];
  const nameIdx = findCol(header, NAME_KEYS);
  const qtyIdx = findCol(header, QTY_KEYS);
  const priceIdx = findCol(header, PRICE_KEYS);
  const groupIdx = findCol(header, GROUP_KEYS);
  const barcodeIdx = findCol(header, BARCODE_KEYS);
  let boxIdx = findCol(header, BOX_KEYS);
  if (boxIdx < 0 && header.length > 5) boxIdx = 5;
  // السعر بعد الخصم من عمود G (الفهرس 6: A=0, B=1, ..., G=6)
  const priceAfterDiscountIdx = 6;
  // Stock من عمود J (الفهرس 9: A=0, B=1, ..., J=9)
  const stockIdx = 9;
  const discountAmountIdx = findCol(header, DISCOUNT_AMOUNT_KEYS);

  const rows = [];
  const barcodes = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const name = nameIdx >= 0 ? toStr(row[nameIdx]) : toStr(row[0]);
    const qty = qtyIdx >= 0 ? toNum(row[qtyIdx]) : toNum(row[1]);
    const price = priceIdx >= 0 ? toNum(row[priceIdx]) : toNum(row[2]);
    if (!name && qty === 0 && price === 0) continue;
    const barcode = barcodeIdx >= 0 ? toStr(row[barcodeIdx]) : '';
    barcodes.push(barcode);
    let priceAfterDiscount = priceAfterDiscountIdx >= 0 ? toNum(row[priceAfterDiscountIdx]) : null;
    if (discountAmountIdx >= 0) {
      const discountAmount = toNum(row[discountAmountIdx]);
      if (discountAmount > 0 && price > 0) {
        const fromDiscount = Math.max(0, price - discountAmount);
        priceAfterDiscount = priceAfterDiscount != null && priceAfterDiscount > 0 ? priceAfterDiscount : fromDiscount;
      }
    }
    rows.push({
      sheetName,
      name,
      qty,
      price,
      priceAfterDiscount,
      group: groupIdx >= 0 ? (toStr(row[groupIdx]) || '—') : '—',
      barcode,
      boxRaw: boxIdx >= 0 ? row[boxIdx] : '',
      stock: stockIdx >= 0 ? toNum(row[stockIdx]) : null,
    });
  }
  return { rows, barcodes };
}

async function main() {
  const runSyncElectric = require('./syncElectric.cjs').runSyncElectric;
  runSyncElectric();

  const excelPath = path.join(__dirname, '..', '..', 'كشف القطع الصغيرة و المنزلي.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('Excel file not found:', excelPath);
    process.exit(1);
  }

  const buf = fs.readFileSync(excelPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetNames = wb.SheetNames || [];
  if (!sheetNames.length) {
    console.error('No sheets in workbook');
    process.exit(1);
  }

  const allRows = [];
  const barcodesByRowIndex = [];

  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const { rows, barcodes } = parseSheetRows(sheetName, data);
    for (let i = 0; i < rows.length; i++) {
      allRows.push(rows[i]);
      barcodesByRowIndex.push(barcodes[i]);
    }
  }

  const imagesDir = path.join(__dirname, '..', 'public', 'inventory-images');
  const { urls: imageUrls, barcodeToUrl } = await extractImages(buf, imagesDir, barcodesByRowIndex);
  const byBarcodeCount = Object.keys(barcodeToUrl).length;
  console.log('Extracted', imageUrls.length, 'images;', byBarcodeCount, 'linked by barcode from Excel → public/inventory-images/');
  console.log('Sheets read:', sheetNames.join(', '));

  const electricByBarcode = loadElectricByBarcode();
  const electricCount = Object.keys(electricByBarcode).length;
  if (electricCount > 0) console.log('Loaded', electricCount, 'image(s) from Electric (electricByBarcode.json) — الصور حسب الباركود من Electric لها الأولوية.');

  const items = [];
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const boxRaw = row.boxRaw;
    const box = boxRaw !== undefined && boxRaw !== null && String(boxRaw).trim() !== '' ? String(boxRaw).trim() : null;
    const excelImage = (row.barcode && barcodeToUrl[row.barcode]) ? barcodeToUrl[row.barcode] : (imageUrls[i] || null);
    const bcNorm = row.barcode ? normalizeBarcode(row.barcode) : '';
    const electricImage = (row.barcode && electricByBarcode[row.barcode]) || (bcNorm && electricByBarcode[bcNorm]) || null;
    const imageUrl = electricImage || excelImage;
    const pad = row.priceAfterDiscount != null && row.priceAfterDiscount > 0 ? Math.round(row.priceAfterDiscount) : null;
    items.push({
      id: i + 1,
      name: row.name || '—',
      group: row.group,
      box: box,
      price: Math.max(0, row.price),
      priceAfterDiscount: pad,
      qty: Math.max(0, row.qty),
      stock: row.stock != null && row.stock > 0 ? Math.round(row.stock) : null,
      status: row.qty <= 2 ? 'Low Stock' : row.qty <= 5 ? 'Good' : 'Excellent',
      image: imageUrl,
      barcode: row.barcode || null,
      sheet: row.sheetName,
    });
  }

  const outPath = path.join(__dirname, '..', 'src', 'data', 'inventoryFromExcel.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf8');
  console.log('Written', items.length, 'items from', sheetNames.length, 'sheet(s) to', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
