import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  UserPlus,
  Plus,
  Check,
  CalendarPlus,
  Search,
  CheckCircle2,
  Crown,
  MessageSquare,
  Navigation,
} from 'lucide-react';
import { BuddyProfile, GroupMeetup } from '../../types';
import { groupMeetupService } from '../../services/groupMeetupService';
import { sounds } from '../../services/soundService';
import { InvitePeopleModal } from './InvitePeopleModal';
import { CreateGroupMeetupModal } from './CreateGroupMeetupModal';

interface ScheduledMeetupsSectionProps {
  buddies: BuddyProfile[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onOpenBuddyChat?: (buddyName: string) => void;
  onNavigateToMap?: (venueName: string, lat?: number, lng?: number) => void;
  onRequestCreate?: () => void;
}

export const ScheduledMeetupsSection: React.FC<ScheduledMeetupsSectionProps> = ({
  buddies,
  currentUserId = 'me',
  currentUserName = 'Павло (Ви)',
  currentUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  onOpenBuddyChat,
  onNavigateToMap,
}) => {
  const [meetups, setMeetups] = useState<GroupMeetup[]>(() => groupMeetupService.getMeetups());
  const [activeFilter, setActiveFilter] = useState<'all' | 'going' | 'my' | 'weekend'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeetupForInvite, setSelectedMeetupForInvite] = useState<GroupMeetup | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = groupMeetupService.subscribe((updated) => {
      setMeetups(updated);
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleJoin = (meetup: GroupMeetup) => {
    const isGoing = meetup.participants.some(
      (p) => p.userId === currentUserId && p.status === 'going'
    );

    if (isGoing) {
      groupMeetupService.leaveMeetup(meetup.id, currentUserId);
      showToast(`Ви відмовилися від участі у «${meetup.title}»`);
    } else {
      const success = groupMeetupService.joinMeetup(meetup.id, {
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
      });
      if (success) {
        showToast(`🎉 Ви приєдналися до «${meetup.title}»! (+35 XP) 🍻`);
      } else {
        showToast('На жаль, всі вільні місця на цю зустріч вже зайняті.');
      }
    }
  };

  const handleDownloadCalendar = (meetup: GroupMeetup) => {
    groupMeetupService.downloadCalendarEvent(meetup);
    showToast(`📅 Подію «${meetup.title}» додано до календаря (.ics)`);
  };

  // Filter meetups
  const filteredMeetups = meetups.filter((m) => {
    if (m.status === 'cancelled') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchVenue = m.venueName.toLowerCase().includes(q);
      const matchArea = m.venueAddress.toLowerCase().includes(q);
      const matchTopic = (m.topicTag || '').toLowerCase().includes(q);
      if (!matchTitle && !matchVenue && !matchArea && !matchTopic) {
        return false;
      }
    }

    if (activeFilter === 'going') {
      return m.participants.some((p) => p.userId === currentUserId && p.status === 'going');
    }
    if (activeFilter === 'my') {
      return m.creatorId === currentUserId;
    }
    if (activeFilter === 'weekend') {
      const d = m.scheduledDate.toLowerCase();
      return d.includes('п\'ятниця') || d.includes('субота') || d.includes('неділя');
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-4 right-4 z-50 bg-amber-500 text-neutral-950 text-xs font-bold px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-amber-400 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-neutral-950" />
          <span className="flex-1 truncate">{toastMessage}</span>
        </div>
      )}

      {/* Action Header Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-neutral-900 to-neutral-900 border border-amber-500/30 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>Заплановані групові зустрічі</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                {meetups.length}
              </span>
            </h3>
            <p className="text-[10px] text-neutral-400 truncate">
              Обирайте заклад, фіксуйте час та додавайте друзів
            </p>
          </div>
        </div>

        <button
          type="button"
          id="open-create-group-meetup-btn"
          onClick={() => {
            sounds.playTap();
            setShowCreateModal(true);
          }}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Створити</span>
        </button>
      </div>

      {/* Search & Filter bar */}
      <div className="space-y-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            id="meetups-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук зустрічей, закладів (Squat 17b, Win Bar, настілки)..."
            className="w-full pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            id="filter-meetups-all"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('all');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeFilter === 'all'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Усі ({meetups.length})
          </button>

          <button
            type="button"
            id="filter-meetups-going"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('going');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
              activeFilter === 'going'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <span>Я йду 🍻</span>
          </button>

          <button
            type="button"
            id="filter-meetups-weekend"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('weekend');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
              activeFilter === 'weekend'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <span>На вихідних 🗓️</span>
          </button>

          <button
            type="button"
            id="filter-meetups-my"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('my');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
              activeFilter === 'my'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Crown className="w-3 h-3" />
            <span>Мої створені</span>
          </button>
        </div>
      </div>

      {/* Meetups List */}
      <div className="space-y-3">
        {filteredMeetups.length === 0 ? (
          <div className="p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 text-center space-y-3">
            <Calendar className="w-10 h-10 mx-auto text-neutral-600" />
            <div>
              <p className="text-sm font-bold text-neutral-300">Не знайдено зустрічей</p>
              <p className="text-xs text-neutral-500 mt-1">
                Змініть фільтр або заплануйте нову групову подію самостійно!
              </p>
            </div>
            <button
              type="button"
              id="empty-create-meetup-btn"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs shadow-md"
            >
              + Запланувати зустріч
            </button>
          </div>
        ) : (
          filteredMeetups.map((meetup) => {
            const isUserGoing = meetup.participants.some(
              (p) => p.userId === currentUserId && p.status === 'going'
            );
            const isUserInvited = meetup.participants.some(
              (p) => p.userId === currentUserId && p.status === 'invited'
            );
            const isUserCreator = meetup.creatorId === currentUserId;
            const goingCount = meetup.participants.filter((p) => p.status === 'going').length;
            const remainingSlots = Math.max(0, meetup.maxParticipants - goingCount);

            return (
              <div
                key={meetup.id}
                id={`meetup-card-${meetup.id}`}
                className="p-3.5 rounded-3xl bg-neutral-900/90 border border-neutral-800/90 hover:border-amber-500/40 transition-all shadow-md space-y-3"
              >
                {/* Header: Venue, Date & Time badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{meetup.venueName}</span>
                      </span>

                      {meetup.topicTag && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 font-medium">
                          {meetup.topicTag}
                        </span>
                      )}

                      {isUserCreator && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" />
                          Ви організатор
                        </span>
                      )}

                      {isUserInvited && !isUserGoing && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 flex items-center gap-0.5">
                          ✉️ Вас запрошено
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-neutral-400 truncate">
                      {meetup.venueAddress}
                    </p>
                  </div>

                  {/* Date & Time pill */}
                  <div className="px-2.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-right shrink-0">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      <span>{meetup.scheduledDate}</span>
                    </div>
                    <div className="text-[10px] font-semibold text-neutral-300 flex items-center gap-1 justify-end">
                      <Clock className="w-2.5 h-2.5 text-amber-400" />
                      <span>{meetup.scheduledTime}</span>
                    </div>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                    {meetup.title}
                  </h4>
                  <p className="text-xs text-neutral-300 font-normal mt-1 leading-relaxed">
                    {meetup.description}
                  </p>
                </div>

                {/* Drink Preference tag */}
                {meetup.drinkPreference && (
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                    <span className="text-neutral-500">Формат:</span>
                    <span className="text-amber-400/90 font-medium">
                      {meetup.drinkPreference}
                    </span>
                  </div>
                )}

                {/* PARTICIPANTS & ADD PEOPLE SECTION */}
                <div className="p-2.5 rounded-2xl bg-neutral-950/80 border border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Учасники: <strong className="text-white">{goingCount}</strong> з {meetup.maxParticipants}
                      </span>
                    </span>

                    <span className="text-[10px] text-amber-400/90 font-medium">
                      {remainingSlots > 0 ? `Вільних місць: ${remainingSlots}` : 'Місць немає'}
                    </span>
                  </div>

                  {/* Avatars & Add Button Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center -space-x-2 overflow-hidden py-1">
                      {meetup.participants.map((p, idx) => {
                        const isHost = p.role === 'host';
                        const isGoing = p.status === 'going';
                        return (
                          <div
                            key={`${p.userId}-${idx}`}
                            className="relative group shrink-0"
                            title={`${p.userName} (${isHost ? 'Організатор' : isGoing ? 'Йде' : 'Запрошено'})`}
                          >
                            <img
                              src={p.userAvatar}
                              alt={p.userName}
                              className={`w-8 h-8 rounded-full object-cover border-2 ${
                                isHost
                                  ? 'border-amber-400 ring-1 ring-amber-400/50'
                                  : isGoing
                                  ? 'border-emerald-500'
                                  : 'border-neutral-700 opacity-75'
                              }`}
                              referrerPolicy="no-referrer"
                            />
                            {isHost && (
                              <span className="absolute -top-1 -right-0.5 text-[9px] bg-amber-500 text-neutral-950 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                👑
                              </span>
                            )}
                            {isGoing && !isHost && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border border-neutral-900 flex items-center justify-center text-[7px] text-neutral-950 font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Prominent "+ Додати людей" button right on the participant row */}
                    <button
                      type="button"
                      id={`invite-people-row-btn-${meetup.id}`}
                      onClick={() => {
                        sounds.playTap();
                        setSelectedMeetupForInvite(meetup);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Додати людей</span>
                    </button>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-1 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {/* RSVP: Join / Leave */}
                    <button
                      type="button"
                      id={`rsvp-btn-${meetup.id}`}
                      onClick={() => handleToggleJoin(meetup)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                        isUserGoing
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : remainingSlots > 0
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 shadow-md shadow-amber-500/20'
                          : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                      }`}
                    >
                      {isUserGoing ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Я йду ✓</span>
                        </>
                      ) : (
                        <span>Я піду! 🍻</span>
                      )}
                    </button>

                    {/* Add to Calendar */}
                    <button
                      type="button"
                      id={`calendar-btn-${meetup.id}`}
                      onClick={() => handleDownloadCalendar(meetup)}
                      className="p-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-medium flex items-center gap-1 transition"
                      title="Додати зустріч у календар (.ics)"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Календар</span>
                    </button>

                    {/* View on Map */}
                    {onNavigateToMap && (
                      <button
                        type="button"
                        id={`map-btn-${meetup.id}`}
                        onClick={() => onNavigateToMap(meetup.venueName, meetup.lat, meetup.lng)}
                        className="p-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-medium flex items-center gap-1 transition"
                        title="Показати заклад на мапі"
                      >
                        <Navigation className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Мапа</span>
                      </button>
                    )}
                  </div>

                  {/* Organizer / Contact Chat */}
                  {onOpenBuddyChat && (
                    <button
                      type="button"
                      id={`chat-meetup-btn-${meetup.id}`}
                      onClick={() => onOpenBuddyChat(meetup.creatorName)}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-medium flex items-center gap-1 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isUserCreator ? 'Чат' : `Чат з ${meetup.creatorName}`}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Invite People Modal */}
      {selectedMeetupForInvite && (
        <InvitePeopleModal
          meetup={selectedMeetupForInvite}
          buddies={buddies}
          onClose={() => setSelectedMeetupForInvite(null)}
          onSuccess={(count) => {
            showToast(`👥 Успішно надіслано запрошення ${count} друзям до зустрічі!`);
          }}
        />
      )}

      {/* Create Group Meetup Modal */}
      {showCreateModal && (
        <CreateGroupMeetupModal
          buddies={buddies}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newMeetup) => {
            showToast(`🎉 Зустріч «${newMeetup.title}» успішно створена! (+75 XP)`);
          }}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
        />
      )}
    </div>
  );
};
