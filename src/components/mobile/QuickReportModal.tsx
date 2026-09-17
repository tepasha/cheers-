import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, Check, UserX } from 'lucide-react';
import { ReportCategory, ReportTargetType } from '../../types';
import { REPORT_CATEGORIES, safetyModerationService } from '../../services/safetyModerationService';
import { sounds } from '../../services/soundService';

interface QuickReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ReportTargetType;
  targetName: string;
  targetAvatar?: string;
  onSuccess?: (blocked: boolean) => void;
}

export const QuickReportModal: React.FC<QuickReportModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetName,
  targetAvatar,
  onSuccess,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('harassment');
  const [comment, setComment] = useState('');
  const [autoBlock, setAutoBlock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await safetyModerationService.submitReport({
        targetId,
        targetType,
        targetName,
        targetAvatar,
        category: selectedCategory,
        comment,
        shouldBlockUser: autoBlock,
      });

      setSubmitted(true);
      sounds.playSuccess();

      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitted(false);
        onClose();
        if (onSuccess) {
          onSuccess(autoBlock);
        }
      }, 1400);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const getTargetTypeLabel = (type: ReportTargetType) => {
    switch (type) {
      case 'profile':
        return 'профіль';
      case 'hangout':
        return 'клич на вечір';
      case 'checkin':
        return 'чекін у закладі';
      case 'chat':
        return 'чат / повідомлення';
      case 'group_meetup':
        return 'групову зустріч';
      default:
        return 'контент';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 leading-tight">
                Поскаржитися на {getTargetTypeLabel(targetType)}
              </h3>
              <p className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                {targetName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30 animate-in zoom-in-50">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-100">
                Скаргу надіслано модерації
              </h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-[260px] mx-auto">
                Дякуємо за допомогу спільноті! Користувача заблоковано, а контент направлено на перевірку.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Category selection */}
            <div>
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-2">
                Причина скарги:
              </label>
              <div className="space-y-1.5">
                {REPORT_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => {
                        sounds.playTap();
                        setSelectedCategory(cat.id);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition ${
                        isSelected
                          ? 'bg-red-500/10 border-red-500/50 text-neutral-100'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-base shrink-0">{cat.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>{cat.title}</span>
                          {cat.severity === 'critical' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                              Авто-бан
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {cat.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional comment */}
            <div>
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                Додаткові деталі (за бажанням):
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Опишіть ситуацію, якщо це допоможе швидше розглянути скаргу..."
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-neutral-100 focus:outline-none focus:border-red-500 placeholder:text-neutral-500"
              />
            </div>

            {/* Auto-block toggle */}
            <div
              onClick={() => setAutoBlock(!autoBlock)}
              className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between cursor-pointer hover:border-neutral-700 transition"
            >
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Миттєво заблокувати цей акаунт
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Людина не зможе вам писати та бачити вас на мапі
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoBlock}
                onChange={(e) => setAutoBlock(e.target.checked)}
                className="w-4 h-4 accent-red-500 rounded cursor-pointer"
              />
            </div>

            {/* Anti-abuse notice */}
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-[10px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>
                Система автоматично ізолює підозрілі акаунти при надходженні 2+ скарг або критичних порушень правил спільноти 18+.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition"
              >
                Скасувати
              </button>
              <button
                type="submit"
                id="submit-report-confirm-btn"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-lg shadow-red-600/20 flex items-center justify-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Надсилання...' : 'Надіслати скаргу'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
