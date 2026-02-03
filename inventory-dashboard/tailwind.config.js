/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lavender: '#F7F9FF',
        surface: '#FFFFFF',
        primary: '#4E66D1',
        completed: '#99E6B3',
        pending: '#99D6FF',
        alert: '#FF9999',
      },
      borderRadius: {
        'card': '32px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(78, 102, 209, 0.08)',
        'soft-lg': '0 8px 32px rgba(78, 102, 209, 0.12)',
      },
    },
  },
  plugins: [],
}
