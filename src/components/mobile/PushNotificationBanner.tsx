import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Wine, ChevronRight } from 'lucide-react';
import { PushNotificationItem } from '../../types';
import { pushNotificationService } from '../../services/pushNotificationService';
import { sounds } from '../../services/soundService';

interface PushNotificationBannerProps {
  banner: PushNotificationItem | null;
  onNavigateToHangout?: (hangoutId?: string, venueName?: string) => void;
  onNavigateToChat?: (chatId?: string, buddyId?: string) => void;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({
  banner,
  onNavigateToHangout,
  onNavigateToChat,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!banner) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const duration = 6000; // 6 seconds
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return Math.max(0, prev - step);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [banner?.id]);

  if (!banner) return null;

  const handleBannerClick = () => {
    sounds.playTap();
    pushNotificationService.markAsRead(banner.id);
    pushNotificationService.dismissBanner();

    if (banner.type === 'table_seat' || banner.type === 'hangout_alert') {
      onNavigateToHangout?.(banner.hangoutId, banner.venueName);
    } else if (banner.type === 'chat_message' || banner.type === 'cheers_toast') {
      onNavigateToChat?.(banner.chatId, banner.buddyId);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playTap();
    pushNotificationService.dismissBanner();
  };

  const isTableSeat = banner.type === 'table_seat';

  return (
    <AnimatePresence>
      <motion.div
        key={banner.id}
        initial={{ y: -80, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -80, opacity: 0, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className="absolute top-2 left-2 right-2 z-50 select-none cursor-pointer"
        onClick={handleBannerClick}
        role="alert"
        aria-live="assertive"
      >
        <div className="bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl p-3 shadow-[0_15px_35px_-5px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] relative overflow-hidden group hover:border-amber-500/50 transition-colors">
          {/* Top metadata line: App identity + Category tag + Time */}
          <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 rounded-md bg-gradient-to-tr from-amber-600 to-amber-400 items-center justify-center text-[10px] shadow-sm">
                🍻
              </span>
              <span className="font-bold tracking-tight text-neutral-200 uppercase text-[9px]">
                Будьмо! • Push
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full font-medium text-[9px] ${
                  isTableSeat
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {isTableSeat ? 'Столик у барі' : 'Нове повідомлення'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-neutral-400 text-[10px]">Зараз</span>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-5 h-5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition"
                title="Закрити сповіщення"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Main content body */}
          <div className="flex items-start gap-2.5">
            {/* Avatar or Icon */}
            <div className="relative shrink-0 mt-0.5">
              {banner.avatar ? (
                <img
                  src={banner.avatar}
                  alt={banner.buddyName || 'Користувач'}
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-neutral-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isTableSeat ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'
                  }`}
                >
                  {isTableSeat ? <Wine className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-neutral-900 flex items-center justify-center text-[10px] shadow">
                {isTableSeat ? '🍻' : '💬'}
              </span>
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white tracking-tight leading-tight truncate flex items-center gap-1.5">
                {banner.title}
              </h4>
              <p className="text-[11px] font-semibold text-amber-300 mt-0.5 leading-snug line-clamp-2">
                {banner.body}
              </p>
              {banner.subtitle && (
                <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                  {banner.subtitle}
                </p>
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 shrink-0 self-center transition-colors" />
          </div>

          {/* Quick action button pill */}
          <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
            <span className="text-[9px] text-neutral-400 flex items-center gap-1">
              <span>Торкніться, щоб відкрити</span>
            </span>

            <button
              type="button"
              onClick={handleBannerClick}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-sm ${
                isTableSeat
                  ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950'
              }`}
            >
              {isTableSeat ? <Wine className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
              <span>{banner.actionText || 'Переглянути'}</span>
            </button>
          </div>

          {/* Subtle countdown progress line */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-800">
            <div
              className={`h-full transition-all duration-75 ${
                isTableSeat ? 'bg-amber-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
