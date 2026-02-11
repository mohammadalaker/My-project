# جدول الطلبات (orders) في Supabase

عند ظهور رسالة **"Could not find the table 'public.orders'"** يعني أن جدول الطلبات غير موجود. أنشئه أولاً ثم فعّل الصلاحيات.

---

# 🚨 هام: إذا ظهر خطأ `column orders.status does not exist`

هذا يعني أن قاعدة البيانات ينقصها عمود `status` الذي يستخدم للفلترة (الموافقة/الأرشفة).
**لحل المشكلة، انسخ هذا الكود وشغله في Supabase SQL Editor:**

```sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT NULL;
```

---

## 1. إنشاء جدول `orders`

في Supabase: **SQL Editor** → New query → الصق التشغيل التالي ثم **Run**:

```sql
-- إنشاء جدول الطلبات
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  prepared_by TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  customer_number TEXT,
  order_date TEXT,
  total_amount NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]',
  details JSONB DEFAULT '{}'
);

-- السماح للدور anon بالقراءة والإدخال (للتطبيق)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read orders"
ON public.orders FOR SELECT TO anon USING (true);

CREATE POLICY "Allow insert orders"
ON public.orders FOR INSERT TO anon WITH CHECK (true);
```

لتفعيل **إعداد لاحقاً** و **حذف الطلب** من واجهة المشرف، شغّل أيضاً (إذا الجدول موجود مسبقاً أضف العمود والسياسات فقط):

```sql
-- عمود اختياري لحالة الطلب (إعداد لاحقاً)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT NULL;

-- صلاحيات التحديث والحذف للمشرف (anon)
CREATE POLICY "Allow update orders" ON public.orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete orders" ON public.orders FOR DELETE TO anon USING (true);
```

بعد التشغيل يجب أن يظهر الجدول **orders** في **Table Editor** وتعمل حفظ الطلبات من المستخدم 123 وعرضها للمشرف (supervisor)، مع إمكانية إعداد لاحقاً وحذف الطلب.

---

## 2. إذا الجدول موجود لكن الطلبات لا تظهر

تأكد من سياسات RLS كما في القسم السابق: يجب وجود سياسة **SELECT** للدور `anon` على جدول `orders`.

## 3. إذا حذف المشرف الطلب ثم تحديث الصفحة يعود الطلب

هذا يعني أن الحذف لم يُنفَّذ في قاعدة البيانات بسبب عدم وجود سياسة **DELETE**. شغّل في SQL Editor:

```sql
CREATE POLICY "Allow delete orders" ON public.orders FOR DELETE TO anon USING (true);
```

---

## ملاحظات

- المستخدم **123** يحفظ الطلب عبر `supabase.from('orders').insert(...)`.
- المشرف **supervisor** يعرض الطلبات عبر `supabase.from('orders').select('*')`.
- الأعمدة: `prepared_by`, `customer_name`, `customer_phone`, `customer_address`, `customer_number`, `order_date`, `total_amount`, `items`, `details`, `created_at`.
