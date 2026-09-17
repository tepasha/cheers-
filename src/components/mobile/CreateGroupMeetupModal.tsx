import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus, 
  Check, 
  Beer, 
  Wine, 
  Dices, 
  Laptop, 
  Coffee 
} from 'lucide-react';
import { BuddyProfile, GroupMeetup } from '../../types';
import { groupMeetupService } from '../../services/groupMeetupService';
import { sounds } from '../../services/soundService';

interface CreateGroupMeetupModalProps {
  buddies: BuddyProfile[];
  onClose: () => void;
  onCreated: (meetup: GroupMeetup) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  defaultVenue?: string;
  defaultAddress?: string;
}

const BAR_PRESETS = [
  { bar: 'Squat 17b', area: 'Поділ, вул. Терещенківська, 17б', lat: 50.4415, lng: 30.514 },
  { bar: 'Win Bar', area: 'Поділ, вул. Хорива, 16/7', lat: 50.467, lng: 30.5145 },
  { bar: 'Punkcraft', area: 'Поділ, вул. Ігорівська, 14', lat: 50.4608, lng: 30.5218 },
  { bar: 'Varvar Bar', area: 'Поділ, вул. Верхній Вал, 22', lat: 50.4665, lng: 30.512 },
  { bar: 'Loggerhead', area: 'Шевченківський, б-р Шевченка, 1', lat: 50.4428, lng: 30.5165 },
  { bar: 'Pure & Naive', area: 'Золоті Ворота, вул. Франка, 25/40', lat: 50.449, lng: 30.51 },
  { bar: 'This is Пивбар', area: 'Печерськ, вул. Басейна, 15', lat: 50.4385, lng: 30.5195 },
];

const QUICK_TOPICS = [
  { label: '🎲 Настілки & Келих', icon: <Dices className="w-3.5 h-3.5" />, tag: 'Настілки' },
  { label: '💻 IT & Код за пивом', icon: <Laptop className="w-3.5 h-3.5" />, tag: 'IT & Код' },
  { label: '🍺 Крафтовий вечір (IPA)', icon: <Beer className="w-3.5 h-3.5" />, tag: 'Крафт' },
  { label: '🍷 Винний вечір & бесіди', icon: <Wine className="w-3.5 h-3.5" />, tag: 'Вино' },
  { label: '💬 Розмови за життя', icon: <Coffee className="w-3.5 h-3.5" />, tag: 'Релакс' },
];

const QUICK_DATES = [
  'Сьогодні',
  'Завтра',
  "Ця п'ятниця",
  'Ця субота',
  'Ця неділя',
];

const QUICK_TIMES = [
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
];

export const CreateGroupMeetupModal: React.FC<CreateGroupMeetupModalProps> = ({
  buddies,
  onClose,
  onCreated,
  currentUserId = 'me',
  currentUserName = 'Павло (Ви)',
  currentUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  defaultVenue,
  defaultAddress,
}) => {
  const [title, setTitle] = useState('🎲 Крафтовий вечір & настільні ігри');
  const [description, setDescription] = useState(
    'Збираємо теплу компанію поспілкуватися та пограти у Catan / Кодові імена. Замовляємо сидр та крафтове пиво!'
  );
  const [venueName, setVenueName] = useState(defaultVenue || 'Squat 17b');
  const [venueAddress, setVenueAddress] = useState(defaultAddress || 'Поділ, вул. Терещенківська, 17б');
  const [selectedPresetLat, setSelectedPresetLat] = useState<number | undefined>(50.4415);
  const [selectedPresetLng, setSelectedPresetLng] = useState<number | undefined>(30.514);

  const [scheduledDate, setScheduledDate] = useState('Сьогодні');
  const [scheduledTime, setScheduledTime] = useState('19:30');
  const [drinkPreference, setDrinkPreference] = useState('Крафтове пиво & Сидр');
  const [topicTag, setTopicTag] = useState('Настілки');
  const [maxParticipants, setMaxParticipants] = useState<number>(6);

  // Selected buddies to invite right away
  const [selectedBuddyIds, setSelectedBuddyIds] = useState<string[]>([]);

  const handleSelectBarPreset = (preset: (typeof BAR_PRESETS)[0]) => {
    sounds.playTap();
    setVenueName(preset.bar);
    setVenueAddress(preset.area);
    setSelectedPresetLat(preset.lat);
    setSelectedPresetLng(preset.lng);
  };

  const toggleBuddy = (buddyId: string) => {
    sounds.playTap();
    setSelectedBuddyIds((prev) =>
      prev.includes(buddyId) ? prev.filter((id) => id !== buddyId) : [...prev, buddyId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !venueName.trim() || !scheduledDate.trim() || !scheduledTime.trim()) {
      return;
    }

    const invitedBuddies = buddies.filter((b) => selectedBuddyIds.includes(b.id));

    const newMeetup = groupMeetupService.createMeetup({
      title: title.trim(),
      description: description.trim() || `Групова зустріч у ${venueName}`,
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim() || 'Київ',
      scheduledDate: scheduledDate.trim(),
      scheduledTime: scheduledTime.trim(),
      drinkPreference: drinkPreference.trim(),
      maxParticipants,
      creatorId: currentUserId,
      creatorName: currentUserName,
      creatorAvatar: currentUserAvatar,
      lat: selectedPresetLat,
      lng: selectedPresetLng,
      topicTag,
      invitedBuddies,
    });

    onCreated(newMeetup);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-neutral-950 font-bold flex items-center justify-center shadow-md shadow-amber-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Запланувати групову зустріч</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  +75 XP
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">Створіть подію з місцем, часом та запросіть людей</p>
            </div>
          </div>

          <button
            type="button"
            id="close-create-meetup-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* Quick Topic Chips */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              Швидкий шаблон теми:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TOPICS.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  id={`topic-chip-${item.tag}`}
                  onClick={() => {
                    sounds.playTap();
                    setTitle(item.label);
                    setTopicTag(item.tag);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                    topicTag === item.tag
                      ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Назва / Тема зустрічі <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              id="meetup-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Наприклад: 🎲 Настілки та сидр у дворику Squat 17b"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Place & Venue Selection */}
          <div className="space-y-2 p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Місце зустрічі (Заклад)</span>
              </label>
            </div>

            {/* Popular Bar Preset Chips */}
            <div className="flex flex-wrap gap-1">
              {BAR_PRESETS.map((p) => (
                <button
                  key={p.bar}
                  type="button"
                  id={`preset-bar-${p.bar}`}
                  onClick={() => handleSelectBarPreset(p)}
                  className={`text-[11px] px-2 py-1 rounded-lg border transition ${
                    venueName === p.bar
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                  }`}
                >
                  {p.bar}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">Назва закладу:</span>
                <input
                  type="text"
                  id="meetup-venue-name-input"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Squat 17b"
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">Адреса / Район:</span>
                <input
                  type="text"
                  id="meetup-venue-address-input"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Поділ, вул. Терещенківська, 17б"
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Date & Time Selection */}
          <div className="space-y-2 p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Дата та час зустрічі</span>
              </label>
            </div>

            {/* Quick Dates */}
            <div>
              <span className="text-[10px] text-neutral-400 block mb-1">День:</span>
              <div className="flex flex-wrap gap-1">
                {QUICK_DATES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    id={`quick-date-${d}`}
                    onClick={() => {
                      sounds.playTap();
                      setScheduledDate(d);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                      scheduledDate === d
                        ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Times */}
            <div className="pt-1">
              <span className="text-[10px] text-neutral-400 block mb-1">Час початку:</span>
              <div className="flex flex-wrap gap-1">
                {QUICK_TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    id={`quick-time-${t}`}
                    onClick={() => {
                      sounds.playTap();
                      setScheduledTime(t);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                      scheduledTime === t
                        ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <input
                type="text"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                placeholder="Сьогодні / П'ятниця"
                className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                placeholder="19:30"
                className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Drinks & Max Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Формат напоїв:
              </label>
              <input
                type="text"
                id="meetup-drink-pref-input"
                value={drinkPreference}
                onChange={(e) => setDrinkPreference(e.target.value)}
                placeholder="Крафтове пиво, вино, коктейлі"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Максимум учасників:
                </label>
                <span className="text-xs font-bold text-amber-400">{maxParticipants} осіб</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[4, 5, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    id={`capacity-btn-${num}`}
                    onClick={() => {
                      sounds.playTap();
                      setMaxParticipants(num);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      maxParticipants === num
                        ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description / Plans */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Опис / План зустрічі:
            </label>
            <textarea
              id="meetup-description-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Про що поспілкуємося, що будемо пити..."
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* ADD PEOPLE DIRECTLY: Invite Buddies & Friends */}
          <div className="space-y-2 p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Додати людей одразу (+20 XP за кожного)</span>
              </label>
              {selectedBuddyIds.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  Обрано: {selectedBuddyIds.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400">
              Позначте друзів або супутників, яким надіслати запрошення у сповіщеннях:
            </p>

            <div className="max-h-40 overflow-y-auto space-y-1.5 no-scrollbar pt-1">
              {buddies.slice(0, 8).map((buddy) => {
                const isSelected = selectedBuddyIds.includes(buddy.id);
                return (
                  <div
                    key={buddy.id}
                    id={`create-modal-buddy-toggle-${buddy.id}`}
                    onClick={() => toggleBuddy(buddy.id)}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50'
                        : 'bg-neutral-900/90 hover:bg-neutral-800/80 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={buddy.avatar}
                        alt={buddy.name}
                        className="w-7 h-7 rounded-lg object-cover shrink-0 border border-neutral-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-neutral-200 block truncate">
                          {buddy.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 block truncate">
                          {buddy.tagline || buddy.locationName}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-neutral-950 font-bold'
                          : 'border-neutral-700 bg-neutral-950'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              id="cancel-create-meetup-btn"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
            >
              Скасувати
            </button>

            <button
              type="submit"
              id="submit-create-group-meetup-btn"
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Запланувати (+75 XP)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
