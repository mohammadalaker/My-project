/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#ea580c', light: '#fff7ed', dark: '#c2410c' },
        pastel: {
          bg: '#F8FAFF',
          indigo: '#6366f1',
          'indigo-light': '#e0e7ff',
          emerald: '#10b981',
          'emerald-light': '#d1fae5',
          'emerald-dark': '#059669',
          rose: '#f43f5e',
          'rose-light': '#ffe4e6',
        },
      },
    },
  },
  plugins: [],
}
