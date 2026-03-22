import supabase from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

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
  if (img.startsWith('http://') || img.startsWith('https://')) return img;

  const path = img.replace(/^\//, '');

  const transform = size === 'full' ? null : STORAGE_IMAGE_TRANSFORMS[size] || STORAGE_IMAGE_TRANSFORMS.thumb;

  if (transform) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path, { transform });
    if (data?.publicUrl) return data.publicUrl;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` : img);
}
