import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Copy, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { sounds } from '../../services/soundService';

interface AppIconModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppIconModal: React.FC<AppIconModalProps> = ({ isOpen, onClose }) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    sounds.playTap();
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                  <span>Іконка додатка</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    Будьмо!
                  </span>
                </h3>
                <p className="text-[10px] text-neutral-400">Офіційні ассети для Web, iOS та Android</p>
              </div>
            </div>

            <button
              type="button"
              id="app-icon-modal-close-btn"
              onClick={() => {
                sounds.playPop();
                onClose();
              }}
              className="p-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition"
              title="Закрити"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="py-4 overflow-y-auto space-y-4 pr-0.5">
            {/* High-res Icon Preview */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800/80 shadow-inner">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-3xl blur-md opacity-30 group-hover:opacity-60 transition duration-500" />
                <img
                  src="/icon.png"
                  alt="Будьмо! App Icon"
                  className="relative w-28 h-28 rounded-2xl shadow-xl border border-neutral-800 object-contain bg-black p-1"
                  onError={(e) => {
                    // Fallback to SVG if PNG fails to load in preview
                    (e.target as HTMLImageElement).src = '/icon.svg';
                  }}
                />
                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-neutral-950 p-1 rounded-full shadow-lg">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="mt-3 text-[11px] font-bold text-neutral-200">
                Офіційний фірмовий знак «Будьмо!» (Келихи пива 🍻)
              </span>
              <span className="text-[10px] text-neutral-500">
                512 × 512 px • Чорний фон (#000000) • Растр та Вектор
              </span>
            </div>

            {/* Quick Download Buttons */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-neutral-300 block">
                Завантажити напряму:
              </span>

              <div className="grid grid-cols-2 gap-2">
                <a
                  id="download-icon-png-btn"
                  href="/icon.png"
                  download="budmo-app-icon-512.png"
                  onClick={() => sounds.playClink()}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs shadow-md transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG (Растр)</span>
                </a>

                <a
                  id="download-icon-svg-btn"
                  href="/icon.svg"
                  download="budmo-app-icon.svg"
                  onClick={() => sounds.playClink()}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs border border-neutral-700 transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>SVG (Вектор)</span>
                </a>
              </div>
            </div>

            {/* File Locations in Project */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-neutral-300 block">
                Шляхи до файлів у кодовій базі:
              </span>

              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-neutral-500">/public/</span>
                    <span className="text-amber-300">icon.png</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('/public/icon.png', 'png')}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                    title="Скопіювати шлях"
                  >
                    {copiedType === 'png' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-neutral-500">/public/</span>
                    <span className="text-amber-300">icon.svg</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('/public/icon.svg', 'svg')}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                    title="Скопіювати шлях"
                  >
                    {copiedType === 'svg' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-neutral-500">/assets/</span>
                    <span className="text-amber-300">adaptive-icon.png</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('/assets/adaptive-icon.png', 'adaptive')}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                    title="Скопіювати шлях"
                  >
                    {copiedType === 'adaptive' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Platform Integration Notes */}
            <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/60 text-[10px] text-neutral-400 leading-relaxed space-y-1">
              <div className="font-semibold text-neutral-300 flex items-center gap-1">
                <span>📱 Використання у мобільній збірці (Expo / React Native):</span>
              </div>
              <p>
                Конфігурація `app.json` уже привʼязана до `./assets/icon.png`, `./assets/adaptive-icon.png` та `./assets/splash.png`. При збірці через EAS Build вони автоматично формують іконки для Android (APK/AAB) та iOS (IPA).
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-neutral-800">
            <button
              type="button"
              id="app-icon-modal-done-btn"
              onClick={() => {
                sounds.playTap();
                onClose();
              }}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition"
            >
              Зрозуміло
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
