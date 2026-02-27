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
