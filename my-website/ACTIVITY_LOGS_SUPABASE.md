# سجل التغييرات (Activity Logs) — Supabase

جدول لتسجيل من غيّر السعر أو الكمية ومتى، لاستخدامه في الرقابة وتطبيقات إدارة المبيعات.

## إنشاء الجدول

شغّل في **Supabase → SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT
);

-- فهرس لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read activity_logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (true);
```

## الحقول

| الحقل        | الوصف                          |
|-------------|---------------------------------|
| `username`  | اسم المستخدم الذي قام بالتعديل  |
| `action`    | نوع العملية، مثلاً: `update`    |
| `entity_type` | نوع السجل، مثلاً: `item`     |
| `entity_id` | معرّف السجل (مثلاً الباركود)   |
| `field_name`| اسم الحقل الذي تغيّر            |
| `old_value` | القيمة القديمة (نص)             |
| `new_value` | القيمة الجديدة (نص)             |
| `description` | وصف اختياري للتغيير          |

التطبيق يملأ هذا الجدول عند تعديل سعر أو كمية صنف من لوحة المخزون/الكتالوج.
