-- ذمم العملاء (Accounts Receivable): سجل مديونيات ودفعات لكل عميل
-- شغّل هذا الملف في Supabase → SQL Editor بعد وجود جدول customers و orders.

-- سقف ائتمان اختياري لكل عميل (بالشيكل؛ NULL = بدون سقف محدد في النظام)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.customers.credit_limit IS 'Max allowed outstanding debt in ILS; NULL = no limit';

CREATE TABLE IF NOT EXISTS public.customer_ar_ledger (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_id BIGINT NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount_ils NUMERIC NOT NULL CHECK (amount_ils > 0),
  description TEXT,
  order_id BIGINT REFERENCES public.orders (id) ON DELETE SET NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_ar_ledger_customer ON public.customer_ar_ledger (customer_id, created_at DESC);

ALTER TABLE public.customer_ar_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select ar ledger"
  ON public.customer_ar_ledger FOR SELECT TO anon USING (true);

CREATE POLICY "Allow insert ar ledger"
  ON public.customer_ar_ledger FOR INSERT TO anon WITH CHECK (true);

-- إن رغبت بالتحديث/الحذف لاحقاً للمشرفين فقط، أضف سياسات منفصلة أو استخدم مصادقة حقيقية.
