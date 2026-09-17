import React from 'react';
import { ShieldAlert, Ban, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { GeoBlockInfo } from '../../types';

interface RussiaBlockScreenProps {
  geoBlockInfo: GeoBlockInfo;
  onDisableSimulation?: () => void;
}

export const RussiaBlockScreen: React.FC<RussiaBlockScreenProps> = ({
  geoBlockInfo,
  onDisableSimulation,
}) => {
  return (
    <div
      id="russia-geoblock-screen"
      className="fixed inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center p-4 text-center overflow-y-auto select-none"
    >
      {/* Background Accent Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-rose-600/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-neutral-900/90 border-2 border-rose-600/50 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
        {/* Tryzub & Ban Badge */}
        <div className="relative inline-block mx-auto mb-4">
          <div className="w-20 h-20 rounded-3xl bg-neutral-950 border-2 border-rose-600 flex items-center justify-center shadow-lg shadow-rose-950/50">
            <span className="text-4xl" role="img" aria-label="Tryzub">🔱</span>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-rose-600 text-white rounded-full p-1.5 shadow-md border-2 border-neutral-900">
            <Ban className="w-5 h-5" />
          </div>
        </div>

        {/* Primary Banner */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>403 Forbidden • Sanctioned Territory</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-2">
          ДОСТУП ЗАБЛОКОВАНО
        </h1>

        <p className="text-xs sm:text-sm font-semibold text-rose-300/90 mb-4 leading-relaxed">
          Використання застосунку «Будьмо!» на території держави-агресора Російської Федерації повністю заборонено.
        </p>

        {/* English note */}
        <p className="text-[11px] text-neutral-400 mb-5 leading-normal">
          Access to this service is permanently restricted and prohibited within the borders of the Russian Federation under security protocols and international sanctions. Russian language support has been completely expunged.
        </p>

        {/* Security Diagnostics Box */}
        <div className="bg-neutral-950/90 rounded-2xl p-3.5 text-left border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1.5 mb-5 shadow-inner">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-800/80">
            <span className="text-neutral-500">РЕГІОН:</span>
            <span className="text-rose-400 font-bold">{geoBlockInfo.detectedCountry || 'Російська Федерація (RU)'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">ПРИЧИНА:</span>
            <span className="text-rose-300 font-semibold">RU_AGGRESSOR_STATE_BAN</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">ТАЙМЗОНА:</span>
            <span className="text-neutral-200">{geoBlockInfo.detectedTimezone || 'Europe/Moscow'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">РОСІЙСЬКА МОВА:</span>
            <span className="text-rose-400 font-bold">ВИКЛЮЧЕНА (BLOCKED)</span>
          </div>
          {geoBlockInfo.isSimulated && (
            <div className="pt-1 text-[10px] text-amber-400 font-sans flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Увімкнено тестову симуляцію гео-блокування</span>
            </div>
          )}
        </div>

        {/* Patriotic Motto */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 to-yellow-950/40 border border-amber-500/30 mb-5">
          <div className="text-sm font-black text-amber-300 tracking-wide">
            Слава Україні! Героям Слава! 🇺🇦
          </div>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Підтримуйте Сили оборони України в боротьбі за незалежність
          </p>
        </div>

        {/* Official Donation / Support Links */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <a
            href="https://u24.gov.ua/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
          >
            <span>United24 (Підтримка ЗСУ)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://savelife.in.ua/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 border border-neutral-700 transition"
          >
            <span>Повернись Живим</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Exit Test Mode button if simulated or testing */}
        {onDisableSimulation && (
          <button
            type="button"
            id="disable-ru-sim-btn"
            onClick={onDisableSimulation}
            className="w-full py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Вимкнути симуляцію блокування РФ (Тестовий режим)</span>
          </button>
        )}
      </div>
    </div>
  );
};
