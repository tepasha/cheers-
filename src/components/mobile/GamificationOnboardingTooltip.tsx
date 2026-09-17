import React, { useState, useEffect } from 'react';
import { Trophy, Award, Flame, ArrowRight, Check, X, HelpCircle, Sparkles } from 'lucide-react';
import { sounds } from '../../services/soundService';

interface GamificationOnboardingTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToProfile?: () => void;
}

const STORAGE_KEY = 'budmo_gamification_tour_seen';

export const GamificationOnboardingTooltip: React.FC<GamificationOnboardingTooltipProps> = ({
  isOpen,
  onClose,
  onNavigateToProfile,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Система рівнів «Level Up» 🍻',
      subtitle: 'Гейміфікація ваших зустрічей у барах',
      icon: <Trophy className="w-6 h-6 text-amber-400" />,
      badge: 'Новинка',
      content: (
        <div className="space-y-2 text-xs text-neutral-300">
          <p>
            Знайомтеся, відпочивайте та піднімайтеся сходами барної майстерності!
          </p>
          <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-200 font-semibold">
              <span>🍺 Рівень 1: Новачок у шинку</span>
              <span className="text-[10px] text-amber-400">0 XP</span>
            </div>
            <div className="flex items-center justify-between text-neutral-200 font-semibold">
              <span>🍷 Рівень 4: Крафтовий сомельє</span>
              <span className="text-[10px] text-amber-400">600 XP</span>
            </div>
            <div className="flex items-center justify-between text-neutral-200 font-semibold">
              <span>🏆 Рівень 6: Гросмейстер тостів</span>
              <span className="text-[10px] text-amber-400">1500+ XP</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Як заробляти бали (XP) ⚡',
      subtitle: 'Бали за кожен дружній візит та підсадку',
      icon: <Flame className="w-6 h-6 text-amber-500" />,
      badge: '+Очки досвіду',
      content: (
        <div className="space-y-1.5 text-xs text-neutral-300">
          <div className="flex items-center gap-2 p-2 bg-neutral-950/70 rounded-xl border border-neutral-800">
            <span className="text-base">📍</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-neutral-100 block truncate">Чекін або візит у бар</span>
              <span className="text-[10px] text-neutral-400">Будь-який заклад Києва чи України</span>
            </div>
            <span className="font-extrabold text-amber-400 text-xs shrink-0">+100 XP</span>
          </div>

          <div className="flex items-center gap-2 p-2 bg-neutral-950/70 rounded-xl border border-neutral-800">
            <span className="text-base">👥</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-neutral-100 block truncate">Підсадка до столика</span>
              <span className="text-[10px] text-neutral-400">У вкладці «Тусовки» біля вас</span>
            </div>
            <span className="font-extrabold text-amber-400 text-xs shrink-0">+80 XP</span>
          </div>

          <div className="flex items-center gap-2 p-2 bg-neutral-950/70 rounded-xl border border-neutral-800">
            <span className="text-base">🥂</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-neutral-100 block truncate">Тост келихами «Будьмо!»</span>
              <span className="text-[10px] text-neutral-400">При знайомстві чи в чаті</span>
            </div>
            <span className="font-extrabold text-amber-400 text-xs shrink-0">+30 XP</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Прогрес-бар у Профілі 🎖️',
      subtitle: 'Відстежуйте свій статус та досягнення',
      icon: <Award className="w-6 h-6 text-amber-400" />,
      badge: 'Профіль',
      content: (
        <div className="space-y-2 text-xs text-neutral-300">
          <p>
            У вашому <strong>Профілі</strong> зʼявився живий прогрес-бар, шкала всіх рівнів та колекція бейджів (наприклад, <em>«Король Подолу»</em> чи <em>«Барний марафон»</em>).
          </p>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-200">
            💡 Підвищуйте рівень, щоб отримувати розширений радіус кличів, пріоритет підсадки та статус верифікованого учасника компанії!
          </div>
        </div>
      ),
    },
  ];

  if (!isOpen) return null;

  const stepData = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    sounds.playTap();
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onClose();
    if (isLast && onNavigateToProfile) {
      onNavigateToProfile();
    }
  };

  const handleDismiss = () => {
    sounds.playTap();
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-neutral-900 border border-amber-500/50 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-[0_0_40px_rgba(245,158,11,0.2)] animate-in zoom-in-95 relative overflow-hidden">
        {/* Decorative lighting */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              {stepData.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                  <span>{stepData.title}</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                </h3>
              </div>
              <span className="text-[10px] text-amber-400 font-medium block mt-0.5">
                {stepData.subtitle}
              </span>
            </div>
          </div>

          <button
            type="button"
            id="close-onboarding-tooltip-btn"
            onClick={handleDismiss}
            className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-xs transition"
            title="Закрити"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="py-1 min-h-[140px] flex flex-col justify-center">
          {stepData.content}
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'w-6 bg-amber-400'
                    : 'w-2 bg-neutral-700 hover:bg-neutral-600'
                }`}
                title={`Крок ${idx + 1}`}
              />
            ))}
            <span className="text-[10px] text-neutral-400 font-mono ml-2">
              {currentStep + 1} з {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isLast ? (
              <button
                type="button"
                id="tooltip-next-btn"
                onClick={handleNext}
                className="py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1 transition shadow-sm active:scale-95"
              >
                <span>Далі</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                id="tooltip-view-profile-btn"
                onClick={handleComplete}
                className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs flex items-center gap-1 transition shadow-md shadow-amber-500/20 active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Відкрити профіль</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Small persistent quick tooltip button helper that opens the guide anytime
 */
export const QuickGamificationHelpButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      type="button"
      id="gamification-quick-help-btn"
      onClick={() => {
        sounds.playTap();
        onClick();
      }}
      className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-xl transition"
      title="Як працює система балів та рівнів?"
    >
      <HelpCircle className="w-3.5 h-3.5" />
      <span>Як працюють бали?</span>
    </button>
  );
};

/**
 * Hook to automatically determine if first-time user tour should be shown
 */
export function useGamificationOnboarding(initialDelayMs = 900) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const timer = setTimeout(() => {
          setShouldShow(true);
        }, initialDelayMs);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [initialDelayMs]);

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setShouldShow(false);
  };

  const reOpen = () => {
    setShouldShow(true);
  };

  return { shouldShow, markSeen, reOpen };
}
