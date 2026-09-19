import React, { useState, useEffect } from 'react';
import { DeviceMode, AuthUser, PushNotificationItem, AppLanguage } from '../../types';
import { PushNotificationBanner } from './PushNotificationBanner';
import { Header } from './Header';
import { batterySaverService } from '../../services/batterySaverService';

interface MobileFrameProps {
  children: React.ReactNode;
  deviceMode: DeviceMode;
  onDeviceChange?: (mode: DeviceMode) => void;
  onOpenArchitecture?: () => void;
  currentUser?: AuthUser;
  onOpenAuth?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  activeBanner?: PushNotificationItem | null;
  onNavigateToHangout?: (hangoutId?: string, venueName?: string) => void;
  onNavigateToChat?: (chatId?: string, buddyId?: string) => void;
  lang?: AppLanguage;
  activeFlow?: 'launch' | 'auth' | 'app';
  onSelectFlow?: (flow: 'launch' | 'auth' | 'app') => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  deviceMode,
  activeBanner = null,
  onNavigateToHangout,
  onNavigateToChat,
  lang,
  activeFlow,
  onSelectFlow,
}) => {
  const [currentTime, setCurrentTime] = useState('20:45');
  const [isBatterySaver, setIsBatterySaver] = useState(() => batterySaverService.isBatterySaverEnabled());

  useEffect(() => {
    const unsub = batterySaverService.subscribe((enabled) => {
      setIsBatterySaver(enabled);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  if (deviceMode === 'fluid') {
    return (
      <div className="w-full min-h-screen bg-neutral-950 flex flex-col items-center justify-start">
        <div className="w-full max-w-md flex-1 min-h-screen flex flex-col bg-neutral-950 relative shadow-2xl">
          {/* Native Mobile Status Bar & Network Listener Header */}
          <Header
            deviceMode="fluid"
            currentTime={currentTime}
            isBatterySaver={isBatterySaver}
            lang={lang}
          />

          {/* Real-time Heads-up Push Notification Banner */}
          <PushNotificationBanner
            banner={activeBanner}
            onNavigateToHangout={onNavigateToHangout}
            onNavigateToChat={onNavigateToChat}
          />
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-0 sm:p-4 overflow-x-hidden">
      {/* Top flow selector for previewing Launch and Auth screens */}
      {onSelectFlow && activeFlow && (
        <div className="mb-2 hidden sm:flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-800 p-1 rounded-full text-xs font-medium shadow-md select-none">
          <span className="text-[10px] text-neutral-400 px-2 font-semibold">Екрани додатку:</span>
          <button
            type="button"
            id="flow-switch-launch"
            onClick={() => onSelectFlow('launch')}
            className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
              activeFlow === 'launch'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🚀 Запуск (Splash)
          </button>
          <button
            type="button"
            id="flow-switch-auth"
            onClick={() => onSelectFlow('auth')}
            className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
              activeFlow === 'auth'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🔐 Авторизація
          </button>
          <button
            type="button"
            id="flow-switch-app"
            onClick={() => onSelectFlow('app')}
            className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
              activeFlow === 'app'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            📱 Додаток (Головна)
          </button>
        </div>
      )}

      {/* Realistic Mobile Enclosure */}
      <div
        id="mobile-device-container"
        className={`relative w-full max-w-[390px] h-[844px] max-h-[100vh] sm:max-h-[96vh] flex flex-col bg-neutral-950 transition-all duration-300 ${
          deviceMode === 'iphone'
            ? 'sm:rounded-[50px] sm:border-[10px] sm:border-neutral-800 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1)] sm:ring-1 sm:ring-neutral-900'
            : 'sm:rounded-[36px] sm:border-[8px] sm:border-neutral-800 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] sm:ring-1 sm:ring-neutral-900'
        } overflow-hidden`}
      >
        {/* Top Header with Phone Notch & Firestore Offline Status Listener */}
        <Header
          deviceMode={deviceMode}
          currentTime={currentTime}
          isBatterySaver={isBatterySaver}
          lang={lang}
        />

        {/* Screen Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950 relative">
          {/* Real-time Heads-up Push Notification Banner */}
          <PushNotificationBanner
            banner={activeBanner}
            onNavigateToHangout={onNavigateToHangout}
            onNavigateToChat={onNavigateToChat}
          />
          {children}
        </div>

        {/* Home Indicator Bar */}
        {deviceMode === 'iphone' && (
          <div className="absolute bottom-1 left-0 right-0 h-4 flex items-center justify-center pointer-events-none z-40">
            <div className="w-32 h-1 bg-neutral-500/60 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};
