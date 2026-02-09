import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const LoadingShell = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(165deg, #f8fafc 0%, #f1f5f9 100%)', fontFamily: 'system-ui, sans-serif'
  }}>
    <div style={{
      width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%',
      animation: 'root-spin 0.8s linear infinite'
    }} />
    <p style={{ marginTop: 16, fontSize: 14, color: '#64748b', fontWeight: 500 }}>Loading…</p>
  </div>
)

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

const root = document.getElementById('root')
const reactRoot = ReactDOM.createRoot(root)

reactRoot.render(
  <React.StrictMode>
    <ErrorBoundary>
      <LoadingShell />
    </ErrorBoundary>
  </React.StrictMode>,
)

import('./App.jsx').then(({ default: App }) => {
  reactRoot.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}).catch((err) => {
  console.error('Failed to load app', err)
  reactRoot.render(
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui', color: '#dc2626', textAlign: 'center' }}>
      <p>Failed to load. <button type="button" onClick={() => window.location.reload()} style={{ marginLeft: 8, padding: '8px 16px', cursor: 'pointer' }}>Retry</button></p>
    </div>
  )
})
