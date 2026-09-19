import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wine, Sparkles, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { sounds } from '../../services/soundService';

interface LaunchScreenProps {
  onContinueToAuth?: () => void;
  onContinueToApp?: () => void;
  isLoggedIn?: boolean;
  autoAdvance?: boolean;
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({
  onContinueToAuth,
  onContinueToApp,
  isLoggedIn = false,
  autoAdvance = true,
}) => {
  const [progress, setProgress] = useState(15);
  const [statusMessage, setStatusMessage] = useState('Ініціалізація Cloud Firestore...');
  const [isReady, setIsReady] = useState(false);

  const handleProceed = () => {
    sounds.playClink();
    if (isLoggedIn && onContinueToApp) {
      onContinueToApp();
    } else if (onContinueToAuth) {
      onContinueToAuth();
    } else if (onContinueToApp) {
      onContinueToApp();
    }
  };

  useEffect(() => {
    // Play welcoming glass clink sound
    try {
      sounds.playClink();
    } catch {
      // Audio might require user gesture
    }

    const t1 = setTimeout(() => {
      setProgress(45);
      setStatusMessage('Завантаження мапи закладів Києва...');
    }, 500);

    const t2 = setTimeout(() => {
      setProgress(75);
      setStatusMessage('Перевірка криптографічних ключів E2EE...');
    }, 1100);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusMessage(isLoggedIn ? 'Сесію автоматично продовжено (36 год)!' : 'Система готова!');
      setIsReady(true);
    }, 1700);

    let t4: ReturnType<typeof setTimeout> | null = null;
    if (autoAdvance) {
      t4 = setTimeout(() => {
        if (isLoggedIn && onContinueToApp) {
          onContinueToApp();
        } else if (onContinueToAuth) {
          onContinueToAuth();
        }
      }, 2300);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (t4) clearTimeout(t4);
    };
  }, [autoAdvance, isLoggedIn, onContinueToApp, onContinueToAuth]);

  return (
    <div
      id="app-launch-screen"
      className="relative flex-1 w-full h-full bg-neutral-950 flex flex-col items-center justify-between p-6 select-none overflow-hidden"
    >
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-64 h-64 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top subtle badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="pt-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/80 border border-neutral-800 text-[10px] font-semibold text-neutral-300"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>v2.4.0 • Безпечно та конфіденційно</span>
      </motion.div>

      {/* Center Brand Identity */}
      <div className="flex flex-col items-center text-center space-y-4 my-auto z-10 max-w-xs">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 120 }}
          className="relative"
        >
          {/* Logo badge with pulse */}
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-0.5 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-neutral-950 rounded-[22px] flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-transparent" />
              <Wine className="w-11 h-11 text-amber-400 transform -rotate-12 transition-transform group-hover:scale-110" />
              <Sparkles className="w-5 h-5 text-yellow-300 absolute top-3 right-3 animate-pulse" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
            Будьмо!
          </h1>
          <p className="text-xs text-neutral-400 font-medium leading-relaxed px-2">
            Знайди компанію на вечір, келих улюбленого напою чи групову сходку
          </p>
        </motion.div>

        {/* Progress Bar & Status Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full space-y-2 pt-4"
        >
          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-800">
            <motion.div
              className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full"
              initial={{ width: '15%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeInOut', duration: 0.3 }}
            />
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 font-mono">
            {isReady ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            )}
            <span className="truncate">{statusMessage}</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Actions & Reassurance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="w-full max-w-xs space-y-3 z-10 pb-4"
      >
        <button
          type="button"
          id="launch-continue-btn"
          onClick={handleProceed}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.98] text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span>{isLoggedIn ? 'Увійти в застосунок (Сесія активна)' : 'До екрана авторизації'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-500 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>E2EE шифрування • Cloud Firestore • Безпечний чат</span>
        </div>
      </motion.div>
    </div>
  );
};
