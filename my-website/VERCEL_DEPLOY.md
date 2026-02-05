# نشر موقع «نظام إدارة المخازن» على Vercel

## مهم جداً: إعداد المجلد الجذر (Root Directory)

المشروع يحتوي على **مجلدين**:
- **my-website** ← هذا هو موقعك الحقيقي (نظام إدارة المخازن، أجهزة كهربائية، إضافة للسلة)
- **inventory-dashboard** ← لوحة أخرى (Hello Developer / بيانات تجريبية)

لكي يظهر الموقع الصحيح على Vercel، يجب تعيين **Root Directory** إلى مجلد **my-website** فقط.

---

## الخطوات (حل نهائي)

1. ادخل إلى [Vercel Dashboard](https://vercel.com/dashboard) وافتح **مشروعك** (المربوط بمستودع GitHub).

2. من القائمة الجانبية اختر **Settings** (الإعدادات).

3. من القائمة الفرعية اختر **General**.

4. في قسم **Root Directory**:
   - اضغط **Edit**.
   - اكتب بالضبط: **`my-website`**
   - اضغط **Save**.

5. من تبويب **Deployments** اضغط **Redeploy** لأحدث نشر، واختر **Redeploy** مرة أخرى للتأكيد.

6. بعد انتهاء البناء، افتح رابط الموقع: يجب أن ترى **نظام إدارة المخازن** مع أقسام Electrical و Kitchenware وشبكة المنتجات وزر «اتفاقية بيع طلبية»، وليس صفحة "Hello, Developer!".

---

## متغيرات البيئة (إن وُجدت)

في **Settings → Environment Variables** تأكد من إضافة قيم Supabase إذا كان الموقع يحتاجها:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

ثم أعد النشر بعد الحفظ.
