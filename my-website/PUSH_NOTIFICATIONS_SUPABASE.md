# تنبيهات المخزون (إشعارات التنبؤ)

## ما الموجود حالياً (Quick Win)

- **إشعار محلي (Local Notification)** عند فتح تقرير المخزون: إذا كان هناك أصناف متوقعة النفاد خلال **48 ساعة**، يظهر إشعار في المتصفح/الهاتف (مرة واحدة يومياً).
- زر **«تفعيل تنبيهات المخزون»** في صفحة تقرير المخزون يطلب إذن الإشعارات من المتصفح.
- يعمل فوراً بدون إعداد إضافي؛ يتطلب فقط أن يسمح المستخدم بالإشعارات للموقع.

---

## إشعارات الدفع (Push) عند إغلاق التطبيق

لإرسال تنبيه لهاتفك **حتى عندما يكون التطبيق مغلقاً** (مثلاً: "سخان الماء سينفد خلال 48 ساعة") تحتاج:

1. **جدول في Supabase** لحفظ اشتراكات Push (كل جهاز يسجّل اشتراكه عند التفعيل).
2. **دالة Edge أو Cron** تُشغّل دورياً (مثلاً يومياً)، تحسب التنبؤ بنفاد الأصناف وترسل إشعارات Push للأجهزة المشتركة.

### جدول `push_subscriptions` (اختياري للمستقبل)

```sql
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_identifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow insert push_subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read push_subscriptions" ON public.push_subscriptions FOR SELECT USING (true);
```

### مفتاح VAPID

لإرسال Push تحتاج مفتاح **VAPID** (زوج public/private). يمكن توليده محلياً:

```bash
npx web-push generate-vapid-keys
```

- المفتاح **Public** يضاف في التطبيق (مثلاً `VITE_VAPID_PUBLIC_KEY`).
- المفتاح **Private** يضاف في الدالة التي ترسل الإشعارات (مثلاً Supabase Edge Function كـ secret).

بعد إضافة الجدول ومفتاح VAPID يمكن ربط زر «تفعيل تنبيهات المخزون» بتسجيل الاشتراك في `push_subscriptions`، ودالة مجدولة تقرأ التنبؤ وترسل الإشعارات عبر Web Push API.
