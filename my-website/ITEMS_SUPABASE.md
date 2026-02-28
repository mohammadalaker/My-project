# جدول المخزون/المنتجات (items) — هيكلة Supabase و RLS

التطبيق يعتمد على جدول باسم **`items`** (وليس `inventory` ولا `products`). هذا الملف يوضح الهيكلة المطلوبة وإعدادات الأمان.

---

## 1. هيكلة الجدول (الأعمدة المطلوبة)

تأكد أن جدول **`items`** في Supabase يحتوي على الأعمدة التالية بما يطابق ما يعرضه التطبيق:

| العمود في Supabase | الوظيفة في التطبيق | ملاحظات |
|-------------------|---------------------|----------|
| `barcode`         | معرّف المنتج (فريد) | مطلوب، يُستخدم كمفتاح |
| `eng_name`        | اسم المنتج           | يعرض كـ "اسم المنتج" |
| `brand_group`     | الفئة/المجموعة      | مثل: أدوات كهربائية، منزلية، Tefal |
| `box_count`       | عدد الكراتين        | اختياري |
| `full_price`      | السعر               | رقم (السعر الأساسي) |
| `price_after_disc`| السعر بعد الخصم     | اختياري، إن وُجد يُعرض كسعر الترويج |
| `stock_count`     | الكمية المتوفرة     | رقم (المخزون) |
| `image_url`       | رابط الصورة         | نص (مسار أو URL) |
| `is_offer`        | عرض ترويجي؟         | boolean |
| `visible`         | ظاهر في الكتالوج؟   | boolean، غير ظاهر = مخفي من الواجهة |
| `product_type`    | نوع المنتج           | اختياري |

**مقارنة مع اقتراحك:**
- اسم المنتج ← **`eng_name`** (وليس `name`)
- الكمية ← **`stock_count`** (وليس `quantity`)
- السعر ← **`full_price`** (وليس `price`)
- الفئة ← **`brand_group`** (وليس `category`)
- الصورة ← **`image_url`** ✓

إذا أنشأت الجدول يدوياً، يمكنك استخدام SQL التالي في **Supabase → SQL Editor**:

```sql
-- إنشاء جدول items إن لم يكن موجوداً (تعدّل الأنواع حسب حاجتك)
CREATE TABLE IF NOT EXISTS public.items (
  barcode          TEXT PRIMARY KEY,
  eng_name         TEXT,
  brand_group      TEXT,
  box_count        TEXT,
  full_price       NUMERIC(12,2),
  price_after_disc NUMERIC(12,2),
  stock_count      INTEGER DEFAULT 0,
  image_url        TEXT,
  is_offer         BOOLEAN DEFAULT false,
  visible          BOOLEAN DEFAULT true,
  product_type     TEXT
);
```

---

## 2. تفعيل الوصول للبيانات (RLS — Row Level Security)

لتمكين التطبيق من **قراءة** و**كتابة** بيانات المخزون (عرض المنتجات، إضافة/تعديل/حذف من لوحة الإدارة)، يجب إعداد سياسات RLS لجدول **`items`**.

### الخطوات في Supabase

1. اذهب إلى **Table Editor** واختر جدول **`items`**.
2. من تبويب **Authentication** أو من **SQL Editor** يمكنك تنفيذ السياسات أدناه.

### سياسات مقترحة (قراءة للجميع — أو للمصادقين فقط)

**الخيار أ — السماح بالقراءة للجميع (مخزون عام):**

مفيد إذا كانت واجهة الكتالوج تفتح بدون تسجيل دخول، وتريد أن يرى الجميع المنتجات.

```sql
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- قراءة (عرض المنتجات في الكتالوج والطلبات)
CREATE POLICY "Allow read items" ON public.items FOR SELECT USING (true);

-- إدراج (إضافة منتج جديد — عادة للمسؤول فقط من التطبيق)
CREATE POLICY "Allow insert items" ON public.items FOR INSERT WITH CHECK (true);

-- تحديث (تعديل سعر، كمية، صورة، إلخ)
CREATE POLICY "Allow update items" ON public.items FOR UPDATE USING (true) WITH CHECK (true);

-- حذف (حذف منتج)
CREATE POLICY "Allow delete items" ON public.items FOR DELETE USING (true);
```

**الخيار ب — السماح للمصادقين فقط (Authenticated users only):**

إذا كنت تستخدم **Supabase Auth** وتريد أن يصل للمخزون فقط المستخدمون المسجلون، استبدل `USING (true)` بـ `USING (auth.role() = 'authenticated')` (وتكيف السياسات حسب أدوارك).

### إذا ظهر أن السياسة موجودة مسبقاً

احذفها ثم أعد إنشاءها:

```sql
DROP POLICY IF EXISTS "Allow read items" ON public.items;
DROP POLICY IF EXISTS "Allow insert items" ON public.items;
DROP POLICY IF EXISTS "Allow update items" ON public.items;
DROP POLICY IF EXISTS "Allow delete items" ON public.items;
```

ثم شغّل أوامر `CREATE POLICY` أعلاه من جديد.

---

## 3. ملخص اقتراحك

| اقتراحك | التطبيق الفعلي |
|---------|-----------------|
| جدول `inventory` أو `products` | الجدول المستخدم هو **`items`** |
| عمود `name` | **`eng_name`** |
| عمود `quantity` | **`stock_count`** |
| عمود `price` | **`full_price`** |
| عمود `category` | **`brand_group`** |
| عمود `image_url` | **`image_url`** ✓ |
| RLS: Enable read access for all / Authenticated | نعم — نفس الفكرة؛ استخدم السياسات أعلاه لجدول **`items`** |

بعد التأكد من هيكلة **`items`** وإعداد سياسات RLS كما هو موضح، سيعمل عرض المخزون والإضافة/التعديل من التطبيق بشكل صحيح.
