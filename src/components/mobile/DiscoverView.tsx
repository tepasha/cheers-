import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Beer, 
  Zap, 
  MapPin, 
  Info, 
  SlidersHorizontal, 
  Check,
  MessageSquare,
  Search,
  Rows3,
  LayoutGrid,
  Layers,
  TrendingUp,
  UserPlus,
  UserCheck,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import { BuddyProfile, DrinkType, FilterSettings, MoodType, ReportTargetType } from '../../types';
import { DRINK_METADATA, MOOD_METADATA, PAYMENT_METADATA, POPULAR_INTERESTS } from '../../data/mockData';
import { sounds } from '../../services/soundService';
import { formatDistance } from '../../services/geoService';
import { ActivityAnalyticsModal } from './ActivityAnalyticsModal';
import { gamificationService } from '../../services/gamificationService';
import { friendsService } from '../../services/friendsService';
import { safetyModerationService } from '../../services/safetyModerationService';
import { QuickReportModal } from './QuickReportModal';

interface DiscoverViewProps {
  buddies: BuddyProfile[];
  onMatch: (buddy: BuddyProfile) => void;
  onOpenChat: (buddy: BuddyProfile) => void;
}

type ViewMode = 'feed' | 'grid' | 'deck';

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  buddies,
  onMatch,
  onOpenChat,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showBioModal, setShowBioModal] = useState<BuddyProfile | null>(null);
  const [matchedBuddy, setMatchedBuddy] = useState<BuddyProfile | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>(() => friendsService.getFriendIds());
  const [_blockedKey, setBlockedKey] = useState(0);
  const [reportingTarget, setReportingTarget] = useState<{
    id: string;
    name: string;
    avatar?: string;
    type: ReportTargetType;
  } | null>(null);

  useEffect(() => {
    const unsub = friendsService.subscribe(() => {
      setFriendIds(friendsService.getFriendIds());
    });
    const unsubSafety = safetyModerationService.subscribe(() => {
      setBlockedKey((k) => k + 1);
    });
    return () => {
      unsub();
      unsubSafety();
    };
  }, []);

  const handleToggleFriend = (buddy: BuddyProfile) => {
    friendsService.toggleFriend(buddy);
  };

  // Filters state: distance, drinks, interests, moods, search
  const [filters, setFilters] = useState<FilterSettings>({
    maxDistance: 5,
    drinks: [],
    moods: [],
    paymentRules: [],
    interests: [],
    searchQuery: '',
  });

  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.maxDistance < 5) count += 1;
    if (filters.drinks.length > 0) count += filters.drinks.length;
    if (filters.interests.length > 0) count += filters.interests.length;
    if (filters.moods.length > 0) count += filters.moods.length;
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) count += 1;
    return count;
  }, [filters]);

  // Filter buddies dynamically based on distance, drinks, interests, moods, and search query
  const filteredBuddies = useMemo(() => {
    return buddies.filter((b) => {
      // 0. Anti-abuse: Blocked accounts are immediately hidden
      if (safetyModerationService.isUserBlocked(b.id)) return false;

      // 1. Distance filter
      if (b.distanceKm > filters.maxDistance) return false;

      // 2. Drinks filter
      if (filters.drinks.length > 0 && !filters.drinks.some((d) => b.preferredDrinks.includes(d))) {
        return false;
      }

      // 3. Mood filter
      if (filters.moods.length > 0 && !filters.moods.includes(b.currentMood)) {
        return false;
      }

      // 4. Interests / talkTopics filter
      if (filters.interests.length > 0) {
        const selectedInterestObjs = POPULAR_INTERESTS.filter((pi) =>
          filters.interests.includes(pi.id)
        );
        const allKeywords = selectedInterestObjs.flatMap((pi) => [
          ...pi.keywords,
          pi.label.toLowerCase(),
        ]);

        const buddyText = [
          ...b.talkTopics,
          b.bio,
          b.tagline,
          ...b.favoriteBars,
        ].join(' ').toLowerCase();

        const hasInterestMatch = allKeywords.some((kw) =>
          buddyText.includes(kw.toLowerCase())
        );

        if (!hasInterestMatch) return false;
      }

      // 5. Text search query
      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const q = filters.searchQuery.toLowerCase().trim();
        const corpus = [
          b.name,
          b.tagline,
          b.bio,
          b.locationName,
          ...b.talkTopics,
          ...b.favoriteBars,
        ].join(' ').toLowerCase();
        if (!corpus.includes(q)) return false;
      }

      return true;
    });
  }, [buddies, filters]);

  // Reset card index when filters change
  useEffect(() => {
    setCurrentIndex(0);
  }, [filters]);

  const currentBuddy = filteredBuddies[currentIndex];
  const nextBuddy1 = filteredBuddies[currentIndex + 1];
  const nextBuddy2 = filteredBuddies[currentIndex + 2];
  const hasMore = currentIndex < filteredBuddies.length;

  const handleTriggerMatch = (buddy: BuddyProfile) => {
    sounds.playClink();
    if (!matchedIds.includes(buddy.id)) {
      setMatchedIds((prev) => [...prev, buddy.id]);
    }
    // Gamification: toast / cheers earns points towards level-up
    gamificationService.recordCheckIn('me', {
      barName: buddy.activeCheckIn?.barName || buddy.favoriteBars[0] || 'Барний тост',
      area: buddy.locationName,
      buddyName: buddy.name,
      note: `Тост келихами та знайомство з ${buddy.name}! 🍻`,
      type: 'cheers_toast',
    });

    setTimeout(() => {
      sounds.playMatchCheer();
      setMatchedBuddy(buddy);
      onMatch(buddy);
    }, 200);
  };

  const handleSwipe = (direction: 'left' | 'right' | 'up') => {
    if (!currentBuddy) return;
    setSwipeDirection(direction);

    if (direction === 'right' || direction === 'up') {
      handleTriggerMatch(currentBuddy);
    }

    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentIndex((prev) => prev + 1);
    }, 280);
  };

  const handleResetDeck = () => {
    setCurrentIndex(0);
  };

  const handleClearAllFilters = () => {
    setFilters({
      maxDistance: 5,
      drinks: [],
      moods: [],
      paymentRules: [],
      interests: [],
      searchQuery: '',
    });
  };

  const toggleDrinkFilter = (drink: DrinkType) => {
    setFilters((prev) => ({
      ...prev,
      drinks: prev.drinks.includes(drink)
        ? prev.drinks.filter((d) => d !== drink)
        : [...prev.drinks, drink],
    }));
  };

  const toggleInterestFilter = (interestId: string) => {
    setFilters((prev) => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter((id) => id !== interestId)
        : [...prev.interests, interestId],
    }));
  };

  const toggleMoodFilter = (mood: MoodType) => {
    setFilters((prev) => ({
      ...prev,
      moods: prev.moods.includes(mood)
        ? prev.moods.filter((m) => m !== mood)
        : [...prev.moods, mood],
    }));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 relative overflow-hidden select-none">
      {/* Top Header */}
      <div className="px-3 pt-2.5 pb-2 z-20 border-b border-neutral-900/60 bg-neutral-950/90 backdrop-blur-md space-y-2">
        {/* Row 1: Title, Location & Filter button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍻</span>
            <div>
              <h2 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5 leading-none">
                Пошук компанії
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                  {filteredBuddies.length} поруч
                </span>
              </h2>
              <p className="text-[10px] text-neutral-400 mt-0.5">Поділ • Золоті Ворота • Центр</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Activity Chart Button */}
            <button
              id="activity-analytics-discover-btn"
              type="button"
              onClick={() => {
                sounds.playClink();
                setShowActivityModal(true);
              }}
              className="px-2 py-1 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-neutral-300 hover:text-amber-300 transition flex items-center gap-1 text-[11px] font-semibold"
              title="Графік активності (пікові години)"
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Пік</span>
              </span>
            </button>

            {/* Filters Toggle Button */}
            <button
              id="filter-toggle-btn"
              type="button"
              onClick={() => setShowFilters(true)}
              className={`px-2.5 py-1 rounded-xl border transition relative flex items-center gap-1.5 text-xs font-semibold ${
                activeFiltersCount > 0
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
              }`}
              title="Фільтри пошуку"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px]">Фільтри</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 bg-amber-400 text-neutral-950 font-black rounded-full text-[9px] flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: View Mode Switcher on its own line */}
        <div className="grid grid-cols-3 gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 shadow-inner">
          <button
            id="view-mode-feed-btn"
            type="button"
            onClick={() => setViewMode('feed')}
            className={`py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              viewMode === 'feed'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Стрічка плашок"
          >
            <Rows3 className="w-3.5 h-3.5" />
            <span>Стрічка</span>
          </button>

          <button
            id="view-mode-grid-btn"
            type="button"
            onClick={() => setViewMode('grid')}
            className={`py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              viewMode === 'grid'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Сітка 2 в ряд"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Сітка</span>
          </button>

          <button
            id="view-mode-deck-btn"
            type="button"
            onClick={() => setViewMode('deck')}
            className={`py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              viewMode === 'deck'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Стопка карток"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Стопка</span>
          </button>
        </div>
      </div>

      {/* Quick Filter Chips Bar (Horizontal Scrollable) */}
      <div className="px-3 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar z-20 border-b border-neutral-900/80 bg-neutral-950/70">
        {/* Reset button if any filter is active */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            id="quick-reset-filters-btn"
            onClick={handleClearAllFilters}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 text-[10px] font-bold shrink-0 hover:bg-rose-900 transition"
          >
            <X className="w-2.5 h-2.5" />
            <span>Скинути ({activeFiltersCount})</span>
          </button>
        )}

        {/* Distance Quick Chips */}
        <button
          type="button"
          id="quick-dist-1km"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              maxDistance: prev.maxDistance === 1 ? 5 : 1,
            }))
          }
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold shrink-0 border transition ${
            filters.maxDistance === 1
              ? 'bg-amber-500/25 border-amber-500 text-amber-300'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <MapPin className="w-2.5 h-2.5" />
          <span>&lt; 1 км</span>
        </button>

        <button
          type="button"
          id="quick-dist-2km"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              maxDistance: prev.maxDistance === 2 ? 5 : 2,
            }))
          }
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold shrink-0 border transition ${
            filters.maxDistance === 2
              ? 'bg-amber-500/25 border-amber-500 text-amber-300'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <MapPin className="w-2.5 h-2.5" />
          <span>&lt; 2 км</span>
        </button>

        {/* Drink Quick Chips */}
        {(['craft', 'wine', 'cocktail', 'cider'] as DrinkType[]).map((d) => {
          const isSelected = filters.drinks.includes(d);
          const meta = DRINK_METADATA[d];
          return (
            <button
              key={d}
              type="button"
              id={`quick-drink-${d}`}
              onClick={() => toggleDrinkFilter(d)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold shrink-0 border transition ${
                isSelected
                  ? 'bg-amber-500/25 border-amber-500 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>{meta.icon}</span>
              <span>{meta.label.split(' ')[0]}</span>
            </button>
          );
        })}

        {/* Interests Quick Chips */}
        {(['it', 'board_games', 'sports', 'humor_standup'] as string[]).map((id) => {
          const cat = POPULAR_INTERESTS.find((p) => p.id === id);
          if (!cat) return null;
          const isSelected = filters.interests.includes(id);
          return (
            <button
              key={id}
              type="button"
              id={`quick-interest-${id}`}
              onClick={() => toggleInterestFilter(id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold shrink-0 border transition ${
                isSelected
                  ? 'bg-amber-500/25 border-amber-500 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3">
        {filteredBuddies.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center p-6 bg-neutral-900/60 rounded-3xl border border-neutral-800 max-w-sm mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-2xl mb-3">
              🍻
            </div>
            <h3 className="text-sm font-bold text-neutral-100 mb-1">
              Нікого не знайдено за фільтрами
            </h3>
            <p className="text-[11px] text-neutral-400 mb-4 leading-relaxed">
              Спробуйте збільшити дистанцію, очистити рядок пошуку або скинути вибрані категорії.
            </p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                id="empty-clear-filters-btn"
                onClick={handleClearAllFilters}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition"
              >
                Скинути фільтри пошуку ({activeFiltersCount})
              </button>
            )}
          </div>
        ) : viewMode === 'feed' ? (
          /* 1. FEED VIEW MODE: Більше ніж одна плашка (багато повноцінних карток у стрічці) */
          <div className="space-y-3 pb-8">
            {filteredBuddies.map((buddy) => {
              const isMatched = matchedIds.includes(buddy.id);

              return (
                <div
                  key={buddy.id}
                  id={`buddy-feed-card-${buddy.id}`}
                  className="bg-neutral-900/90 rounded-2xl border border-neutral-800/90 overflow-hidden shadow-lg hover:border-neutral-700 transition"
                >
                  {/* Photo & Top Info banner */}
                  <div className="relative h-44 w-full overflow-hidden bg-neutral-950">
                    <img
                      src={buddy.avatar}
                      alt={buddy.name}
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/25 to-transparent" />

                    {/* Active Check-in badge */}
                    {buddy.activeCheckIn && (
                      <div className="absolute top-2.5 left-2.5 bg-rose-500/95 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <span>У {buddy.activeCheckIn.barName}</span>
                      </div>
                    )}

                    {/* Distance Badge */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-neutral-950/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-300 border border-amber-400/20">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{formatDistance(buddy.distanceKm)}</span>
                    </div>

                    {/* Bottom Info inside image */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-baseline justify-between">
                      <div>
                        <h3 className="text-lg font-black text-white flex items-center gap-1.5 leading-none">
                          {buddy.name}, {buddy.age}
                          {buddy.online && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-neutral-950" />
                          )}
                          {buddy.levelTitle && (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/50 shadow-sm">
                              {buddy.levelTitle}
                            </span>
                          )}
                        </h3>
                        <p className="text-[10px] text-amber-300/90 mt-0.5">{buddy.locationName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBioModal(buddy)}
                        className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20 transition"
                        title="Повна анкета"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3 space-y-2">
                    {/* Tagline */}
                    <p className="text-xs text-neutral-200 leading-relaxed bg-neutral-950/50 p-2 rounded-xl border border-neutral-800/60">
                      "{buddy.tagline}"
                    </p>

                    {/* Tags row: Drinks + Mood + Payment */}
                    <div className="flex flex-wrap gap-1">
                      {buddy.preferredDrinks.map((drink) => (
                        <span
                          key={drink}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${DRINK_METADATA[drink].bg} ${DRINK_METADATA[drink].color}`}
                        >
                          {DRINK_METADATA[drink].icon} {DRINK_METADATA[drink].label.split(' ')[0]}
                        </span>
                      ))}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {MOOD_METADATA[buddy.currentMood].emoji} {MOOD_METADATA[buddy.currentMood].label}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                        {PAYMENT_METADATA[buddy.paymentRule].badge}
                      </span>
                    </div>

                    {/* Talk topics */}
                    <div className="flex flex-wrap gap-1">
                      {buddy.talkTopics.slice(0, 3).map((topic, i) => (
                        <span
                          key={i}
                          className="text-[9px] text-neutral-300 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800"
                        >
                          #{topic}
                        </span>
                      ))}
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-800/80">
                      <button
                        type="button"
                        id={`feed-match-btn-${buddy.id}`}
                        onClick={() => handleTriggerMatch(buddy)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow ${
                          isMatched
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            : 'bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 active:scale-95 shadow-amber-500/20'
                        }`}
                      >
                        {isMatched ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Будьмо! (Запит надіслано)</span>
                          </>
                        ) : (
                          <>
                            <Beer className="w-3.5 h-3.5" />
                            <span>Будьмо! 🍻</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        id={`feed-chat-btn-${buddy.id}`}
                        onClick={() => onOpenChat(buddy)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1 transition"
                        title="Написати повідомлення"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>Чат</span>
                      </button>

                      <button
                        type="button"
                        id={`feed-friend-btn-${buddy.id}`}
                        onClick={() => handleToggleFriend(buddy)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition border ${
                          friendIds.includes(buddy.id)
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border-neutral-700'
                        }`}
                        title={friendIds.includes(buddy.id) ? 'У ваших друзях' : 'Додати в друзі'}
                      >
                        {friendIds.includes(buddy.id) ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline">У друзях</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">У друзі</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        id={`feed-report-btn-${buddy.id}`}
                        onClick={() => setReportingTarget({
                          id: buddy.id,
                          name: buddy.name,
                          avatar: buddy.avatar,
                          type: 'profile',
                        })}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 border border-neutral-700 transition"
                        title="Поскаржитися на профіль"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'grid' ? (
          /* 2. GRID VIEW MODE: Багато плашок у сітці (2 колонки, одразу видно 4-6+ людей) */
          <div className="grid grid-cols-2 gap-2.5 pb-8">
            {filteredBuddies.map((buddy) => {
              const isMatched = matchedIds.includes(buddy.id);

              return (
                <div
                  key={buddy.id}
                  id={`buddy-grid-card-${buddy.id}`}
                  className="bg-neutral-900/90 rounded-2xl border border-neutral-800 overflow-hidden shadow flex flex-col hover:border-neutral-700 transition"
                >
                  {/* Photo area */}
                  <div className="relative h-32 w-full overflow-hidden bg-neutral-950">
                    <img
                      src={buddy.avatar}
                      alt={buddy.name}
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />

                    {/* Distance pill */}
                    <div className="absolute top-1.5 right-1.5 bg-neutral-950/80 backdrop-blur-md px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-amber-300 border border-amber-400/20">
                      {formatDistance(buddy.distanceKm)}
                    </div>

                    {/* Check-in tag */}
                    {buddy.activeCheckIn && (
                      <div className="absolute top-1.5 left-1.5 bg-rose-500/95 text-white px-1.5 py-0.2 rounded-full text-[8px] font-bold truncate max-w-[80px]">
                        {buddy.activeCheckIn.barName}
                      </div>
                    )}

                    <div className="absolute bottom-1.5 left-2 right-2">
                      <h4 className="text-xs font-black text-white truncate flex items-center gap-1">
                        {buddy.name}, {buddy.age}
                        {buddy.online && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </h4>
                      <p className="text-[9px] text-neutral-300 truncate">{buddy.locationName}</p>
                    </div>
                  </div>

                  {/* Body info */}
                  <div className="p-2 flex-1 flex flex-col justify-between space-y-1.5">
                    <p className="text-[10px] text-neutral-300 line-clamp-2 leading-tight">
                      {buddy.tagline}
                    </p>

                    {/* Drink & Mood Chips */}
                    <div className="flex flex-wrap gap-1">
                      {buddy.preferredDrinks.slice(0, 2).map((d) => (
                        <span
                          key={d}
                          className="text-[8px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700"
                        >
                          {DRINK_METADATA[d].icon} {DRINK_METADATA[d].label.split(' ')[0]}
                        </span>
                      ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => handleTriggerMatch(buddy)}
                        className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                          isMatched
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold'
                        }`}
                        title="Будьмо!"
                      >
                        <Beer className="w-3 h-3" />
                        <span>Будьмо</span>
                      </button>

                      <button
                        type="button"
                        id={`grid-friend-btn-${buddy.id}`}
                        onClick={() => handleToggleFriend(buddy)}
                        className={`p-1.5 rounded-xl border transition ${
                          friendIds.includes(buddy.id)
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                            : 'bg-neutral-800 text-amber-400 hover:text-white border-neutral-700'
                        }`}
                        title={friendIds.includes(buddy.id) ? 'У ваших друзях' : 'Додати в друзі'}
                      >
                        {friendIds.includes(buddy.id) ? (
                          <UserCheck className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowBioModal(buddy)}
                        className="p-1.5 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700"
                        title="Детальніше"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 3. DECK VIEW MODE: Стопка карток (показує не 1 плашку, а стопку з 3 плашок з ефектом глибини) */
          <div className="h-full flex items-center justify-center relative min-h-[460px]">
            {hasMore && currentBuddy ? (
              <div className="relative w-full max-w-sm h-[480px] flex items-center justify-center">
                {/* 3rd Card in Stack (позаду) */}
                {nextBuddy2 && (
                  <div className="absolute inset-0 bg-neutral-900/60 rounded-3xl border border-neutral-800/40 transform translate-y-6 scale-[0.88] opacity-40 overflow-hidden pointer-events-none transition">
                    <img
                      src={nextBuddy2.avatar}
                      alt={nextBuddy2.name}
                      className="w-full h-full object-cover filter blur-[1px]"
                    />
                  </div>
                )}

                {/* 2nd Card in Stack (наступна плашка, чітко визирає) */}
                {nextBuddy1 && (
                  <div className="absolute inset-0 bg-neutral-900/80 rounded-3xl border border-neutral-800 transform translate-y-3 scale-[0.94] opacity-75 overflow-hidden pointer-events-none transition shadow-lg">
                    <img
                      src={nextBuddy1.avatar}
                      alt={nextBuddy1.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-neutral-950/80 px-2 py-0.5 rounded-full text-[10px] text-white font-bold border border-neutral-700">
                      Наступний: {nextBuddy1.name}, {nextBuddy1.age}
                    </div>
                  </div>
                )}

                {/* 1st Active Card (головна плашка) */}
                <div
                  id="buddy-active-card"
                  className={`absolute inset-0 bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col transition-all duration-300 transform ${
                    swipeDirection === 'left'
                      ? '-translate-x-full rotate-[-12deg] opacity-0'
                      : swipeDirection === 'right'
                      ? 'translate-x-full rotate-[12deg] opacity-0'
                      : swipeDirection === 'up'
                      ? '-translate-y-full scale-90 opacity-0'
                      : 'translate-x-0 rotate-0 opacity-100'
                  }`}
                >
                  {/* Photo area */}
                  <div className="relative flex-1 w-full overflow-hidden bg-neutral-950">
                    <img
                      src={currentBuddy.avatar}
                      alt={currentBuddy.name}
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

                    {currentBuddy.activeCheckIn && (
                      <div className="absolute top-3 left-3 bg-rose-500/90 text-white backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        <span>Зараз у {currentBuddy.activeCheckIn.barName}</span>
                      </div>
                    )}

                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-neutral-950/70 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-medium text-amber-300 border border-amber-400/20 shadow">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{formatDistance(currentBuddy.distanceKm)}</span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-baseline justify-between mb-1">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                          {currentBuddy.name}, {currentBuddy.age}
                          {currentBuddy.online && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-neutral-950" />
                          )}
                          {currentBuddy.levelTitle && (
                            <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-800/50 shadow">
                              {currentBuddy.levelTitle}
                            </span>
                          )}
                        </h3>
                        <button
                          type="button"
                          id="open-bio-btn"
                          onClick={() => setShowBioModal(currentBuddy)}
                          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition active:scale-95"
                          title="Повна анкета"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-neutral-200 line-clamp-2 mb-2 leading-relaxed">
                        {currentBuddy.tagline}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {currentBuddy.preferredDrinks.map((drink) => (
                          <span
                            key={drink}
                            className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${DRINK_METADATA[drink].bg} ${DRINK_METADATA[drink].color}`}
                          >
                            {DRINK_METADATA[drink].icon} {DRINK_METADATA[drink].label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-6 py-2.5 bg-neutral-950/95 border-t border-neutral-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      id="deck-pass-btn"
                      onClick={() => handleSwipe('left')}
                      className="w-11 h-11 rounded-full bg-neutral-900 hover:bg-neutral-800 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-lg transition active:scale-90"
                      title="Пропустити"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      id="deck-supercheers-btn"
                      onClick={() => handleSwipe('up')}
                      className="w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-lg transition active:scale-90"
                      title="Супер-дзинь! ⚡"
                    >
                      <Zap className="w-4 h-4 fill-cyan-400 text-cyan-400" />
                    </button>

                    <button
                      type="button"
                      id="deck-match-btn"
                      onClick={() => handleSwipe('right')}
                      className="w-13 h-13 px-4 py-2.5 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 flex items-center justify-center shadow-xl shadow-amber-500/30 transition active:scale-90 font-black gap-1.5 text-xs"
                      title="Будьмо! 🍻"
                    >
                      <Beer className="w-5 h-5" />
                      <span>Будьмо!</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-neutral-900/60 rounded-3xl border border-neutral-800">
                <p className="text-xs text-neutral-300 font-bold mb-3">Ви переглянули всі картки в стопці!</p>
                <button
                  type="button"
                  onClick={handleResetDeck}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs"
                >
                  Переглянути спочатку
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Bottom Sheet Modal */}
      {showFilters && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex flex-col justify-end">
          <div className="bg-neutral-900 rounded-t-3xl border-t border-neutral-800 p-5 max-h-[90%] overflow-y-auto no-scrollbar shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span>Фільтри пошуку компанії</span>
              </h3>
              <button
                type="button"
                id="close-filters-btn"
                onClick={() => setShowFilters(false)}
                className="p-1 rounded-full bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Keyword / Topic Search Input */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Пошук за темою, баром або інтересом
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  id="filter-search-input"
                  value={filters.searchQuery || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                  }
                  placeholder="напр. IT, Squat, вино, шахи, футбол..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-8 py-2 text-neutral-100 placeholder-neutral-500 text-xs focus:outline-none focus:border-amber-400"
                />
                {filters.searchQuery && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Distance Slider with Quick Presets */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-neutral-300 mb-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Максимальна дистанція</span>
                </span>
                <span className="text-amber-400 font-bold">{filters.maxDistance} км</span>
              </div>
              <input
                type="range"
                id="filter-distance-slider"
                min="0.5"
                max="10"
                step="0.5"
                value={filters.maxDistance}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, maxDistance: parseFloat(e.target.value) }))
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg mb-2"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[0.5, 1.5, 3, 5].map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, maxDistance: km }))}
                    className={`py-1 rounded-lg text-[10px] font-semibold border transition ${
                      filters.maxDistance === km
                        ? 'bg-amber-500/25 border-amber-500 text-amber-300'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {km} км
                  </button>
                ))}
              </div>
            </div>

            {/* Drinks Preference */}
            <div>
              <span className="text-xs font-semibold text-neutral-300 block mb-1.5">
                Улюблені напої (мультиселект)
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(DRINK_METADATA) as DrinkType[]).map((d) => {
                  const meta = DRINK_METADATA[d];
                  const isSelected = filters.drinks.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      id={`modal-filter-drink-${d}`}
                      onClick={() => toggleDrinkFilter(d)}
                      className={`text-xs px-2.5 py-2 rounded-xl border font-medium flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold shadow-sm'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span>{meta.icon}</span>
                        <span className="truncate">{meta.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interests & Topics Filter */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-neutral-300">
                  Інтереси та теми для розмов
                </span>
                {filters.interests.length > 0 && (
                  <span className="text-[10px] text-amber-400 font-bold">
                    {filters.interests.length} обрано
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_INTERESTS.map((interest) => {
                  const isSelected = filters.interests.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      id={`filter-interest-${interest.id}`}
                      onClick={() => toggleInterestFilter(interest.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition ${
                        isSelected
                          ? 'bg-amber-500/25 border-amber-500 text-amber-300 font-semibold shadow-sm'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <span>{interest.emoji}</span>
                      <span>{interest.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mood selector */}
            <div>
              <span className="text-xs font-semibold text-neutral-300 block mb-1.5">
                Настрій та формат зустрічі
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.keys(MOOD_METADATA) as MoodType[]).slice(0, 4).map((m) => {
                  const meta = MOOD_METADATA[m];
                  const isSelected = filters.moods.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      id={`modal-filter-mood-${m}`}
                      onClick={() => toggleMoodFilter(m)}
                      className={`text-xs px-3 py-1.5 rounded-xl border flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions: Reset & Apply */}
            <div className="pt-2 flex gap-2 border-t border-neutral-800">
              <button
                type="button"
                id="reset-filters-btn"
                onClick={handleClearAllFilters}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition"
              >
                Скинути все
              </button>
              <button
                type="button"
                id="apply-filters-btn"
                onClick={() => setShowFilters(false)}
                className="flex-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>Показати результати ({filteredBuddies.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Bio Modal */}
      {showBioModal && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex flex-col justify-end p-2">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-5 max-h-[90%] overflow-y-auto no-scrollbar shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img
                  src={showBioModal.avatar}
                  alt={showBioModal.name}
                  className="w-10 h-10 rounded-full object-cover border border-amber-400/40"
                />
                <div>
                  <h4 className="text-base font-bold text-neutral-100">
                    {showBioModal.name}, {showBioModal.age}
                  </h4>
                  <p className="text-[11px] text-amber-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{showBioModal.locationName} • {formatDistance(showBioModal.distanceKm)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-bio-btn"
                onClick={() => setShowBioModal(null)}
                className="p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Про себе:
                </span>
                <p className="text-neutral-200 leading-relaxed bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
                  {showBioModal.bio}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Теми для розмов:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {showBioModal.talkTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800/80 text-neutral-300 border border-neutral-700/60 font-medium text-[11px]"
                    >
                      💬 {topic}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Улюблені заклади:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {showBioModal.favoriteBars.map((bar, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium text-[11px]"
                    >
                      🍺 {bar}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Етикет оплати:
                </span>
                <span className="inline-block px-3 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-medium">
                  {PAYMENT_METADATA[showBioModal.paymentRule].label}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                id="bio-toggle-friend-btn"
                onClick={() => {
                  if (showBioModal) {
                    handleToggleFriend(showBioModal);
                  }
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                  showBioModal && friendIds.includes(showBioModal.id)
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                }`}
              >
                {showBioModal && friendIds.includes(showBioModal.id) ? (
                  <>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>✓ У ваших друзях (натисніть, щоб видалити)</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    <span>+ Додати до друзів (+50 XP)</span>
                  </>
                )}
              </button>

              {/* Safety & Anti-abuse actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-neutral-800">
                <button
                  type="button"
                  id="bio-report-user-btn"
                  onClick={() => {
                    if (showBioModal) {
                      setReportingTarget({
                        id: showBioModal.id,
                        name: showBioModal.name,
                        avatar: showBioModal.avatar,
                        type: 'profile',
                      });
                    }
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-amber-300 text-[11px] font-medium flex items-center justify-center gap-1 transition"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Поскаржитися</span>
                </button>

                <button
                  type="button"
                  id="bio-block-user-btn"
                  onClick={() => {
                    if (showBioModal) {
                      safetyModerationService.blockUser(
                        showBioModal.id,
                        showBioModal.name,
                        showBioModal.avatar,
                        'Заблоковано з анкети профілю'
                      );
                      setShowBioModal(null);
                    }
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-neutral-900 hover:bg-rose-500/10 border border-neutral-800 hover:border-rose-500/30 text-neutral-400 hover:text-rose-300 text-[11px] font-medium flex items-center justify-center gap-1 transition"
                >
                  <UserX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Заблокувати</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  id="bio-close-action-btn"
                  onClick={() => setShowBioModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs"
                >
                  Закрити
                </button>
                <button
                  type="button"
                  id="bio-cheers-action-btn"
                  onClick={() => {
                    const b = showBioModal;
                    setShowBioModal(null);
                    handleTriggerMatch(b);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <Beer className="w-4 h-4" />
                  <span>Будьмо!</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Overlay ("У вас спільний келих! 🍻") */}
      {matchedBuddy && (
        <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-lg z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-4xl shadow-2xl shadow-amber-500/50 animate-bounce">
              🍻
            </div>
            <span className="absolute -top-1 -right-1 text-2xl animate-spin">✨</span>
          </div>

          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200 mb-1 tracking-tight">
            Будьмо! У вас співпадіння!
          </h3>
          <p className="text-xs text-neutral-300 mb-6 max-w-xs leading-relaxed">
            Ви та <span className="font-bold text-white">{matchedBuddy.name}</span> готові випити по келиху! Напишіть перший тост або запропонуйте бар.
          </p>

          <div className="flex items-center justify-center -space-x-4 mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-amber-400 overflow-hidden shadow-lg bg-neutral-800">
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80"
                alt="Me"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-16 h-16 rounded-full border-2 border-amber-400 overflow-hidden shadow-lg bg-neutral-800">
              <img
                src={matchedBuddy.avatar}
                alt={matchedBuddy.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="w-full max-w-xs flex flex-col gap-2.5">
            <button
              type="button"
              id="match-go-to-chat-btn"
              onClick={() => {
                const target = matchedBuddy;
                setMatchedBuddy(null);
                onOpenChat(target);
              }}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 transition active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Написати в чат прямо зараз</span>
            </button>
            <button
              type="button"
              id="match-continue-search-btn"
              onClick={() => setMatchedBuddy(null)}
              className="w-full py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs hover:bg-neutral-800 transition"
            >
              Продовжити пошук
            </button>
          </div>
        </div>
      )}

      {/* User Activity & Peak Hours Modal (Recharts) */}
      <ActivityAnalyticsModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
      />

      {/* Quick Report Modal */}
      {reportingTarget && (
        <QuickReportModal
          isOpen={true}
          onClose={() => setReportingTarget(null)}
          targetId={reportingTarget.id}
          targetType={reportingTarget.type}
          targetName={reportingTarget.name}
          targetAvatar={reportingTarget.avatar}
          onSuccess={() => {
            setReportingTarget(null);
            // Block state automatically triggers safetyModerationService.subscribe
          }}
        />
      )}
    </div>
  );
};
