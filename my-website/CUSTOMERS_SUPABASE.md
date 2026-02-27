# جدول العملاء (customers) — عمود اسم الشركة

شاشة العملاء تستخدم الحقول: **اسم الشركة**، **اسم التاجر**، **رقم الهاتف**، **العنوان**، **رقم العميل (في الشركة)**.

إذا ظهر خطأ عند إضافة/تعديل عميل يشير إلى عمود غير موجود، شغّل في **Supabase → SQL Editor**:

```sql
-- إضافة عمود اسم الشركة إن لم يكن موجوداً
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT NULL;
```

باقي الأعمدة المستخدمة: `name` (اسم التاجر)، `phone`، `address`، `customer_number`، `loyalty_points`، `total_spent`.
