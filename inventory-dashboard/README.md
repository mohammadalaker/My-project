<<<<<<< HEAD
# Inventory Dashboard

Professional **Inventory Dashboard** for developers: card-based UI, daily snapshot, capsule bar chart, and searchable grid. Uses **Eng-Name**, **Qty**, and **Price** from your Excel/CSV.

## Tech stack

- **React** + **Vite**
- **Tailwind CSS** (lavender `#F7F9FF`, 32px rounded cards, pastel widgets)
- **Framer Motion** (transitions and layout animations)
- **SheetJS (xlsx)** for parsing Excel/CSV

## Run locally

```bash
cd inventory-dashboard
npm install
npm run dev
```

Then open the URL shown in the terminal (e.g. `http://localhost:5173`).

## Data source

- **Supabase**: إذا عيّنت `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` و `VITE_SUPABASE_TABLE`، التطبيق يحمّل الأصناف من جدولك تلقائياً. انظر إعداد Supabase في الملف `.env.example` ومتغيرات البيئة في Vercel.

- **Load your file**: Click **“Load Excel / CSV”** and choose `كشف القطع الصغيرة شهر 01-2026.xlsx` (or any sheet with columns for name, quantity, and price).
- The parser looks for columns named **Eng-Name** (or Description/الوصف), **Qty** (or Quantity/الكمية), and **Price** (or السعر).
- **Use sample data**: Click **“Use sample data”** to try the UI without a file.

## Features

- **Daily Snapshot** — Total inventory value and part count.
- **Summary widgets** — Total parts count, inventory health (pastel cards).
- **Rounded capsule bar chart** — Top items by quantity, with category emojis.
- **Searchable item grid** — Search by name, qty, or price; category emojis (e.g. 🔌 electronics, 📦 boxes, ⚡ components).

## Build

```bash
npm run build
npm run preview   # optional: preview production build
```
=======
# Inventory Dashboard

Professional **Inventory Dashboard** for developers: card-based UI, daily snapshot, capsule bar chart, and searchable grid. Uses **Eng-Name**, **Qty**, and **Price** from your Excel/CSV.

## Tech stack

- **React** + **Vite**
- **Tailwind CSS** (lavender `#F7F9FF`, 32px rounded cards, pastel widgets)
- **Framer Motion** (transitions and layout animations)
- **SheetJS (xlsx)** for parsing Excel/CSV

## Run locally

```bash
cd inventory-dashboard
npm install
npm run dev
```

Then open the URL shown in the terminal (e.g. `http://localhost:5173`).

## Data source

- **Load your file**: Click **“Load Excel / CSV”** and choose `كشف القطع الصغيرة شهر 01-2026.xlsx` (or any sheet with columns for name, quantity, and price).
- The parser looks for columns named **Eng-Name** (or Description/الوصف), **Qty** (or Quantity/الكمية), and **Price** (or السعر).
- **Use sample data**: Click **“Use sample data”** to try the UI without a file.

## Features

- **Daily Snapshot** — Total inventory value and part count.
- **Summary widgets** — Total parts count, inventory health (pastel cards).
- **Rounded capsule bar chart** — Top items by quantity, with category emojis.
- **Searchable item grid** — Search by name, qty, or price; category emojis (e.g. 🔌 electronics, 📦 boxes, ⚡ components).

## Build

```bash
npm run build
npm run preview   # optional: preview production build
```
>>>>>>> fea0a82cfd606a9ad96144983f837e51af84636f
