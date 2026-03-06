import { useCallback, useRef, useEffect } from 'react';

const FILES = {
  success: '/success.mp3',
  successFallback: '/beep.mp3', // backward compatibility
  error: '/error.mp3',
  checkout: '/checkout.mp3',
};

const VOLUME = { success: 0.4, error: 0.45, checkout: 0.4 };

/** Web Audio fallbacks — أصوات مختلفة تماماً عن بعض */
function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function fallbackSuccess() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch (_) {}
}

function fallbackError() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = 120;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    gain.gain.setValueAtTime(0, t + 0.14);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.start(t);
    osc.stop(t + 0.28);
  } catch (_) {}
}

function fallbackCheckout() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const playTone = (freq, start, duration, vol = 0.07) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    playTone(523, t, 0.18);
    playTone(784, t + 0.14, 0.22);
  } catch (_) {}
}

/**
 * Audio Manager — نظام تنبيهات صوتية مع Pre-loading لتقليل التأخير.
 * يستخدم success.mp3 / error.mp3 / checkout.mp3 مع fallback لـ Web Audio.
 */
export function useSystemSounds() {
  const audioRef = useRef({
    success: null,
    successAlt: null,
    error: null,
    checkout: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const a = audioRef.current;
    // Pre-load: إنشاء وتحميل الملفات مسبقاً لتجنب Latency
    try {
      a.success = new Audio(FILES.success);
      a.success.volume = VOLUME.success;
      a.success.preload = 'auto';
      a.success.load();
    } catch (_) {}
    try {
      a.successAlt = new Audio(FILES.successFallback);
      a.successAlt.volume = VOLUME.success;
      a.successAlt.preload = 'auto';
      a.successAlt.load();
    } catch (_) {}
    try {
      a.error = new Audio(FILES.error);
      a.error.volume = VOLUME.error;
      a.error.preload = 'auto';
      a.error.load();
    } catch (_) {}
    try {
      a.checkout = new Audio(FILES.checkout);
      a.checkout.volume = VOLUME.checkout;
      a.checkout.preload = 'auto';
      a.checkout.load();
    } catch (_) {}
  }, []);

  const playSuccess = useCallback(() => {
    const a = audioRef.current;
    const play = (el) => {
      if (!el) return;
      try {
        el.currentTime = 0;
        el.play().catch(() => fallbackSuccess());
      } catch (_) {
        fallbackSuccess();
      }
    };
    if (a.success) {
      a.success.currentTime = 0;
      a.success.play().catch(() => {
        if (a.successAlt) {
          a.successAlt.currentTime = 0;
          a.successAlt.play().catch(() => fallbackSuccess());
        } else {
          fallbackSuccess();
        }
      });
    } else if (a.successAlt) {
      play(a.successAlt);
    } else {
      fallbackSuccess();
    }
  }, []);

  const playError = useCallback(() => {
    // دائماً نغمة منخفضة مزدوجة (مميزة عن النجاح والـ checkout)
    fallbackError();
  }, []);

  const playCheckout = useCallback(() => {
    // دائماً نغمتان تصاعديتان (مميزة عن النجاح والخطأ)
    fallbackCheckout();
  }, []);

  return { playSuccess, playError, playCheckout };
}
