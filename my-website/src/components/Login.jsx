import React, { useState } from 'react';
import { Eye, EyeOff, ShoppingBag } from 'lucide-react';

const TEAL = {
  light: '#ccfbf1',
  border: '#99f6e4',
  bg: '#14b8a6',
  dark: '#0d9488',
  text: '#0f766e',
};

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password, setError, rememberMe);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col" dir="rtl">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <button
          type="button"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          English
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: TEAL.dark }}>
            <ShoppingBag size={22} strokeWidth={2} />
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900 leading-tight">مسلماني</p>
            <p className="text-sm font-medium text-slate-500 leading-tight">Maslamani Sales</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Tabs */}
          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 mb-8">
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${activeTab === 'signup'
                ? 'bg-white text-slate-600 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              إنشاء حساب
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${activeTab === 'login'
                ? 'text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700'
                }`}
              style={activeTab === 'login' ? { backgroundColor: TEAL.dark } : {}}
            >
              تسجيل الدخول
            </button>
          </div>

          {/* Form - تسجيل الدخول */}
          {activeTab === 'login' && (
            <form onSubmit={handleSubmit} className="text-right space-y-5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm text-center font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">اسم المستخدم</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border outline-none transition-colors text-slate-800 placeholder:text-slate-400"
                  style={{ borderColor: TEAL.border }}
                  placeholder="أدخل اسم المستخدم"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 rounded-xl border outline-none transition-colors text-slate-800 placeholder:text-slate-400"
                    style={{ borderColor: TEAL.border }}
                    placeholder="أدخل كلمة المرور"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-start gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                  style={{ accentColor: TEAL.dark }}
                />
                <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">تذكرني</label>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-opacity hover:opacity-95"
                style={{ backgroundColor: TEAL.dark }}
              >
                متابعة
              </button>
            </form>
          )}

          {/* إنشاء حساب - placeholder */}
          {activeTab === 'signup' && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">إنشاء حساب جديد غير متاح من هذه الشاشة.</p>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="mt-4 text-sm font-semibold underline"
                style={{ color: TEAL.dark }}
              >
                تسجيل الدخول
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
