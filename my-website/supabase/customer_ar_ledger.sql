-- ذمم العملاء (Accounts Receivable): سجل مديونيات ودفعات لكل عميل
-- شغّل في Supabase → SQL Editor بعد وجود جداول customers و orders.
--
-- ملاحظة: إذا كان customers.id من نوع UUID (الافتراضي في كثير من مشاريع Supabase)،
-- يجب أن يكون customer_id من نوع UUID وليس BIGINT.

-- سقف ائتمان اختياري لكل عميل (بالشيكل؛ NULL = بدون سقف محدد في النظام)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.customers.credit_limit IS 'Max allowed outstanding debt in ILS; NULL = no limit';

-- إن وُجد جدول قديم بنوع أعمدة خاطئ، احذفه ثم أعد الإنشاء
DROP TABLE IF EXISTS public.customer_ar_ledger CASCADE;

CREATE TABLE public.customer_ar_ledger (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount_ils NUMERIC NOT NULL CHECK (amount_ils > 0),
  description TEXT,
  -- orders.id غالباً BIGSERIAL في هذا المشروع؛ إذا كان عندك uuid على orders غيّر السطر التالي إلى UUID
  order_id BIGINT REFERENCES public.orders (id) ON DELETE SET NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_ar_ledger_customer ON public.customer_ar_ledger (customer_id, created_at DESC);

ALTER TABLE public.customer_ar_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select ar ledger"
  ON public.customer_ar_ledger FOR SELECT TO anon USING (true);

CREATE POLICY "Allow insert ar ledger"
  ON public.customer_ar_ledger FOR INSERT TO anon WITH CHECK (true);
