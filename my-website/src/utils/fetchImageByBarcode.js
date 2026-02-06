/**
 * Fetch product image URL by barcode from the web.
 * Uses Open Food Facts (free, no API key). For electronics/household items
 * not all barcodes may be available.
 */
const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v0/product';

export async function fetchImageUrlByBarcode(barcode) {
  const code = String(barcode ?? '').trim();
  if (!code) return null;
  try {
    const res = await fetch(`${OPEN_FOOD_FACTS_API}/${code}.json`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    const url = data?.product?.image_url || data?.product?.image_small_url || null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Fetch images for multiple barcodes with delay between requests to avoid rate limits.
 */
export async function fetchImageUrlsForBarcodes(barcodes, onProgress) {
  const results = {};
  const list = [...new Set(barcodes)].filter(Boolean);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < list.length; i++) {
    const barcode = list[i];
    const url = await fetchImageUrlByBarcode(barcode);
    if (url) results[barcode] = url;
    if (onProgress) onProgress(i + 1, list.length, barcode, !!url);
    if (i < list.length - 1) await delay(400);
  }
  return results;
}
