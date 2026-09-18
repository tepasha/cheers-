import React, { useState } from 'react';
import { Users, X, UserPlus, Trash2, Crown } from 'lucide-react';
import { ChatThread, BuddyProfile, ChatParticipant } from '../../types';
import { sounds } from '../../services/soundService';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatThread;
  buddies: BuddyProfile[];
  onAddParticipants: (newParticipants: ChatParticipant[]) => void;
  onDeleteGroup: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen,
  onClose,
  chat,
  buddies,
  onAddParticipants,
  onDeleteGroup,
}) => {
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);

  if (!isOpen) return null;

  const currentParticipants = chat.participants || [];
  const existingIds = new Set(currentParticipants.map((p) => p.id));
  const availableBuddies = buddies.filter((b) => !existingIds.has(b.id));

  const toggleSelect = (buddyId: string) => {
    sounds.playTap();
    setSelectedToAdd((prev) =>
      prev.includes(buddyId) ? prev.filter((id) => id !== buddyId) : [...prev, buddyId]
    );
  };

  const handleConfirmAdd = () => {
    if (selectedToAdd.length === 0) return;
    sounds.playPop();

    const added: ChatParticipant[] = buddies
      .filter((b) => selectedToAdd.includes(b.id))
      .map((b) => ({
        id: b.id,
        name: b.name,
        avatar: b.avatar,
        online: b.online,
        role: 'member' as const,
      }));

    onAddParticipants(added);
    setSelectedToAdd([]);
    setShowAddMember(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Інформація про групу</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Group Banner & Title */}
        <div className="flex flex-col items-center text-center space-y-2 py-2">
          <div className="relative">
            <img
              src={chat.groupAvatar || chat.buddy.avatar}
              alt={chat.groupName || chat.buddy.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400/60 shadow-lg shadow-amber-500/10"
              referrerPolicy="no-referrer"
            />
            <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-extrabold text-[9px] shadow">
              ГРУПА
            </span>
          </div>
          <div>
            <h4 className="text-base font-bold text-white">{chat.groupName || chat.buddy.name}</h4>
            {chat.groupTopic && (
              <p className="text-xs text-amber-400/90 font-medium">{chat.groupTopic}</p>
            )}
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {currentParticipants.length} {currentParticipants.length === 1 ? 'учасник' : 'учасників'}
            </p>
          </div>
        </div>

        {/* Participants List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar border-t border-neutral-800/80 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300">
              Учасники ({currentParticipants.length})
            </span>
            {availableBuddies.length > 0 && !showAddMember && (
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setShowAddMember(true);
                }}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Додати</span>
              </button>
            )}
          </div>

          {/* Add member subpanel */}
          {showAddMember && (
            <div className="p-2.5 rounded-2xl bg-neutral-950 border border-amber-500/30 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                <span>Виберіть кого додати:</span>
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 no-scrollbar">
                {availableBuddies.map((buddy) => {
                  const isChecked = selectedToAdd.includes(buddy.id);
                  return (
                    <button
                      key={buddy.id}
                      type="button"
                      onClick={() => toggleSelect(buddy.id)}
                      className={`w-full p-1.5 rounded-xl flex items-center justify-between text-left transition ${
                        isChecked ? 'bg-amber-500/20' : 'bg-neutral-900 hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={buddy.avatar}
                          alt={buddy.name}
                          className="w-6 h-6 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-xs text-white">{buddy.name}</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                          isChecked ? 'bg-amber-400 border-amber-400 text-neutral-950 font-bold' : 'border-neutral-700'
                        }`}
                      >
                        {isChecked && '✓'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={selectedToAdd.length === 0}
                onClick={handleConfirmAdd}
                className="w-full py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 text-xs font-bold transition flex items-center justify-center gap-1"
              >
                <span>Додати до чату ({selectedToAdd.length})</span>
              </button>
            </div>
          )}

          {/* Existing participants list */}
          <div className="space-y-1.5">
            {currentParticipants.map((p, idx) => (
              <div
                key={`${p.id}-${idx}`}
                className="p-2 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                      referrerPolicy="no-referrer"
                    />
                    {p.online && (
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {p.role === 'admin' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" />
                          Організатор
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {p.online ? 'Зараз у мережі' : 'Був(ла) нещодавно'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Action: Delete or leave group */}
        <div className="pt-2 border-t border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              onDeleteGroup();
              onClose();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300 hover:text-red-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Видалити груповий чат</span>
          </button>
        </div>
      </div>
    </div>
  );
};
