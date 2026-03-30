/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.css",
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#ea580c', light: '#fff7ed', dark: '#c2410c' },
        obsidian: {
          900: '#07080a',
          800: '#0a0c10',
          700: '#14171c',
        },
        slate: {
          950: '#020617',
          900: '#0f172a',
          850: '#1e293b/50',
        },
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
      animation: {
        tilt: 'tilt 10s infinite linear',
        'scan-line': 'scan-line 2s ease-in-out infinite',
      },
      keyframes: {
        tilt: {
          '0%, 50%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(1deg)' },
          '75%': { transform: 'rotate(-1deg)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(0%)',   opacity: '0.9' },
          '50%':  { transform: 'translateY(100%)', opacity: '0.9' },
          '100%': { transform: 'translateY(0%)',   opacity: '0.9' },
        },
      },
    },
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true,
  },
}
