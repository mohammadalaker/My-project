import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Construction } from 'lucide-react'
import { queryClient } from './lib/queryClient'
import App from './App.jsx'
import './index.css'

/** وضع الصيانة — مفعّل افتراضياً. لإيقافه: VITE_MAINTENANCE_MODE=false في .env أو Vercel */
const MAINTENANCE_MODE =
  import.meta.env.VITE_MAINTENANCE_MODE !== 'false' &&
  import.meta.env.VITE_MAINTENANCE_MODE !== '0'

function MaintenanceScreen() {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white"
    >
      <div className="w-full max-w-lg text-center rounded-3xl border border-white/10 bg-white/10 backdrop-blur-2xl shadow-2xl p-8 sm:p-10">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
          <Construction size={40} strokeWidth={2.25} className="text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">الموقع تحت الصيانة حالياً</h1>
        <p className="text-slate-300 leading-relaxed mb-2">
          نعمل على تحسين النظام وسنعود قريباً.
        </p>
        <p className="text-sm text-slate-400">
          لا يمكن الدخول إلى الموقع في الوقت الحالي. شكراً لتفهمكم.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Maslamani Sales — Maintenance Mode
        </div>
      </div>
    </div>
  )
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      const err = this.state.error
      const msg = err?.message || String(err || 'Unknown error')
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#334155', textAlign: 'center', maxWidth: 480, margin: '0 auto'
        }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 12, marginBottom: 12, color: '#64748b', wordBreak: 'break-word' }}>{msg}</p>
          <p style={{ fontSize: 14, marginBottom: 16 }}>Refresh the page or check the browser console (F12).</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    {MAINTENANCE_MODE ? (
      <MaintenanceScreen />
    ) : (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )}
  </ErrorBoundary>,
)
