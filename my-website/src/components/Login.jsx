import React, { useState } from 'react';
import { Eye, EyeOff, ShoppingBag } from 'lucide-react';

const TEAL = {
  light: '#ccfbf1',
  border: '#99f6e4',
  bg: '#14b8a6',
  dark: '#0d9488',
  text: '#0f766e',
};

const labels = {
  ar: {
    username: 'اسم المستخدم',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    password: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    remember: 'تذكرني',
    submit: 'متابعة',
    langButton: 'English',
  },
  en: {
    username: 'Username',
    usernamePlaceholder: 'Enter username',
    password: 'Password',
    passwordPlaceholder: 'Enter password',
    remember: 'Remember me',
    submit: 'Continue',
    langButton: 'العربية',
  },
};

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('ar'); // 'ar' | 'en'

  const t = labels[lang];
  const isRtl = lang === 'ar';

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password, setError, rememberMe);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          {t.langButton}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: TEAL.dark }}>
            <ShoppingBag size={22} strokeWidth={2} />
          </div>
          <p className="text-lg font-bold text-slate-900 leading-tight">Maslamani Sales</p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <form onSubmit={handleSubmit} className={isRtl ? 'text-right' : 'text-left'} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm text-center font-medium mb-5">
                {error}
              </div>
            )}

            <div className="space-y-2 mb-5">
              <label className="block text-sm font-bold text-slate-800">{t.username}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border outline-none transition-colors text-slate-800 placeholder:text-slate-400"
                style={{ borderColor: TEAL.border }}
                placeholder={t.usernamePlaceholder}
              />
            </div>

            <div className="space-y-2 mb-5">
              <label className="block text-sm font-bold text-slate-800">{t.password}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3.5 rounded-xl border outline-none transition-colors text-slate-800 placeholder:text-slate-400 ${isRtl ? 'pr-12' : 'pl-12'}`}
                  style={{ borderColor: TEAL.border }}
                  placeholder={t.passwordPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${isRtl ? 'right-3' : 'left-3'}`}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className={`flex items-center gap-2 mb-5 ${isRtl ? 'justify-start' : 'justify-start'}`}>
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                style={{ accentColor: TEAL.dark }}
              />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">{t.remember}</label>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-opacity hover:opacity-95"
              style={{ backgroundColor: TEAL.dark }}
            >
              {t.submit}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
