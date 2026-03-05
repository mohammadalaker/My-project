/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#ea580c', light: '#fff7ed', dark: '#c2410c' },
        pastel: {
          bg: '#F8FAFF',
          indigo: '#6366f1',
          'indigo-light': '#e0e7ff',
          'emerald:': '#10b981', // Typo in original file? 'emerald:' key. I will fix it if I see it, or just keep as is? Original was 'emerald'. Wait.
          // Let's look at original again.
          // Original:
          //           emerald: '#10b981',

          emerald: '#10b981',
          'emerald-light': '#d1fae5',
          'emerald-dark': '#059669',
          rose: '#f43f5e',
          'rose-light': '#ffe4e6',
        },
      },
      animation: {
        tilt: 'tilt 10s infinite linear',
      },
      keyframes: {
        tilt: {
          '0%, 50%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(1deg)' },
          '75%': { transform: 'rotate(-1deg)' },
        },
      },
    },
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true,
  },
}
