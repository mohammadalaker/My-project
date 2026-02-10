# تعديلات تقليل استهلاك Bandwidth في App.jsx

الملف `App.jsx` قد يكون مقفولاً. أغلق التبويب أو احفظ وأغلق ثم طبّق التعديلات التالية يدوياً (بحث واستبدال).

---

## 1. الدالة المساعدة واسم الـ Bucket

**موضع:** أعلى الملف بعد `const SUPABASE_URL = ...`

**استبدل:**
```js
const BUCKET = 'Pic_of_items';
const PAGE_SIZE = 80;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** إرجاع رابط عام للصورة من bucket Pic_of_items - إذا كانت مساراً. الروابط الخارجية (http) تُرجع كما هي. */
function getPublicImageUrl(imageValue) {
```

**بـ:**
```js
/** اسم الـ bucket في Supabase Storage (غيّره إلى 'products' إن لزم). روابط getPublicUrl ثابتة وتقلل Bandwidth. */
const BUCKET = 'Pic_of_items';
const PAGE_SIZE = 80;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** إرجاع رابط عام ثابت للصورة عبر getPublicUrl (لا يستخدم Signed URLs). يُرجع null عند عدم وجود صورة. */
function getPublicImageUrl(imageValue) {
```

---

## 2. طباعة الطلبية — إضافة loading="lazy" للصورة في HTML

**ابحث عن:**
```js
? `<img src="${String(imgSrc).replace(/"/g, '&quot;')}" alt="" style="width:40px;height:40px;object-fit:contain;" />`
```

**استبدل بـ:**
```js
? `<img src="${String(imgSrc).replace(/"/g, '&quot;')}" alt="" loading="lazy" style="width:40px;height:40px;object-fit:contain;" />`
```

---

## 3. صفحة المنتجات المختارة (Inventory HTML) — إضافة loading="lazy"

**ابحث عن:**
```js
? `<div class="inv-img"><img src="${safeSrc(imgSrc)}" alt="" /></div>`
```

**استبدل بـ:**
```js
? `<div class="inv-img"><img src="${safeSrc(imgSrc)}" alt="" loading="lazy" /></div>`
```

---

## 4. بطاقة المنتج في الشبكة — إضافة loading="lazy"

**ابحث عن:**
```jsx
<img
                          src={getImage(item)}
                          alt=""
                          className="w-full h-full object-contain p-2"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
```

**استبدل بـ:**
```jsx
<img
                          src={getImage(item)}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-contain p-2"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
```

---

## 5. سلة الطلبية — صورة الصنف + معالجة عدم وجود صورة + lazy

**ابحث عن:**
```jsx
{getImage(o.item) && <img src={getImage(o.item)} alt="" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} />}
```

**استبدل بـ:**
```jsx
{getImage(o.item) ? (
                            <img src={getImage(o.item)} alt="" loading="lazy" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} />
                          ) : (
                            <Package size={24} className="text-slate-300" />
                          )}
```

---

## 6. نافذة تفاصيل المنتج — إضافة loading="lazy"

**ابحث عن:**
```jsx
{getImage(selectedItem) ? <img src={getImage(selectedItem)} alt="" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} /> : <Package size={64} className="text-slate-300" />}
```

**استبدل بـ:**
```jsx
{getImage(selectedItem) ? <img src={getImage(selectedItem)} alt="" loading="lazy" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} /> : <Package size={64} className="text-slate-300" />}
```

---

## 7. نموذج التعديل (الصورة في الفورم) — إضافة loading="lazy"

**ابحث عن:**
```jsx
<img src={getPublicImageUrl(formData.image_url)} alt="" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} />
```

**استبدل بـ:**
```jsx
<img src={getPublicImageUrl(formData.image_url)} alt="" loading="lazy" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = 'none')} />
```

---

## ملخص

- **الدالة `getPublicImageUrl`** موجودة مسبقاً وتستخدم `supabase.storage.from(BUCKET).getPublicUrl(path)` — لا حاجة لتغيير المنطق، فقط التعليق.
- **جميع الصور** في JSX و HTML المُولَّد أصبحت تستخدم نفس الدالة؛ مع إضافة **loading="lazy"** لكل `<img>`.
- **عدم وجود صورة:** تمت معالجته في السلة بعرض أيقونة `<Package />` عند عدم وجود `getImage(o.item)`.
- إذا كان اسم الـ bucket عندك **products** بدلاً من **Pic_of_items**، غيّر السطر:  
  `const BUCKET = 'products';`

بعد التعديل احفظ الملف وشغّل التطبيق للتأكد من أن الصور تُحمّل بشكل كسول والروابط عامة ثابتة.
