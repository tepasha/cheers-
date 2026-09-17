import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, UserCheck, ShieldCheck, UserX, FileText } from 'lucide-react';
import { BlockedUserRecord, UserReport } from '../../types';
import { safetyModerationService } from '../../services/safetyModerationService';
import { sounds } from '../../services/soundService';

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlockedUsersModal: React.FC<BlockedUsersModalProps> = ({ isOpen, onClose }) => {
  const [activeSubTab, setActiveSubTab] = useState<'blocked' | 'reports'>('blocked');
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>(() =>
    safetyModerationService.getBlockedUsers()
  );
  const [reports, setReports] = useState<UserReport[]>(() => safetyModerationService.getReports());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = safetyModerationService.subscribe(() => {
      setBlockedUsers(safetyModerationService.getBlockedUsers());
      setReports(safetyModerationService.getReports());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleUnblock = (userId: string, name: string) => {
    safetyModerationService.unblockUser(userId);
    sounds.playTap();
    setToastMsg(`Користувача ${name} розблоковано.`);
    setTimeout(() => setToastMsg(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 leading-tight">
                Безпека та модерація
              </h3>
              <p className="text-[10px] text-neutral-400">
                Захист від спаму, шахрайства та токсичності
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

        {/* Protection status pill */}
        <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-[11px] text-emerald-300/90 leading-tight">
            <strong>Анти-абуз захист активний:</strong> підозрілі акаунти та порушники 18+ блокуються автоматично.
          </div>
        </div>

        {toastMsg && (
          <div className="p-2 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold text-center animate-in fade-in">
            {toastMsg}
          </div>
        )}

        {/* Subtabs */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-950 border border-neutral-800">
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveSubTab('blocked');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeSubTab === 'blocked'
                ? 'bg-neutral-800 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserX className="w-3.5 h-3.5 text-red-400" />
            <span>Заблоковані ({blockedUsers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveSubTab('reports');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeSubTab === 'reports'
                ? 'bg-neutral-800 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Скарги ({reports.length})</span>
          </button>
        </div>

        {/* Content */}
        {activeSubTab === 'blocked' ? (
          <div className="space-y-2">
            {blockedUsers.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 space-y-2">
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-xs">У вас немає заблокованих акаунтів.</p>
                <p className="text-[10px] text-neutral-500">
                  Ви можете блокувати підозрілих людей у профілі або під час чату.
                </p>
              </div>
            ) : (
              blockedUsers.map((user) => (
                <div
                  key={user.userId}
                  className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800/90 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={
                        user.userAvatar ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'
                      }
                      alt={user.userName}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-neutral-700"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-200 truncate flex items-center gap-1.5">
                        <span>{user.userName}</span>
                        {user.autoBlocked && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                            Авто-бан
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {user.reason || 'Заблоковано'} • {user.blockedAt}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnblock(user.userId, user.userName)}
                    className="py-1 px-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold shrink-0 transition"
                  >
                    Розблокувати
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {reports.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 space-y-2">
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-xs">Ви ще не надсилали скарг.</p>
                <p className="text-[10px] text-neutral-500">
                  Повідомляйте про порушення, щоб підтримувати дружню та безпечну атмосферу.
                </p>
              </div>
            ) : (
              reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800/90 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-200 truncate">
                      {rep.targetName}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                      {rep.status === 'pending' ? 'На розгляді' : 'Опрацьовано'}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-300 flex items-center gap-1.5">
                    <span className="text-red-400 font-semibold">{rep.categoryTitle}</span>
                  </div>

                  {rep.comment && (
                    <p className="text-[10px] text-neutral-400 italic bg-neutral-900/60 p-1.5 rounded-lg">
                      «{rep.comment}»
                    </p>
                  )}

                  <div className="text-[9px] text-neutral-500 pt-0.5">
                    Подано о {rep.timestamp}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-2 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
