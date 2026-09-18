import React, { useState } from 'react';
import { Users, X, Check, Search, Sparkles, Beer, Wine, Dice5, Trophy, Laptop } from 'lucide-react';
import { BuddyProfile, ChatParticipant } from '../../types';
import { sounds } from '../../services/soundService';

interface CreateGroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  buddies: BuddyProfile[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onCreateGroup: (groupData: {
    name: string;
    topic: string;
    avatar: string;
    participants: ChatParticipant[];
  }) => void;
}

const PRESET_TOPICS = [
  { id: 'craft', label: 'Крафтове пиво', icon: Beer },
  { id: 'wine', label: 'Винний вечір', icon: Wine },
  { id: 'board_games', label: 'Настільні ігри', icon: Dice5 },
  { id: 'sports', label: 'Футбол / Спорт', icon: Trophy },
  { id: 'it', label: 'IT & Нетворкінг', icon: Laptop },
];

const PRESET_AVATARS = [
  {
    label: 'Бар & Келихи',
    url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Крафтова пивоварня',
    url: 'https://images.unsplash.com/photo-1538488881522-4321453a694c?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Коктейльний бар',
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Винний льох',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&auto=format&fit=crop&q=80',
  },
];

const NAME_SUGGESTIONS = [
  '🍻 Крафтовий двіж на Подолі',
  '🎲 Настілки & Сидр у дворі',
  '🍷 Винний вечір на Рейтарській',
  '💻 Пʼятничний IT-дегустатор',
  '⚽ Збірна пабу: Ліга Чемпіонів',
];

export const CreateGroupChatModal: React.FC<CreateGroupChatModalProps> = ({
  isOpen,
  onClose,
  buddies,
  currentUserId = 'me',
  currentUserName = 'Павло (Ви)',
  currentUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  onCreateGroup,
}) => {
  const [groupName, setGroupName] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('Крафтове пиво');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0].url);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuddyIds, setSelectedBuddyIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const filteredBuddies = buddies.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.tagline && b.tagline.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (b.locationName && b.locationName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleBuddySelection = (buddyId: string) => {
    sounds.playTap();
    setSelectedBuddyIds((prev) =>
      prev.includes(buddyId) ? prev.filter((id) => id !== buddyId) : [...prev, buddyId]
    );
  };

  const handleSelectSuggestion = (name: string) => {
    sounds.playTap();
    setGroupName(name);
  };

  const handleCreate = () => {
    if (!groupName.trim() || selectedBuddyIds.length === 0) return;

    sounds.playMatchCheer();

    // Compile participants list including creator
    const chosenBuddies = buddies.filter((b) => selectedBuddyIds.includes(b.id));
    const participants: ChatParticipant[] = [
      {
        id: currentUserId,
        name: currentUserName,
        avatar: currentUserAvatar,
        online: true,
        role: 'admin',
      },
      ...chosenBuddies.map((b) => ({
        id: b.id,
        name: b.name,
        avatar: b.avatar,
        online: b.online,
        role: 'member' as const,
      })),
    ];

    onCreateGroup({
      name: groupName.trim(),
      topic: selectedTopic,
      avatar: selectedAvatar,
      participants,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 leading-tight">
                Створити груповий чат
              </h3>
              <p className="text-[10px] text-neutral-400">
                Спільні плани, тости та координація столиків
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-create-group-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 no-scrollbar">
          {/* Group Name Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
              <span>Назва групи</span>
              <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              id="group-name-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Наприклад: 🍻 Крафтовий вечір у Squat 17b"
              maxLength={50}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
            />

            {/* Quick Name Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {NAME_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleSelectSuggestion(sug)}
                  className="px-2 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-400 hover:text-amber-300 transition flex items-center gap-1 text-left"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>{sug}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Topic Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-300">
              Тема або настрій чату
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TOPICS.map((topic) => {
                const Icon = topic.icon;
                const isSelected = selectedTopic === topic.label;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setSelectedTopic(topic.label);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-amber-400" />
                    <span>{topic.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group Avatar Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-300">
              Обкладинка групи
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AVATARS.map((item, idx) => {
                const isSelected = selectedAvatar === item.url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setSelectedAvatar(item.url);
                    }}
                    className={`relative rounded-xl overflow-hidden aspect-video border-2 transition ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/40'
                        : 'border-neutral-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member Selection */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                <span>Виберіть учасників</span>
                <span className="text-amber-400">*</span>
              </label>
              <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                Обрано: {selectedBuddyIds.length}
              </span>
            </div>

            {/* Search Buddies */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук людей за ім'ям чи локацією..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            {/* Buddies list with checkboxes */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-neutral-800/80 rounded-2xl p-2 bg-neutral-950/60 no-scrollbar">
              {filteredBuddies.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-500">
                  Нікого не знайдено за запитом
                </div>
              ) : (
                filteredBuddies.map((buddy) => {
                  const isSelected = selectedBuddyIds.includes(buddy.id);
                  return (
                    <button
                      key={buddy.id}
                      type="button"
                      onClick={() => toggleBuddySelection(buddy.id)}
                      className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition ${
                        isSelected
                          ? 'bg-amber-500/15 border border-amber-500/30'
                          : 'bg-neutral-900/80 hover:bg-neutral-800/80 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={buddy.avatar}
                            alt={buddy.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                            referrerPolicy="no-referrer"
                          />
                          {buddy.online && (
                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                            <span>{buddy.name}</span>
                            <span className="text-[10px] text-neutral-400 font-normal">
                              ({buddy.distanceKm} км)
                            </span>
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate">
                            {buddy.tagline || buddy.locationName}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition shrink-0 ${
                          isSelected
                            ? 'bg-amber-400 border-amber-400 text-neutral-950'
                            : 'border-neutral-700 bg-neutral-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-neutral-800 shrink-0 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition"
          >
            Скасувати
          </button>
          <button
            type="button"
            id="submit-create-group-btn"
            disabled={!groupName.trim() || selectedBuddyIds.length === 0}
            onClick={handleCreate}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Створити чат ({selectedBuddyIds.length + 1})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
