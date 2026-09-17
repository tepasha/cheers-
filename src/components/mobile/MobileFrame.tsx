import React, { useState, useEffect } from 'react';
import { Wifi, BatteryMedium } from 'lucide-react';
import { DeviceMode, AuthUser, PushNotificationItem } from '../../types';
import { PushNotificationBanner } from './PushNotificationBanner';

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
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  deviceMode,
  activeBanner = null,
  onNavigateToHangout,
  onNavigateToChat,
}) => {
  const [currentTime, setCurrentTime] = useState('20:45');

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
          {/* Native Mobile Status Bar */}
          <div className="w-full h-8 flex items-center justify-between px-5 pt-1.5 text-xs text-neutral-400 select-none bg-neutral-950/90 backdrop-blur-sm sticky top-0 z-30">
            <span className="font-semibold text-neutral-200 text-xs">{currentTime}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold">5G</span>
              <Wifi className="w-3.5 h-3.5" />
              <BatteryMedium className="w-3.5 h-3.5 text-neutral-200" />
            </div>
          </div>

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
      {/* Realistic Mobile Enclosure */}
      <div
        id="mobile-device-container"
        className={`relative w-full max-w-[390px] h-[844px] max-h-[100vh] sm:max-h-[96vh] flex flex-col bg-neutral-950 transition-all duration-300 ${
          deviceMode === 'iphone'
            ? 'sm:rounded-[50px] sm:border-[10px] sm:border-neutral-800 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1)] sm:ring-1 sm:ring-neutral-900'
            : 'sm:rounded-[36px] sm:border-[8px] sm:border-neutral-800 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] sm:ring-1 sm:ring-neutral-900'
        } overflow-hidden`}
      >
        {/* Phone Speaker & Dynamic Island / Camera Hole */}
        <div className="absolute top-0 left-0 right-0 h-10 z-40 flex items-center justify-between px-7 pt-1 pointer-events-none select-none">
          <span className="text-xs font-semibold tracking-tight text-neutral-200">{currentTime}</span>

          {deviceMode === 'iphone' ? (
            <div className="w-24 h-5 bg-black rounded-full flex items-center justify-between px-2.5 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-neutral-900 ring-1 ring-neutral-800" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            </div>
          ) : (
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border border-neutral-700/80" />
          )}

          <div className="flex items-center gap-1.5 text-neutral-300">
            <span className="text-[10px] font-bold">5G</span>
            <Wifi className="w-3 h-3" />
            <BatteryMedium className="w-3.5 h-3.5 text-neutral-200" />
          </div>
        </div>

        {/* Screen Content */}
        <div className="flex-1 flex flex-col pt-9 overflow-hidden bg-neutral-950 relative">
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
