import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowRight, User as UserIcon, Lock, ChevronLeft, Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../lib/supabaseClient';

const DEFAULT_USERS = [
  { username: 'sale', role: 'customer', color: 'bg-emerald-500' },
  { username: 'supervisor', role: 'supervisor', color: 'bg-indigo-500' },
  { username: 'admin', role: 'admin', color: 'bg-rose-500' },
  { username: 'mohammadalaker', role: 'admin', color: 'bg-amber-500' },
];

// Reusing same gradient from Splash Screen for continuity
// bg-slate-900

export default function Login({ onLogin }) {
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Fetch users from DB
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase.from('sales_users').select('username, role');
        if (data && !error) {
          // Merge with defaults, ensuring uniqueness
          const merged = [...DEFAULT_USERS];
          data.forEach(dbUser => {
            if (!merged.find(u => u.username === dbUser.username)) {
              merged.push({ 
                username: dbUser.username, 
                role: dbUser.role || 'customer',
                color: 'bg-slate-600' // default color for db users
              });
            }
          });
          setUsers(merged);
        }
      } catch (err) {
        console.warn('Could not fetch sales_users:', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handlePinInput = (num) => {
    if (error) setError('');
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (error) setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (!selectedUser || !pin) return;
    setIsSubmitting(true);
    
    // Call the parent App.jsx login function
    // Pass rememberMe = true by default as it's a POS login
    // App sets error internally via the callback, but we need to capture it to show local shake.
    let _err = null;
    const localSetError = (msg) => {
      _err = msg;
      setError(msg);
      setPin('');
      setIsSubmitting(false);
    };
    
    await onLogin(selectedUser.username, pin, localSetError, true);
    
    if (!_err) {
      // If it succeeded, it will unmount, but if it's still alive (auth taking a bit longer):
      setIsSubmitting(false);
    }
  };

  // Auto-submit on 4 or 6 digits perhaps? Usually they press Enter.
  // We'll add an Enter key on the numpad.

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none" dir="rtl">
      {/* Background Ornaments (same as splash) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        
        {/* Logo/Header */}
        <motion.div 
          layoutId="logo-container"
          className="mb-10 flex flex-col items-center"
        >
          <div className="w-20 h-20 mb-4 rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-500 shadow-xl shadow-orange-500/20 flex items-center justify-center border-2 border-white/10">
            <ShoppingBag size={36} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight text-center">
            Maslamani Sales
          </h1>
          <p className="text-white/50 font-medium mt-1">تسجيل الدخول</p>
        </motion.div>

        {/* Dynamic Glass Panel */}
        <motion.div 
          layout
          className="w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {!selectedUser ? (
              /* --- STATE 1: SELECT USER --- */
              <motion.div
                key="user-select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col"
              >
                <div className="mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                    <UserIcon size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-white">اختر المستخدم</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {users.map((u) => (
                    <button
                      key={u.username}
                      onClick={() => setSelectedUser(u)}
                      className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all active:scale-95 group"
                    >
                      <div className={`w-14 h-14 rounded-full ${u.color || 'bg-slate-500'} flex items-center justify-center text-white text-xl font-bold shadow-lg group-hover:shadow-xl transition-shadow border-2 border-white/10`}>
                        {u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="text-center w-full">
                        <span className="block text-white font-bold truncate w-full text-sm">{u.username}</span>
                        <span className="block text-white/50 text-xs mt-0.5 truncate uppercase">{u.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* --- STATE 2: ENTER PIN --- */
              <motion.div
                key="pin-enter"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0, rotate: shake ? [-2, 2, -2, 2, 0] : 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, rotate: { duration: 0.4 } }}
                className="flex flex-col"
              >
                {/* Back Button & User Info */}
                <div className="flex items-center justify-between mb-8">
                  <button 
                    onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white/70 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                    <div className={`w-8 h-8 rounded-full ${selectedUser.color || 'bg-slate-500'} flex items-center justify-center text-white text-sm font-bold`}>
                      {selectedUser.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="block text-white font-bold leading-none text-sm">{selectedUser.username}</span>
                      <span className="block text-white/50 text-[10px] mt-1">{selectedUser.role}</span>
                    </div>
                  </div>
                </div>

                {/* PIN Display */}
                <div className="flex flex-col items-center mb-10">
                  <div className="text-white/50 text-sm font-medium mb-4 flex items-center gap-2">
                    <Lock size={16} />
                    <span>أدخل الرمز السري (PIN)</span>
                  </div>
                  
                  <div className="flex items-center gap-4 justify-center h-12">
                    {/* We show 4 or more dots depending on the PIN length, usually POS PINs are 4-6 digits */}
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: i < pin.length ? 1.2 : 1,
                          backgroundColor: i < pin.length ? '#f97316' : 'rgba(255,255,255,0.1)',
                          borderColor: i < pin.length ? '#f97316' : 'rgba(255,255,255,0.2)'
                        }}
                        className={`w-5 h-5 rounded-full border-2 transition-colors duration-200`}
                      />
                    ))}
                  </div>
                  {error && (
                    <motion.span 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="text-rose-400 font-bold text-sm mt-4 text-center"
                    >
                      {error}
                    </motion.span>
                  )}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handlePinInput(num.toString())}
                      className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-2xl font-bold text-white transition-all active:scale-90 active:bg-white/20"
                    >
                      {num}
                    </button>
                  ))}
                  
                  {/* Cancel/Clear */}
                  <button
                    onClick={() => setPin('')}
                    className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-bold text-sm transition-all active:scale-90 flex items-center justify-center"
                  >
                    مسح
                  </button>
                  
                  <button
                    onClick={() => handlePinInput('0')}
                    className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-2xl font-bold text-white transition-all active:scale-90 active:bg-white/20"
                  >
                    0
                  </button>
                  
                  {/* Enter/Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={pin.length === 0 || isSubmitting}
                    className={`h-16 rounded-2xl flex items-center justify-center text-white transition-all active:scale-90
                      ${pin.length > 0 ? 'bg-orange-500 hover:bg-orange-400 shadow-lg shadow-orange-500/30' : 'bg-white/5 text-white/30 border border-white/10 pointer-events-none'}`}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <ArrowRight size={28} />
                    )}
                  </button>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
