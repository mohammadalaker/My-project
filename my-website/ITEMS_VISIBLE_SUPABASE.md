# عمود إظهار/إخفاء المنتجات (visible) في جدول items

لتمكين ميزة **العين** (إظهار/إخفاء المنتج من العملاء)، أضف العمود التالي في Supabase.

## تشغيل SQL

في Supabase: **SQL Editor** → New query → الصق التشغيل التالي ثم **Run**:

```sql
-- إضافة عمود visible لجدول items (المنتجات الظاهرة للعملاء)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE;

-- اختياري: فهرسة لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_items_visible ON public.items(visible);
```

بعد التشغيل:
- **visible = true** (الافتراضي): المنتج يظهر للعملاء
- **visible = false**: المنتج مخفي عن العملاء (يظهر للأدمن فقط)

من واجهة الأدمن، انقر على العين بجانب المنتج:
- عين مفتوحة (Eye): المنتج ظاهر للعملاء
- عين مغلقة (EyeOff): المنتج مخفي عن العملاء
