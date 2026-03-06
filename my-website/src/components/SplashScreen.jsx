import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ onComplete }) => {
  const [show, setShow] = useState(true);
  const [started, setStarted] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio('/startup.mp3');
    // Try to play immediately (might work if user already interacted or browser allows)
    const playAudio = async () => {
      try {
        await audioRef.current.play();
        setStarted(true);
      } catch (err) {
        console.warn('Autoplay prevented. Waiting for user interaction.', err);
      }
    };
    playAudio();
  }, []);

  useEffect(() => {
    if (!started) return;

    const hideTimer = setTimeout(() => {
      setShow(false);
    }, 2500);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(completeTimer);
    };
  }, [started, onComplete]);

  const handleStart = () => {
    if (!started) {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error(e));
      }
      setStarted(true);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 cursor-pointer"
          onClick={handleStart}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, type: "spring", bounce: 0.4 }}
            className="flex flex-col items-center"
          >
            {/* Logo */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="mb-6 relative"
            >
              <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full" />
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 drop-shadow-2xl">
                {/* Bag Body */}
                <motion.path
                  d="M4 8L4 18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V8Z"
                  stroke="url(#gradientMain)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
                {/* Handle */}
                <motion.path
                  d="M16 10V6C16 3.79086 14.2091 2 12 2C9.79086 2 8 3.79086 8 6V10"
                  stroke="url(#gradientMain)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.8, ease: "easeInOut" }}
                />
                
                {/* Linear Gradients inside SVG */}
                <defs>
                  <linearGradient id="gradientMain" x1="4" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f97316" /> {/* Orange */}
                    <stop offset="1" stopColor="#1e3a8a" /> {/* Dark Blue */}
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-2 text-center">
              Maslamani Sales
            </h1>
            <p className="text-slate-400 font-medium text-sm sm:text-base tracking-widest uppercase mb-8">
              Point of Sale System
            </p>
            
            {started ? (
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
                />
              </div>
            ) : (
              <motion.div 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="mt-4 px-8 py-3.5 rounded-2xl bg-white/10 text-white font-bold border border-white/20 backdrop-blur-md shadow-xl flex items-center gap-2"
              >
                <span>انقر للبدء</span>
                <span className="text-white/50">|</span>
                <span>Click to Start</span>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
