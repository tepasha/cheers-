import React, { useState } from 'react';
import { ShieldAlert, X, PhoneCall, Copy, Check, Eye, UserX, AlertOctagon, MapPin } from 'lucide-react';
import { safetyModerationService, SOS_SAFETY_TIPS } from '../../services/safetyModerationService';
import { sounds } from '../../services/soundService';

interface SosEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  interlocutorId?: string;
  interlocutorName?: string;
  venueName?: string;
  onInterlocutorBlocked?: () => void;
}

export const SosEmergencyModal: React.FC<SosEmergencyModalProps> = ({
  isOpen,
  onClose,
  interlocutorId,
  interlocutorName,
  venueName,
  onInterlocutorBlocked,
}) => {
  const [copiedAngela, setCopiedAngela] = useState(false);
  const [showFullScreenAngela, setShowFullScreenAngela] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  if (!isOpen) return null;

  const handleCopyAngela = () => {
    const text = 'Будь ласка, покличте допомогу або викличте таксі. Запитайте Анжелу.';
    navigator.clipboard?.writeText(text);
    setCopiedAngela(true);
    sounds.playTap();
    setTimeout(() => setCopiedAngela(false), 2500);
  };

  const handleBlockInterlocutor = () => {
    if (!interlocutorName) return;
    safetyModerationService.triggerSosAlert({
      interlocutorId: interlocutorId || interlocutorName,
      interlocutorName,
      venueName,
    });
    setIsBlocked(true);
    sounds.playPop();

    setTimeout(() => {
      onClose();
      if (onInterlocutorBlocked) {
        onInterlocutorBlocked();
      }
    }, 1200);
  };

  if (showFullScreenAngela) {
    return (
      <div 
        onClick={() => setShowFullScreenAngela(false)}
        className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer"
      >
        <div className="p-4 rounded-3xl bg-neutral-900 border-2 border-red-500 max-w-sm space-y-4">
          <div className="text-4xl">🍸 🚨</div>
          <h2 className="text-2xl font-extrabold text-red-400 uppercase tracking-tight">
            Потрібна допомога
          </h2>
          <p className="text-lg font-bold text-white leading-snug">
            «Чи можу я запитати Анжелу?»
          </p>
          <p className="text-xs text-neutral-300">
            (Кодова фраза безпеки: Будь ласка, допоможіть непомітно вийти або викличте таксі)
          </p>
          <div className="pt-2 text-[11px] text-neutral-400">
            Натисніть у будь-якому місці, щоб закрити
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-950 border border-red-500/40 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-600/30 text-red-400 flex items-center justify-center border border-red-500/40 animate-pulse">
              <AlertOctagon className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5 leading-tight">
                SOS: Екстрена безпека 🚨
              </h3>
              <p className="text-[10px] text-neutral-400">
                Захист у барі та екстрена допомога
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Emergency Call Buttons */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
            <PhoneCall className="w-3 h-3" />
            <span>Екстрені служби (Україна):</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="tel:112"
              className="py-2.5 px-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/30"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Дзвінок 112</span>
            </a>

            <a
              href="tel:102"
              className="py-2.5 px-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-bold text-xs flex items-center justify-center gap-2 transition border border-neutral-700"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              <span>Поліція 102</span>
            </a>
          </div>
        </div>

        {/* Ask for Angela bar safety card */}
        <div className="p-3.5 rounded-2xl bg-neutral-900 border border-amber-500/30 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍸</span>
            <div>
              <div className="text-xs font-bold text-amber-300">
                Кодова фраза: «Запитайте Анжелу»
              </div>
              <div className="text-[10px] text-neutral-400">
                Міжнародний протокол безпеки для барів та кафе
              </div>
            </div>
          </div>

          <p className="text-[11px] text-neutral-300 leading-relaxed bg-neutral-950/60 p-2 rounded-xl border border-neutral-800">
            Якщо ви відчуваєте загрозу або дискомфорт, підійдіть до бармена і скажіть:{' '}
            <strong className="text-amber-400">«Чи тут Анжела?»</strong>. Персонал допоможе викликати безпечне таксі або вийти без конфлікту.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAngela}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              {copiedAngela ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Скопійовано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Скопіювати</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowFullScreenAngela(true)}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Показати бармену</span>
            </button>
          </div>
        </div>

        {/* Instant Block / Leave chat button if in chat */}
        {interlocutorName && (
          <div className="p-3 rounded-2xl bg-red-950/30 border border-red-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold text-red-300">
                Заблокувати {interlocutorName}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Чат буде негайно заморожено і сховано, а співрозмовника додано в чорний список.
            </p>

            <button
              type="button"
              id="sos-block-interlocutor-btn"
              onClick={handleBlockInterlocutor}
              disabled={isBlocked}
              className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>{isBlocked ? 'Заблоковано та ізольовано' : `Заблокувати та закрити чат`}</span>
            </button>
          </div>
        )}

        {/* Safety tips */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Поради особистої безпеки:
          </div>
          {SOS_SAFETY_TIPS.map((tip, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 rounded-xl bg-neutral-900/50 border border-neutral-800 text-[10px] text-neutral-400"
            >
              <span className="text-xs mt-0.5">{tip.icon}</span>
              <div>
                <strong className="text-neutral-200 block">{tip.title}</strong>
                <span>{tip.description}</span>
              </div>
            </div>
          ))}
        </div>

        {venueName && (
          <div className="text-[10px] text-neutral-400 flex items-center justify-center gap-1 pt-1">
            <MapPin className="w-3 h-3 text-amber-400" />
            <span>Ваша поточна локація: <strong>{venueName}</strong></span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
        >
          Закрити
        </button>
      </div>
    </div>
  );
};
