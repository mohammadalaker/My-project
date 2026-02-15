# SQL للميزة العروض (Offers)

## 1. عمود is_offer في جدول items (اختياري)

```sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_offer BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_items_is_offer ON items(is_offer);
```

## 2. جدول العروض المخصصة (للمزامنة بين الأجهزة)

**مهم:** شغّل هذا في Supabase → SQL Editor حتى تظهر العروض على الموبايل والتابلت:

```sql
CREATE TABLE IF NOT EXISTS public.custom_offers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'عرض',
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.custom_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all custom_offers" ON public.custom_offers
FOR ALL TO anon USING (true) WITH CHECK (true);
```

بعد التشغيل ستُخزَّن العروض في Supabase وتظهر على جميع الأجهزة.
