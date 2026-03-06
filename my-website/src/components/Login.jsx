import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowRight, Lock, Delete } from 'lucide-react';
import { motion } from 'framer-motion';
import supabase from '../lib/supabaseClient';

// تحويل الرقم العربي إلى إنجليزي (٠١٢٣٤٥٦٧٨٩ → 0-9)
const ARABIC_TO_ENGLISH_DIGIT = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const toEnglishDigit = (key) => ARABIC_TO_ENGLISH_DIGIT[key] ?? (/\d/.test(key) ? key : null);

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  // دعم اللمس (لوحة الأرقام) + كيبورد الكمبيوتر — أرقام إنجليزية أو عربية
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSubmitting) return;
      const digit = toEnglishDigit(e.key);
      const isBackspace = e.key === 'Backspace';
      const isEnter = e.key === 'Enter';
      if (!digit && !isBackspace && !isEnter) return;

      e.preventDefault();
      e.stopPropagation();
      if (digit) {
        setPin((prev) => {
          if (error) return prev;
          return prev.length < 10 ? prev + digit : prev;
        });
        if (error) setError('');
      } else if (isBackspace) {
        setPin((prev) => prev.slice(0, -1));
        if (error) setError('');
      } else {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isSubmitting, error, pin]);

  const handlePinInput = (num) => {
    if (error) setError('');
    if (pin.length < 10) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (error) setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (!pin) return;
    setIsSubmitting(true);

    let foundUsername = null;
    let _err = null;
    const localSetError = (msg) => {
      _err = msg;
      setError(msg);
      setPin('');
      setIsSubmitting(false);
    };

    try {
      const { data, error: dbErr } = await supabase
        .from('sales_users')
        .select('username, password, role')
        .eq('password', pin)
        .limit(1)
        .maybeSingle();

      if (data && !dbErr) {
        foundUsername = data.username;
      }
    } catch (err) {
      console.warn('DB lookup failed, failing over to hardcoded users', err);
    }

    if (!foundUsername) {
      if (pin === '123456') foundUsername = 'mohammadalaker';
      else if (pin === '123') foundUsername = 'sale';
      else if (pin === '999') foundUsername = 'supervisor';
    }

    if (foundUsername) {
      await onLogin(foundUsername, pin, localSetError, true);
      if (!_err) {
        setIsSubmitting(false);
      }
    } else {
      localSetError('الرمز السري غير صحيح');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none" dir="rtl">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
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
          <p className="text-white font-medium tracking-tight text-center mt-1 text-base opacity-90">Premium Appliances</p>
          <p className="text-white/50 font-medium mt-1">
            يرجى إدخال الرمز السري
          </p>
        </motion.div>

        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, rotate: shake ? [-2, 2, -2, 2, 0] : 0 }}
          transition={{ duration: 0.4, rotate: { duration: 0.4 } }}
          className="w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden flex flex-col items-center"
        >
          <div className="flex flex-col items-center mb-8 w-full">
            <div className="flex items-center justify-center gap-3 h-14 w-full bg-white/5 rounded-2xl border border-white/10 relative overflow-hidden">
              {pin.length === 0 && !error && (
                <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm font-medium">
                  <Lock size={16} className="ml-2" />
                  أدخل رقمك السري...
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center text-rose-400 font-bold text-sm bg-rose-500/10">
                  {error}
                </div>
              )}

              {!error && pin.length > 0 && (
                <div className="flex gap-3">
                  {pin.split('').map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-4 h-4 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinInput(num.toString())}
                className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-3xl font-light text-white transition-all active:scale-90 active:bg-white/20"
              >
                {num}
              </button>
            ))}

            <button
              onClick={handleBackspace}
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white transition-all active:scale-90 flex items-center justify-center"
            >
              <Delete size={24} />
            </button>

            <button
              onClick={() => handlePinInput('0')}
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-3xl font-light text-white transition-all active:scale-90 active:bg-white/20"
            >
              0
            </button>

            <button
              onClick={handleSubmit}
              disabled={pin.length === 0 || isSubmitting}
              className={`h-16 rounded-2xl flex items-center justify-center text-white transition-all active:scale-90
                ${pin.length > 0 ? 'bg-orange-500 hover:bg-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-white/5 text-white/20 border border-white/5 pointer-events-none'}`}
            >
              {isSubmitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <ArrowRight size={28} />
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
