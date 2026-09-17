import React, { useState, useMemo } from 'react';
import { X, Search, Check, UserPlus, Users, Sparkles, Beer } from 'lucide-react';
import { BuddyProfile, GroupMeetup } from '../../types';
import { groupMeetupService } from '../../services/groupMeetupService';
import { sounds } from '../../services/soundService';

interface InvitePeopleModalProps {
  meetup: GroupMeetup;
  buddies: BuddyProfile[];
  onClose: () => void;
  onSuccess?: (addedCount: number) => void;
}

export const InvitePeopleModal: React.FC<InvitePeopleModalProps> = ({
  meetup,
  buddies,
  onClose,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set of already participating or invited user IDs
  const existingParticipantIds = useMemo(() => {
    return new Set(meetup.participants.map((p) => p.userId));
  }, [meetup.participants]);

  // Filter buddies that are not yet participants
  const availableBuddies = useMemo(() => {
    return buddies.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.tagline && b.tagline.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.preferredDrinks && b.preferredDrinks.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesSearch;
    });
  }, [buddies, searchQuery]);

  const toggleSelect = (buddyId: string) => {
    if (existingParticipantIds.has(buddyId)) return;
    sounds.playTap();
    setSelectedIds((prev) =>
      prev.includes(buddyId) ? prev.filter((id) => id !== buddyId) : [...prev, buddyId]
    );
  };

  const handleInvite = () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);

    const buddiesToInvite = buddies.filter((b) => selectedIds.includes(b.id));
    const res = groupMeetupService.inviteBuddies(meetup.id, buddiesToInvite, 'Ви');

    setTimeout(() => {
      setIsSubmitting(false);
      if (onSuccess) {
        onSuccess(res.count);
      }
      onClose();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Додати людей до зустрічі</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  +20 XP
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 truncate max-w-[240px] sm:max-w-xs">
                «{meetup.title}» у {meetup.venueName}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-invite-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-neutral-800/80 bg-neutral-950/60">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              id="invite-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук друзів за ім'ям або інтересами..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 transition"
            />
          </div>
        </div>

        {/* Buddies List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {availableBuddies.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 space-y-2">
              <Users className="w-8 h-8 mx-auto text-neutral-600" />
              <p className="text-xs">Нікого не знайдено за запитом «{searchQuery}»</p>
            </div>
          ) : (
            availableBuddies.map((buddy) => {
              const isAlreadyParticipant = existingParticipantIds.has(buddy.id);
              const isSelected = selectedIds.includes(buddy.id);

              return (
                <div
                  key={buddy.id}
                  id={`buddy-invite-item-${buddy.id}`}
                  onClick={() => toggleSelect(buddy.id)}
                  className={`p-2.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                    isAlreadyParticipant
                      ? 'bg-neutral-950/60 border-neutral-800/60 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                      : 'bg-neutral-950/80 hover:bg-neutral-800/60 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={buddy.avatar}
                        alt={buddy.name}
                        className="w-10 h-10 rounded-xl object-cover border border-neutral-700"
                        referrerPolicy="no-referrer"
                      />
                      {buddy.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-neutral-900" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-neutral-200 truncate">
                          {buddy.name}, {buddy.age}
                        </span>
                        {isAlreadyParticipant && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-neutral-800 text-neutral-400 font-semibold border border-neutral-700">
                            Вже у списку
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {buddy.tagline || buddy.locationName}
                      </p>
                      {buddy.preferredDrinks && buddy.preferredDrinks.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-amber-400/80">
                          <Beer className="w-2.5 h-2.5" />
                          <span className="truncate">{buddy.preferredDrinks.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selection Checkbox */}
                  <div className="shrink-0">
                    {isAlreadyParticipant ? (
                      <div className="w-6 h-6 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition ${
                          isSelected
                            ? 'bg-amber-500 border-amber-400 text-neutral-950 font-bold'
                            : 'border-neutral-700 bg-neutral-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-400">
            {selectedIds.length > 0 ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Обрано: {selectedIds.length} {selectedIds.length === 1 ? 'особу' : 'осіб'} (+{selectedIds.length * 20} XP)
              </span>
            ) : (
              <span>Оберіть людей для надсилання запрошення</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="cancel-invite-btn"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
            >
              Скасувати
            </button>

            <button
              type="button"
              id="submit-invite-btn"
              disabled={selectedIds.length === 0 || isSubmitting}
              onClick={handleInvite}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg ${
                selectedIds.length > 0 && !isSubmitting
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 shadow-amber-500/20 active:scale-95'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>
                {isSubmitting ? 'Надсилаємо...' : `Запросити (${selectedIds.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
