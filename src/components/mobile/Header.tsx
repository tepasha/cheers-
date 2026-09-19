import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Wifi, 
  WifiOff, 
  CloudOff, 
  BatteryMedium, 
  BatteryCharging, 
  RefreshCw, 
  CheckCircle2 
} from 'lucide-react';
import { DeviceMode, AppLanguage } from '../../types';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { batterySaverService } from '../../services/batterySaverService';
import { t } from '../../services/i18nService';

export interface HeaderProps {
  deviceMode?: DeviceMode;
  currentTime?: string;
  isBatterySaver?: boolean;
  lang?: AppLanguage;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Header component featuring a real-time network status listener.
 * Displays a subtle banner whenever the connection to Cloud Firestore is lost,
 * informing users of offline mode with local IndexedDB persistence,
 * and provides a manual reconnection verification action.
 */
export const Header: React.FC<HeaderProps> = ({
  deviceMode = 'fluid',
  currentTime: propTime,
  isBatterySaver: propBatterySaver,
  lang,
  children,
  className = '',
}) => {
  const { isOffline, isRetrying, justReconnected, retryConnection } = useNetworkStatus();
  const [internalTime, setInternalTime] = useState('20:45');
  const [batterySaverActive, setBatterySaverActive] = useState(() => 
    propBatterySaver !== undefined ? propBatterySaver : batterySaverService.isBatterySaverEnabled()
  );

  // Time updater if no static time prop is passed
  useEffect(() => {
    if (propTime) return;
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setInternalTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [propTime]);

  // Battery saver listener
  useEffect(() => {
    if (propBatterySaver !== undefined) {
      setBatterySaverActive(propBatterySaver);
      return;
    }
    const unsub = batterySaverService.subscribe((enabled) => {
      setBatterySaverActive(enabled);
    });
    return unsub;
  }, [propBatterySaver]);

  const displayTime = propTime || internalTime;

  return (
    <header id="app-header-container" className={`w-full flex flex-col z-30 select-none ${className}`}>
      {/* 1. Native Status Bar (Fluid or Realistic Mobile frame) */}
      {deviceMode === 'fluid' ? (
        <div 
          id="header-status-bar"
          className="w-full h-8 flex items-center justify-between px-5 pt-1.5 text-xs text-neutral-400 bg-neutral-950/90 backdrop-blur-sm sticky top-0"
        >
          <span className="font-semibold text-neutral-200 text-xs tracking-tight">{displayTime}</span>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400">5G</span>
            {isOffline ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" title="Офлайн-режим" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-neutral-300" />
            )}

            {batterySaverActive ? (
              <div className="flex items-center gap-0.5 text-amber-400" title="Режим енергозбереження активний">
                <span className="text-[8px] font-bold uppercase tracking-wider bg-amber-500/20 px-1 py-0.2 rounded border border-amber-500/40">
                  ECO
                </span>
                <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
              </div>
            ) : (
              <BatteryMedium className="w-3.5 h-3.5 text-neutral-200" />
            )}
          </div>
        </div>
      ) : (
        <div 
          id="header-status-bar"
          className="w-full h-10 flex items-center justify-between px-7 pt-1 text-neutral-300 bg-neutral-950"
        >
          <span className="text-xs font-semibold tracking-tight text-neutral-200">{displayTime}</span>

          {deviceMode === 'iphone' ? (
            <div className="w-24 h-5 bg-black rounded-full flex items-center justify-between px-2.5 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-neutral-900 ring-1 ring-neutral-800" />
              <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-amber-500/80 animate-pulse' : 'bg-emerald-500/80'}`} />
            </div>
          ) : (
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border border-neutral-700/80" />
          )}

          <div className="flex items-center gap-1.5 text-neutral-300">
            <span className="text-[10px] font-bold">5G</span>
            {isOffline ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" title="Офлайн-режим" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-neutral-200" />
            )}

            {batterySaverActive ? (
              <div className="flex items-center gap-0.5 text-amber-400" title="Режим енергозбереження активний">
                <span className="text-[7px] font-bold uppercase tracking-wider bg-amber-500/20 px-0.5 rounded border border-amber-500/40">
                  ECO
                </span>
                <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
              </div>
            ) : (
              <BatteryMedium className="w-3.5 h-3.5 text-neutral-200" />
            )}
          </div>
        </div>
      )}

      {/* 2. Optional children (custom header bars/titles) */}
      {children}

      {/* 3. Subtle Firestore Offline Mode Banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            id="firestore-offline-banner"
            role="status"
            aria-live="polite"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden bg-neutral-900/95 border-b border-amber-500/30 backdrop-blur-md"
          >
            <div className="px-3.5 py-1.5 flex items-center justify-between gap-2.5">
              {/* Left: Status icon & messaging */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </div>

                <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-amber-300 tracking-tight whitespace-nowrap">
                      {t('firestore_offline_title', lang)}
                    </span>
                    <span className="text-[10px] text-neutral-400 hidden xs:inline">•</span>
                    <span className="text-[10px] text-neutral-300 font-medium truncate">
                      {t('firestore_offline_desc', lang)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Retry connection action */}
              <button
                type="button"
                id="firestore-offline-retry-btn"
                onClick={() => void retryConnection()}
                disabled={isRetrying}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 border border-amber-500/30 text-[10px] font-semibold text-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
                title="Перевірити підключення до Cloud Firestore"
              >
                <RefreshCw className={`w-2.5 h-2.5 text-amber-400 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? t('firestore_offline_retrying', lang) : t('firestore_offline_retry', lang)}</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* 4. Subtle Firestore Reconnected Reassurance Banner */}
        {justReconnected && !isOffline && (
          <motion.div
            id="firestore-reconnected-banner"
            role="status"
            aria-live="polite"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden bg-emerald-950/90 border-b border-emerald-500/30 backdrop-blur-md"
          >
            <div className="px-3.5 py-1 flex items-center justify-between text-emerald-300 text-[10px]">
              <div className="flex items-center gap-1.5 font-medium truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{t('firestore_reconnected', lang)}</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-wider bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                Online
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
