# جدول مستخدمي نقطة البيع (sales_users)

يُستخدم لتسجيل الدخول وإدارة المستخدمين وكلمات المرور من صفحة الإعدادات → إدارة الجلسات.

## إنشاء الجدول

شغّل في Supabase → SQL Editor:

```sql
-- جدول مستخدمي البيع (للأدمن: إدارة المستخدمين وكلمات المرور من الإعدادات)
CREATE TABLE IF NOT EXISTS public.sales_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'customer'))
);

CREATE INDEX IF NOT EXISTS idx_sales_users_username ON public.sales_users(username);

ALTER TABLE public.sales_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow read sales_users for login"
  ON public.sales_users FOR SELECT USING (true);

CREATE POLICY "allow update sales_users"
  ON public.sales_users FOR UPDATE USING (true) WITH CHECK (true);

INSERT INTO public.sales_users (username, password, role)
VALUES
  ('mohammadalaker', '123456', 'admin'),
  ('admin', '123456', 'admin'),
  ('sale', '123', 'customer'),
  ('supervisor', '123', 'supervisor')
ON CONFLICT (username) DO NOTHING;
```

## ملاحظات

- إدارة المستخدمين وتغيير كلمة المرور: من التطبيق → الإعدادات → إدارة الجلسات (للدور admin فقط).
