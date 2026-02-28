# جدول العملاء (customers) — الحقول المستخدمة

شاشة العملاء ونظام نقاط الولاء والتنبيهات تستخدم الحقول التالية:

- **اسم الشركة**: `company_name`
- **اسم التاجر**: `name`
- **رقم الهاتف**: `phone`
- **العنوان**: `address`
- **رقم العميل (في الشركة)**: `customer_number`
- **نقاط الولاء**: `loyalty_points`
- **إجمالي المشتريات**: `total_spent`
- **الرصيد السابق (ديون غير مدفوعة)**: `outstanding_debt`

إذا ظهر خطأ عند إضافة/تعديل عميل يشير إلى عمود غير موجود، شغّل في **Supabase → SQL Editor**:

```sql
-- إضافة عمود اسم الشركة إن لم يكن موجوداً
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT NULL;

-- إضافة عمود الرصيد السابق (ديون غير مدفوعة) إن لم يكن موجوداً
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS outstanding_debt NUMERIC(12,2) DEFAULT 0;
```

**إذا لم تظهر أسماء العملاء في القائمة:** تأكد من (1) وجود صفوف في جدول `customers` أو أضف عميلاً من "إضافة عميل"، (2) صلاحيات RLS على الجدول في Supabase تسمح بقراءة الصفوف للمستخدم المسجل.

---

## إصلاح خطأ RLS عند إضافة عميل

إذا ظهر الخطأ: **new row violates row-level security policy for table "customers"** عند الضغط على "حفظ"، السبب أن جدول `customers` مفعّل عليه RLS ولا توجد سياسة تسمح بعملية **INSERT**.

**الحل:** افتح **Supabase → SQL Editor** وشغّل الأوامر التالية مرة واحدة:

```sql
-- تفعيل RLS (إن لم يكن مفعّلاً)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- السماح بقراءة الصفوف (عرض القائمة)
CREATE POLICY "Allow read customers" ON public.customers FOR SELECT USING (true);

-- السماح بإضافة عميل جديد
CREATE POLICY "Allow insert customers" ON public.customers FOR INSERT WITH CHECK (true);

-- السماح بتعديل عميل
CREATE POLICY "Allow update customers" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);

-- السماح بحذف عميل
CREATE POLICY "Allow delete customers" ON public.customers FOR DELETE USING (true);
```

**إذا ظهر أن السياسة موجودة مسبقاً:** احذف السياسات ثم أعد إنشاءها:

```sql
DROP POLICY IF EXISTS "Allow read customers" ON public.customers;
DROP POLICY IF EXISTS "Allow insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow delete customers" ON public.customers;
```

ثم شغّل أوامر `CREATE POLICY` أعلاه من جديد. بعد ذلك جرّب "حفظ" في نموذج إضافة العميل مرة أخرى.
