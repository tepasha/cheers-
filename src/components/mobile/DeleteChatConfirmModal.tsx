import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { sounds } from '../../services/soundService';

interface DeleteChatConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  chatTitle: string;
  isGroup?: boolean;
}

export const DeleteChatConfirmModal: React.FC<DeleteChatConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  chatTitle,
  isGroup = false,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    sounds.playTap();
    onConfirmDelete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 leading-tight">
                {isGroup ? 'Видалити груповий чат?' : 'Видалити діалог?'}
              </h3>
              <p className="text-[10px] text-neutral-400">
                Цю дію неможливо скасувати
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-delete-modal-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 py-1">
          <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300 leading-relaxed">
              Ви збираєтеся видалити {isGroup ? 'груповий чат' : 'чат з користувачем'}{' '}
              <strong className="text-white font-semibold">«{chatTitle}»</strong>.
              <span className="block mt-1 text-neutral-400 text-[11px]">
                Всі надіслані повідомлення, тости та запрошення будуть безповоротно стерті з вашого списку.
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            id="cancel-delete-chat-btn"
            onClick={onClose}
            className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition"
          >
            Скасувати
          </button>
          <button
            type="button"
            id="confirm-delete-chat-btn"
            onClick={handleConfirm}
            className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-red-900/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Видалити</span>
          </button>
        </div>
      </div>
    </div>
  );
};
