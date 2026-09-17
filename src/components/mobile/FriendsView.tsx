import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  MapPin, 
  Beer, 
  MessageSquare, 
  UserMinus, 
  UserPlus, 
  Sparkles, 
  Check, 
  Flame, 
  X,
  Calendar,
} from 'lucide-react';
import { BuddyProfile } from '../../types';
import { DRINK_METADATA } from '../../data/mockData';
import { friendsService } from '../../services/friendsService';
import { groupMeetupService } from '../../services/groupMeetupService';
import { sounds } from '../../services/soundService';
import { formatDistance, UserGeoLocation } from '../../services/geoService';

interface FriendsViewProps {
  buddies: BuddyProfile[];
  onOpenChat: (buddy: BuddyProfile) => void;
  onNavigateToDiscover: () => void;
  onNavigateToMap: (buddy?: BuddyProfile) => void;
  userLocation?: UserGeoLocation;
}

type FriendsTabFilter = 'all' | 'in_bar' | 'online' | 'find_new';

export const FriendsView: React.FC<FriendsViewProps> = ({
  buddies,
  onOpenChat,
  onNavigateToDiscover,
  onNavigateToMap,
}) => {
  const [activeFilter, setActiveFilter] = useState<FriendsTabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInviteFriend, setSelectedInviteFriend] = useState<BuddyProfile | null>(null);
  const [inviteBar, setInviteBar] = useState('Squat 17b');
  const [inviteTime, setInviteTime] = useState('Сьогодні о 20:00');
  const [inviteType, setInviteType] = useState<'direct' | 'group'>('direct');
  const [selectedMeetupId, setSelectedMeetupId] = useState<string>('meetup-catan-squat17b');
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  const groupMeetups = useMemo(() => groupMeetupService.getMeetups(), [selectedInviteFriend]);

  // Subscribe to friends service
  const [friendIds, setFriendIds] = useState<string[]>(() => friendsService.getFriendIds());

  React.useEffect(() => {
    const unsub = friendsService.subscribe(() => {
      setFriendIds(friendsService.getFriendIds());
    });
    return unsub;
  }, []);

  const friendsList = useMemo(() => {
    return friendsService.getFriends(buddies);
  }, [buddies, friendIds]);

  const recommendedBuddies = useMemo(() => {
    return buddies.filter((b) => !friendIds.includes(b.id));
  }, [buddies, friendIds]);

  // Friends currently at a bar
  const friendsInBar = useMemo(() => {
    return friendsList.filter((f) => f.activeCheckIn !== undefined);
  }, [friendsList]);

  // Online friends
  const onlineFriends = useMemo(() => {
    return friendsList.filter((f) => f.online);
  }, [friendsList]);

  // Filtered friends based on tab and search
  const filteredFriends = useMemo(() => {
    let list = friendsList;

    if (activeFilter === 'in_bar') {
      list = friendsInBar;
    } else if (activeFilter === 'online') {
      list = onlineFriends;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) => 
        f.name.toLowerCase().includes(q) ||
        f.tagline.toLowerCase().includes(q) ||
        f.favoriteBars.some((bar) => bar.toLowerCase().includes(q)) ||
        f.talkTopics.some((topic) => topic.toLowerCase().includes(q))
      );
    }

    return list;
  }, [friendsList, activeFilter, searchQuery, friendsInBar, onlineFriends]);

  const handleToggleFriend = (buddy: BuddyProfile) => {
    const isNowFriend = friendsService.toggleFriend(buddy);
    if (isNowFriend) {
      setToastNotification(`🤝 ${buddy.name} додано до друзів (+50 XP)!`);
    } else {
      setToastNotification(`Видалили ${buddy.name} зі списку друзів.`);
    }
    setTimeout(() => setToastNotification(null), 3000);
  };

  const handleSendCheers = (friend: BuddyProfile) => {
    sounds.playClink();
    setToastNotification(`🥂 Відправлено віртуальний тост для ${friend.name}! «Будьмо!»`);
    setTimeout(() => setToastNotification(null), 3000);
  };

  const handleOpenInviteModal = (friend: BuddyProfile) => {
    setSelectedInviteFriend(friend);
    setInviteBar(friend.favoriteBars[0] || 'Squat 17b');
    sounds.playTap();
  };

  const handleConfirmInvite = () => {
    if (!selectedInviteFriend) return;
    sounds.playClink();

    if (inviteType === 'group' && selectedMeetupId) {
      groupMeetupService.inviteBuddies(selectedMeetupId, [selectedInviteFriend], 'Ви');
      const targetMeetup = groupMeetups.find((m) => m.id === selectedMeetupId);
      setToastNotification(`👥 ${selectedInviteFriend.name} додано до зустрічі «${targetMeetup?.title || 'Групова зустріч'}»! (+20 XP)`);
    } else {
      setToastNotification(`🍻 Клич у «${inviteBar}» надіслано до ${selectedInviteFriend.name}!`);
    }

    const targetBuddy = selectedInviteFriend;
    setSelectedInviteFriend(null);
    setTimeout(() => {
      setToastNotification(null);
      onOpenChat(targetBuddy);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden select-none">
      {/* Toast Notification */}
      {toastNotification && (
        <div className="absolute top-14 left-4 right-4 z-50 bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <Sparkles className="w-4 h-4 shrink-0 text-neutral-950" />
          <span className="flex-1">{toastNotification}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-3.5 pb-2 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-neutral-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  Мої Друзі
                </h1>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.2 rounded-full">
                  {friendsList.length}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 font-medium">
                Спільні походи в бари, швидкі кличі та тости
              </p>
            </div>
          </div>

          <button
            type="button"
            id="friends-explore-btn"
            onClick={onNavigateToDiscover}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-400 border border-neutral-800 text-xs font-semibold transition"
            title="Знайти нових людей"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Знайти</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-2.5">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            id="friends-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук друга за ім'ям, баром чи темою..."
            className="w-full bg-neutral-900/90 border border-neutral-800 text-neutral-100 text-xs rounded-xl pl-9 pr-8 py-2 placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            id="filter-friends-all"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('all');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition ${
              activeFilter === 'all'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Всі ({friendsList.length})
          </button>

          <button
            type="button"
            id="filter-friends-in-bar"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('in_bar');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition ${
              activeFilter === 'in_bar'
                ? 'bg-rose-500 text-white font-bold shadow'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Beer className="w-3.5 h-3.5 text-amber-400" />
            <span>Зараз у барі</span>
            {friendsInBar.length > 0 && (
              <span className="bg-rose-600 text-white text-[9px] font-black rounded-full px-1.5 py-0.2">
                {friendsInBar.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="filter-friends-online"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('online');
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition ${
              activeFilter === 'online'
                ? 'bg-emerald-500 text-neutral-950 font-bold shadow'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Онлайн ({onlineFriends.length})</span>
          </button>

          <button
            type="button"
            id="filter-friends-find-new"
            onClick={() => {
              sounds.playTap();
              setActiveFilter('find_new');
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition ${
              activeFilter === 'find_new'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Рекомендації ({recommendedBuddies.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content List */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 pb-8">
        {/* Spotlight: Friends Currently in Bars */}
        {activeFilter !== 'find_new' && friendsInBar.length > 0 && !searchQuery && (
          <div className="bg-gradient-to-b from-rose-950/40 to-neutral-900/90 rounded-3xl border border-rose-500/30 p-3.5 space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-extrabold text-xs">
                <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>Зараз у закладах (Live Check-ins)</span>
              </div>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
                Живий статус
              </span>
            </div>

            <div className="space-y-2">
              {friendsInBar.map((friend) => (
                <div
                  key={`in-bar-${friend.id}`}
                  className="bg-neutral-950/80 rounded-2xl border border-neutral-800 p-3 flex items-start gap-3"
                >
                  <div className="relative shrink-0">
                    <img
                      src={friend.avatar}
                      alt={friend.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-amber-500/40"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 shadow">
                      <Beer className="w-3 h-3" />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-100 truncate">
                        {friend.name}, {friend.age}
                      </span>
                      <span className="text-[10px] text-amber-400 font-medium shrink-0">
                        {formatDistance(friend.distanceKm)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-rose-300 font-semibold mt-0.5">
                      <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="truncate">{friend.activeCheckIn?.barName}</span>
                      <span className="text-neutral-500 text-[9px]">• {friend.activeCheckIn?.sinceTime || 'Зараз'}</span>
                    </div>

                    {friend.activeCheckIn?.note && (
                      <p className="text-[10px] text-neutral-300 italic mt-1 bg-neutral-900/60 p-1.5 rounded-lg border border-neutral-800/80">
                        «{friend.activeCheckIn.note}»
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-neutral-900">
                      <button
                        type="button"
                        id={`friends-join-bar-btn-${friend.id}`}
                        onClick={() => onOpenChat(friend)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1 transition shadow"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Підсісти / Написати</span>
                      </button>

                      <button
                        type="button"
                        id={`friends-cheers-btn-${friend.id}`}
                        onClick={() => handleSendCheers(friend)}
                        className="py-1.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1 border border-neutral-700 transition"
                        title="Цокнутися келихами"
                      >
                        <span>🥂 Тост</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Mode 1: Regular Friends List */}
        {activeFilter !== 'find_new' ? (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-neutral-300">
                {activeFilter === 'in_bar' ? 'Друзі в закладах' : activeFilter === 'online' ? 'Друзі онлайн' : 'Список усіх друзів'} ({filteredFriends.length})
              </span>
              <span className="text-[10px] text-neutral-400">
                {friendsList.length} збережено
              </span>
            </div>

            {filteredFriends.length === 0 ? (
              /* Empty Friends State */
              <div className="text-center p-6 bg-neutral-900/60 rounded-3xl border border-neutral-800 my-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-xl mx-auto">
                  🍻
                </div>
                <h3 className="text-sm font-bold text-neutral-200">
                  {searchQuery ? 'Нікого не знайдено за запитом' : 'У цьому списку поки що немає друзів'}
                </h3>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                  {searchQuery 
                    ? 'Спробуйте змінити пошуковий запит або переглянути всі контакти.'
                    : 'Додайте знайомих із вкладки «Пошук» або скористайтеся рекомендованою компанією нижче!'}
                </p>
                <button
                  type="button"
                  id="friends-empty-find-btn"
                  onClick={() => setActiveFilter('find_new')}
                  className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition"
                >
                  Знайти нових друзів по барах
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredFriends.map((friend) => {
                  return (
                    <div
                      key={`friend-card-${friend.id}`}
                      id={`friend-item-${friend.id}`}
                      className="bg-neutral-900/90 rounded-2xl border border-neutral-800 p-3 shadow-md hover:border-neutral-700 transition"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="w-13 h-13 rounded-2xl object-cover border border-neutral-700"
                          />
                          {friend.online && (
                            <span 
                              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-neutral-900 rounded-full"
                              title="Зараз онлайн"
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white truncate">
                                {friend.name}, {friend.age}
                              </h4>
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-md font-bold">
                                🍺 Рівень {friend.level || 2}
                              </span>
                            </div>

                            <button
                              type="button"
                              id={`remove-friend-btn-${friend.id}`}
                              onClick={() => handleToggleFriend(friend)}
                              className="text-neutral-400 hover:text-rose-400 p-1 rounded-lg hover:bg-neutral-800 transition"
                              title="Видалити з друзів"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">{friend.locationName}</span>
                            <span>• {formatDistance(friend.distanceKm)}</span>
                          </div>

                          <p className="text-[11px] text-neutral-300 mt-1 line-clamp-1">
                            {friend.tagline}
                          </p>

                          {/* Drink Chips */}
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {friend.preferredDrinks.slice(0, 3).map((d) => {
                              const meta = DRINK_METADATA[d];
                              if (!meta) return null;
                              return (
                                <span
                                  key={d}
                                  className="text-[9px] bg-neutral-950 px-1.5 py-0.5 rounded-md text-neutral-300 border border-neutral-800 flex items-center gap-1"
                                >
                                  <span>{meta.icon}</span>
                                  <span>{meta.label.split(' ')[0]}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-neutral-800/80">
                        <button
                          type="button"
                          id={`chat-friend-btn-${friend.id}`}
                          onClick={() => onOpenChat(friend)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          <span>Написати</span>
                        </button>

                        <button
                          type="button"
                          id={`invite-friend-btn-${friend.id}`}
                          onClick={() => handleOpenInviteModal(friend)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow"
                        >
                          <Beer className="w-3.5 h-3.5 text-neutral-950" />
                          <span>Клич у бар 🍻</span>
                        </button>

                        <button
                          type="button"
                          id={`quick-map-btn-${friend.id}`}
                          onClick={() => onNavigateToMap(friend)}
                          className="py-1.5 px-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-semibold transition"
                          title="Показати на мапі"
                        >
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        </button>

                        <button
                          type="button"
                          id={`quick-cheers-btn-${friend.id}`}
                          onClick={() => handleSendCheers(friend)}
                          className="py-1.5 px-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-neutral-800 text-xs font-semibold transition"
                          title="Тост"
                        >
                          🥂
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* View Mode 2 or Bottom Section: Recommendations (Find Friends) */}
        {(activeFilter === 'find_new' || friendsList.length < 3) && recommendedBuddies.length > 0 && (
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-extrabold text-neutral-200">
                  Рекомендована компанія поряд
                </span>
              </div>
              <span className="text-[10px] text-amber-400 font-semibold">
                +50 XP за додавання
              </span>
            </div>

            <div className="space-y-2">
              {recommendedBuddies.map((buddy) => {
                const isFriend = friendIds.includes(buddy.id);

                return (
                  <div
                    key={`rec-${buddy.id}`}
                    id={`rec-buddy-${buddy.id}`}
                    className="bg-neutral-900/70 rounded-2xl border border-neutral-800/80 p-3 flex items-center justify-between gap-3 hover:border-amber-500/30 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={buddy.avatar}
                        alt={buddy.name}
                        className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-neutral-700"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-100 truncate">
                            {buddy.name}, {buddy.age}
                          </span>
                          <span className="text-[9px] text-amber-400 shrink-0">
                            {formatDistance(buddy.distanceKm)}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {buddy.favoriteBars.join(', ')}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {buddy.preferredDrinks.slice(0, 2).map((d) => (
                            <span key={d} className="text-[9px] text-neutral-400">
                              {DRINK_METADATA[d]?.icon} {DRINK_METADATA[d]?.label.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      id={`rec-add-friend-btn-${buddy.id}`}
                      onClick={() => handleToggleFriend(buddy)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition ${
                        isFriend
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow'
                      }`}
                    >
                      {isFriend ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>У друзях</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Додати</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Hangout Invite Modal */}
      {selectedInviteFriend && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-amber-500/30 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-4 space-y-4 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Beer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Покликати в бар: {selectedInviteFriend.name}
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    Надіслати швидкий клич на келих
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInviteFriend(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center p-1 rounded-xl bg-neutral-950 border border-neutral-800">
              <button
                type="button"
                id="invite-type-direct-btn"
                onClick={() => {
                  sounds.playTap();
                  setInviteType('direct');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${
                  inviteType === 'direct'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Beer className="w-3.5 h-3.5" />
                <span>Особистий клич</span>
              </button>
              <button
                type="button"
                id="invite-type-group-btn"
                onClick={() => {
                  sounds.playTap();
                  setInviteType('group');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${
                  inviteType === 'group'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Групова зустріч 🗓️</span>
              </button>
            </div>

            {inviteType === 'group' ? (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                    Оберіть заплановану групову зустріч:
                  </label>
                  <select
                    value={selectedMeetupId}
                    onChange={(e) => setSelectedMeetupId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-500"
                  >
                    {groupMeetups.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.venueName} • {m.scheduledDate} {m.scheduledTime})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-amber-400/90 leading-relaxed bg-amber-500/10 p-2 rounded-xl border border-amber-500/30">
                  ✨ Друг отримає офіційне запрошення з деталями місця та часу, а ви отримаєте <strong>+20 XP</strong>!
                </p>
              </div>
            ) : (
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Оберіть заклад
                </label>
                <select
                  value={inviteBar}
                  onChange={(e) => setInviteBar(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-500"
                >
                  {selectedInviteFriend.favoriteBars.map((bar) => (
                    <option key={bar} value={bar}>
                      {bar} (Улюблений заклад {selectedInviteFriend.name})
                    </option>
                  ))}
                  <option value="Squat 17b">Squat 17b (Київ, Центр)</option>
                  <option value="Varvar Bar Podil">Varvar Bar Podil (Поділ)</option>
                  <option value="Win Bar">Win Bar (Поділ)</option>
                  <option value="Punkcraft">Punkcraft (Ігорівська)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Час зустрічі
                </label>
                <input
                  type="text"
                  value={inviteTime}
                  onChange={(e) => setInviteTime(e.target.value)}
                  placeholder="Сьогодні о 20:30..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedInviteFriend(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition"
              >
                Скасувати
              </button>
              <button
                type="button"
                id="confirm-friend-invite-btn"
                onClick={handleConfirmInvite}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>Надіслати клич</span>
                <span>🍻</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
