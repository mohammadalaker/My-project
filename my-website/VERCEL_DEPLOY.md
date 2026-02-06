# Deploy Warehouse Management System on Vercel

## 1. Root Directory (required)

This repo has two folders:

- **my-website** ← The actual app (inventory, orders, catalog)
- **inventory-dashboard** ← Another dashboard

Set Vercel **Root Directory** to **`my-website`** so the correct app is built.

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your project (linked to GitHub).
2. Go to **Settings** → **General**.
3. Under **Root Directory**, click **Edit**, enter **`my-website`**, then **Save**.
4. Go to **Deployments** → open the latest deployment → **Redeploy**.

---

## 2. Environment variables (required for data)

The app needs Supabase for products and images. Add these in Vercel:

1. **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `VITE_SUPABASE_URL`  
     **Value:** your Supabase project URL (e.g. `https://xxxx.supabase.co`)
   - **Name:** `VITE_SUPABASE_ANON_KEY`  
     **Value:** your Supabase anon/public key
3. **Save**, then **Redeploy** the project.

Without these, the site may load but the product list will be empty and images may not work.

---

## 3. If the page still doesn’t work

- **Blank or broken page**
  - Confirm **Root Directory** is exactly `my-website` (no trailing slash).
  - Check **Deployments** → latest run: if **Building** failed, open the log and fix the error (e.g. missing env, Node version).
- **404 on refresh or direct URL**
  - The project’s `vercel.json` includes SPA rewrites. Ensure you’re deploying from the `my-website` folder so that `vercel.json` is used.
- **No products / images**
  - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Settings → Environment Variables** and redeploy.

After a successful deploy you should see the Warehouse Management System with Electrical Appliances, Kitchenware, and the Order / Catalog panels.
