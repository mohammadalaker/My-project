import React, { useState } from 'react';
import { Package, ShieldCheck, Truck, Lock } from 'lucide-react';

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(username, password, setError);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-8 text-center text-white">
                    <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4 border border-white/30 shadow-inner">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-2xl font-bold mb-1">Welcome Back</h1>
                    <p className="text-indigo-100 text-sm">Sign in to access the Sales System</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 pt-10 space-y-5">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl text-center font-medium animate-pulse">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                placeholder="Enter username"
                            />
                            <Package className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                        <div className="relative group">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                            <Lock className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        <span>Sign In</span>
                        <Truck size={18} className="opacity-80" />
                    </button>
                </form>

                <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400">Restricted Access • Authorized Personnel Only</p>
                </div>
            </div>
        </div>
    );
}
