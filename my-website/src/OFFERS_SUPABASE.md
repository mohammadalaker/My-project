# SQL للميزة العروض (Offers)

شغّل التالي في Supabase → SQL Editor لتفعيل ميزة العروض:

```sql
-- Add is_offer column to items table if it doesn't exist
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_offer BOOLEAN DEFAULT FALSE;

-- Create an index for faster filtering (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_items_is_offer ON items(is_offer);
```
