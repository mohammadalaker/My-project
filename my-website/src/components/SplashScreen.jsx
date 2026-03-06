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
            <div className="w-28 h-28 mb-8 rounded-[2rem] bg-gradient-to-tr from-orange-500 to-amber-500 shadow-2xl shadow-orange-500/30 flex items-center justify-center border-4 border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/20 w-1/2 h-full -skew-x-12 -translate-x-full animate-[shimmer_2s_infinite]" />
              <span className="text-5xl font-black text-white px-2 tracking-tighter">MS</span>
            </div>
            
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
