import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(username, password, setError, rememberMe);
    };

    return (
        <div className="min-h-screen bg-white bg-opacity-95 flex items-center justify-center p-4" dir="rtl">
            <div className="w-full max-w-md bg-white rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)] border border-slate-100 p-8 pt-10 text-center">

                {/* Top User Icon */}
                <div className="mx-auto w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                    <User size={40} className="text-slate-800" strokeWidth={1.5} />
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2 font-sans">تسجيل الدخول</h1>
                <p className="text-slate-500 text-sm mb-8 font-sans">أدخل اسم المستخدم وكلمة المرور للمتابعة</p>

                <form onSubmit={handleSubmit} className="text-right space-y-6">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg text-center font-medium animate-pulse">
                            {error}
                        </div>
                    )}

                    {/* Username */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-800 mr-1 font-sans">اسم المستخدم</label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-700 placeholder:text-slate-400 font-sans"
                                placeholder="اسم المستخدم"
                            />
                            <User className="absolute right-3 top-3.5 text-slate-400" size={20} />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-800 mr-1 font-sans">كلمة المرور</label>
                        <div className="relative group">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pr-10 pl-10 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-700 placeholder:text-slate-400 font-sans"
                                placeholder="كلمة المرور"
                            />
                            <Lock className="absolute right-3 top-3.5 text-slate-400" size={20} />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                                tabIndex="-1"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center justify-start gap-2 mt-6">
                        <input
                            id="remember"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                        />
                        <label htmlFor="remember" className="text-sm text-slate-600 select-none cursor-pointer font-sans">تذكرني (البقاء مسجل الدخول)</label>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full py-3.5 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-base transition-colors mt-6 font-sans shadow-lg shadow-slate-900/10"
                    >
                        تسجيل الدخول
                    </button>
                </form>
            </div>
        </div>
    );
}
