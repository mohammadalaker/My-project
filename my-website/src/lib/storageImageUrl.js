import supabase from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

/**
 * تفعيل بروكسي الصور (wsrv.nl على Cloudflare) لتقليل Cached Egress من Supabase:
 * الطلبات المتكررة تُخدم من كاش البروكسي بدل إعادة سحب/تحويل الصورة من Supabase.
 * عطّل بـ VITE_USE_CDN_IMAGE_PROXY=false إذا احتجت التحويل المباشر من Supabase فقط.
 */
const USE_CDN_IMAGE_PROXY =
  import.meta.env.VITE_USE_CDN_IMAGE_PROXY !== 'false' &&
  import.meta.env.VITE_USE_CDN_IMAGE_PROXY !== '0';

const WSRV_ORIGIN = 'https://wsrv.nl';

/**
 * إعدادات Supabase Image Transformation (مصغّرات أخف للشبكة).
 * thumb: قوائم وكروت | medium: تفاصيل منتج / شاشة توقف | tiny: شعارات صغيرة
 */
export const STORAGE_IMAGE_TRANSFORMS = {
  thumb: { width: 400, quality: 72, resize: 'contain' },
  medium: { width: 1000, quality: 78, resize: 'contain' },
  tiny: { width: 128, quality: 70, resize: 'contain' },
};

/** قيمة max-age (بالثواني) لـ Cache-Control عند رفع الملفات إلى Storage — تُخزَّن على الـ CDN/المتصفح وتقلل الـ egress */
export const STORAGE_UPLOAD_CACHE_CONTROL = '31536000';

/**
 * @param {string} sourceUrl
 * @param {{ width: number, quality?: number, resize?: string }} transform
 */
function buildWsrvImageUrl(sourceUrl, transform) {
  if (!sourceUrl || !transform?.width) return sourceUrl;
  const u = new URL(`${WSRV_ORIGIN}/`);
  u.searchParams.set('url', sourceUrl);
  u.searchParams.set('w', String(transform.width));
  u.searchParams.set('q', String(transform.quality ?? 75));
  const fit = transform.resize === 'cover' ? 'cover' : 'contain';
  u.searchParams.set('fit', fit);
  u.searchParams.set('output', 'webp');
  return u.toString();
}

function isSupabaseProjectUrl(url) {
  if (!SUPABASE_URL || !url || typeof url !== 'string') return false;
  try {
    const host = new URL(SUPABASE_URL).hostname;
    return url.includes(host);
  } catch {
    return false;
  }
}

function getRawObjectPublicUrl(path, bucket) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` : null);
}

/**
 * رابط عام لصورة في Storage مع تحويل اختياري.
 *
 * @param {string} imageValue مسار داخل البوكت أو رابط http(s) كامل
 * @param {{
 *   bucket?: string,
 *   size?: 'thumb' | 'medium' | 'tiny' | 'full',
 *   thumb?: boolean,
 * }} [options]
 * - `thumb: true` → size thumb
 * - `thumb: false` → size medium (للتوافق مع App: عرض تفاصيل بدون الملف الأصلي الضخم)
 */
export function getStoragePublicImageUrl(imageValue, options = {}) {
  const bucket = options.bucket || 'Pic_of_items';

  let size = options.size || 'thumb';
  if (options.thumb === true) size = 'thumb';
  if (options.thumb === false) size = 'medium';

  if (!imageValue || typeof imageValue !== 'string') return null;
  const img = String(imageValue).trim();
  if (!img) return null;

  if (img.startsWith('http://') || img.startsWith('https://')) {
    if (USE_CDN_IMAGE_PROXY && isSupabaseProjectUrl(img)) {
      const transform = size === 'full' ? null : STORAGE_IMAGE_TRANSFORMS[size] || STORAGE_IMAGE_TRANSFORMS.thumb;
      if (!transform) return img;
      return buildWsrvImageUrl(img, transform);
    }
    return img;
  }

  const path = img.replace(/^\//, '');

  const transform = size === 'full' ? null : STORAGE_IMAGE_TRANSFORMS[size] || STORAGE_IMAGE_TRANSFORMS.thumb;

  if (USE_CDN_IMAGE_PROXY) {
    const rawUrl = getRawObjectPublicUrl(path, bucket);
    if (!rawUrl) return null;
    if (!transform) return rawUrl;
    return buildWsrvImageUrl(rawUrl, transform);
  }

  if (transform) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path, { transform });
    if (data?.publicUrl) return data.publicUrl;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` : img);
}
