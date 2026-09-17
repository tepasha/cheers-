import React, { useState } from 'react';
import {
  Wine,
  Users,
  MapPin,
  Clock,
  Plus,
  Check,
  MessageSquare,
  X,
  Sparkles,
  CheckCircle2,
  Copy,
  Dices,
  ScrollText,
  TrendingUp,
  ChevronRight,
  Radio,
  Navigation,
  Trash2,
  LocateFixed,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { BuddyProfile, HangoutAlert, ReportTargetType } from '../../types';
import { sounds } from '../../services/soundService';
import { ALL_TOASTS, getRandomToast, ToastItem } from '../../data/toastsData';
import { ToastModal } from './ToastModal';
import { ActivityAnalyticsModal } from './ActivityAnalyticsModal';
import { UserGeoLocation } from '../../services/geoService';
import { gamificationService } from '../../services/gamificationService';
import { ScheduledMeetupsSection } from './ScheduledMeetupsSection';
import { safetyModerationService } from '../../services/safetyModerationService';
import { QuickReportModal } from './QuickReportModal';

interface HangoutsViewProps {
  hangouts: HangoutAlert[];
  onJoinHangout: (hangoutId: string) => void;
  onCloseHangout?: (hangoutId: string) => void;
  onOpenBuddyChat: (buddyName: string) => void;
  buddies: BuddyProfile[];
  onNewHangout: (hangout: HangoutAlert) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  currentLocationName?: string;
  userLocation?: UserGeoLocation;
  onNavigateToMap?: (venueName: string, lat?: number, lng?: number) => void;
}

const POPULAR_BAR_PRESETS = [
  { bar: 'Squat 17b', area: 'Поділ, вул. Терещенківська', lat: 50.4415, lng: 30.514 },
  { bar: 'Win Bar', area: 'Поділ, вул. Хорива', lat: 50.467, lng: 30.5145 },
  { bar: 'Loggerhead', area: 'Шевченківський, б-р Шевченка', lat: 50.4428, lng: 30.5165 },
  { bar: 'Punkcraft', area: 'Поділ, вул. Ігорівська', lat: 50.4608, lng: 30.5218 },
  { bar: 'Varvar Bar', area: 'Поділ, вул. Верхній Вал', lat: 50.4665, lng: 30.512 },
  { bar: 'This is Пивбар', area: 'В. Васильківська / Бессарабка', lat: 50.4385, lng: 30.5195 },
  { bar: 'Pure & Naive', area: 'Золоті Ворота, вул. Франка', lat: 50.449, lng: 30.51 },
];

const QUICK_TEMPLATES = [
  '🍻 Зайняв затишний столик, шукаю приємну компанію на крафтовий келих!',
  '💻 Обговорити IT, стартапи та код за келихом сидру чи пива.',
  '🍷 Атмосферний винний вечір, розмови про книги, подорожі та дизайн.',
  '🎲 Є крута настілка, шукаємо +1 або +2 людей приєднатися!',
  '⚽ Дивимось матч на великому екрані! Хто за компанію?',
];

export const HangoutsView: React.FC<HangoutsViewProps> = ({
  hangouts,
  onJoinHangout,
  onCloseHangout,
  onOpenBuddyChat,
  buddies,
  onNewHangout,
  currentUserId = 'me',
  currentUserName = 'Павло',
  currentUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  currentLocationName = 'Київ, Поділ',
  userLocation,
  onNavigateToMap,
}) => {
  const [joinedHangouts, setJoinedHangouts] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showToastsModal, setShowToastsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [currentToast, setCurrentToast] = useState<ToastItem>(() => getRandomToast());
  const [copiedToast, setCopiedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeMeetupTab, setActiveMeetupTab] = useState<'live' | 'scheduled'>('live');
  const [_blockedKey, setBlockedKey] = useState(0);
  const [reportingTarget, setReportingTarget] = useState<{
    id: string;
    name: string;
    avatar?: string;
    type: ReportTargetType;
  } | null>(null);

  React.useEffect(() => {
    const unsub = safetyModerationService.subscribe(() => {
      setBlockedKey((k) => k + 1);
    });
    return unsub;
  }, []);

  // Filter mode: 'all' | 'live' | 'nearby'
  const [filterMode, setFilterMode] = useState<'all' | 'live' | 'nearby'>('all');

  // Form states for new Hangout
  const [barName, setBarName] = useState('Squat 17b');
  const [locationArea, setLocationArea] = useState(currentLocationName);
  const [drinkPreference, setDrinkPreference] = useState('Крафтове пиво & Сидр');
  const [description, setDescription] = useState(
    'Сиджу у відкритому дворику, замовляю сидр. Шукаю 1-2 людей приєднатися до столика!'
  );
  const [slotsAvailable, setSlotsAvailable] = useState<number>(2);
  const [customLat, setCustomLat] = useState<number | undefined>(50.4415);
  const [customLng, setCustomLng] = useState<number | undefined>(30.514);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleRollNewToast = () => {
    sounds.playClink();
    setCurrentToast(getRandomToast());
  };

  const handleCopyToast = () => {
    sounds.playMessageSent();
    navigator.clipboard.writeText(currentToast.text);
    setCopiedToast(true);
    showToast('Тост скопійовано в буфер обміну! 🍻');
    setTimeout(() => setCopiedToast(false), 2500);
  };

  const handleJoin = (id: string, name: string) => {
    sounds.playClink();
    if (!joinedHangouts.includes(id)) {
      setJoinedHangouts((prev) => [...prev, id]);
      onJoinHangout(id);

      const targetHangout = hangouts.find((h) => h.id === id);
      const res = gamificationService.recordCheckIn(currentUserId, {
        barName: targetHangout?.barName || name,
        area: targetHangout?.locationArea || currentLocationName,
        note: `Підсадка до столика ${name}`,
        type: 'hangout_join',
      });

      showToast(`🎉 Ви підсіли до столика ${name}! +${res.earnedXp} XP (Рівень ${res.newLevel.level} ${res.newLevel.badgeEmoji})`);
    }
  };

  const handleClose = (id: string, bar: string) => {
    sounds.playTap();
    if (onCloseHangout) {
      onCloseHangout(id);
      showToast(`🛑 Чек-ін у "${bar}" закрито та знято з трансляції`);
    }
  };

  const handleCreateHangout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barName.trim() || !description.trim()) return;

    sounds.playClink();

    // Prefer coordinates from chosen bar preset or current user location
    const finalLat = typeof customLat === 'number' ? customLat : userLocation?.lat ?? 50.467;
    const finalLng = typeof customLng === 'number' ? customLng : userLocation?.lng ?? 30.514;

    const newAlert: HangoutAlert = {
      id: `hangout-${Date.now()}`,
      userId: currentUserId,
      userName: `Ви (${currentUserName})`,
      userAvatar: currentUserAvatar,
      barName: barName.trim(),
      locationArea: locationArea.trim() || currentLocationName || 'Київ, Центр',
      drinkPreference: drinkPreference.trim() || 'Келих за настроєм',
      description: description.trim(),
      createdAt: 'Щойно',
      slotsAvailable: slotsAvailable,
      participantsCount: 1,
      lat: finalLat,
      lng: finalLng,
      isLive: true,
      status: 'active',
      joinedUsers: [currentUserId],
    };

    onNewHangout(newAlert);
    const res = gamificationService.recordCheckIn(currentUserId, {
      barName: barName.trim(),
      area: locationArea.trim() || currentLocationName,
      note: description.trim(),
      type: 'bar_visit',
    });

    setShowCreateModal(false);
    showToast(`📡 Живий чек-ін у "${barName}" активовано! +${res.earnedXp} XP 🍻`);
  };

  // Filtered hangouts computation
  const liveCount = hangouts.filter((h) => h.isLive && h.status !== 'closed').length;
  const nearbyCount = hangouts.filter((h) => {
    const dist = typeof h.distanceKm === 'number' ? h.distanceKm : 999;
    return dist <= 2.5 && h.status !== 'closed';
  }).length;

  const filteredHangouts = hangouts.filter((h) => {
    if (safetyModerationService.isUserBlocked(h.userId)) return false;
    if (h.status === 'closed') return false;
    if (filterMode === 'live') return !!h.isLive;
    if (filterMode === 'nearby') {
      const dist = typeof h.distanceKm === 'number' ? h.distanceKm : 999;
      return dist <= 2.5;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-y-auto no-scrollbar select-none relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-4 right-4 z-40 bg-amber-500 text-neutral-950 text-xs font-bold px-3 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-neutral-950" />
          <span className="flex-1 truncate">{toastMessage}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5 leading-none">
            {activeMeetupTab === 'scheduled' ? 'Групові зустрічі 🗓️' : 'Кличі на вечір 📢'}
            <span className="bg-amber-500/20 text-amber-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {activeMeetupTab === 'scheduled' ? 'Заплановані' : hangouts.length}
            </span>
          </h2>
          <p className="text-[10px] text-neutral-400">
            {activeMeetupTab === 'scheduled'
              ? 'Зустрічі з місцем, часом та списком людей'
              : 'Відкриті столики та компанії на келих'}
          </p>
        </div>

        {activeMeetupTab === 'live' && (
          <button
            id="create-hangout-open-btn"
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Кинути клич</span>
          </button>
        )}
      </div>

      {/* Sub-navigation Switcher: Live Hangout Alerts vs Scheduled Meetups */}
      <div className="px-4 pt-2.5 pb-1 shrink-0 bg-neutral-950">
        <div className="flex items-center p-1 rounded-2xl bg-neutral-900 border border-neutral-800">
          <button
            type="button"
            id="subtab-live-hangouts-btn"
            onClick={() => {
              sounds.playTap();
              setActiveMeetupTab('live');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMeetupTab === 'live'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-extrabold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Кличі наживо ({hangouts.length})</span>
          </button>

          <button
            type="button"
            id="subtab-scheduled-meetups-btn"
            onClick={() => {
              sounds.playTap();
              setActiveMeetupTab('scheduled');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMeetupTab === 'scheduled'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-extrabold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Заплановані зустрічі</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeMeetupTab === 'scheduled' ? (
        <div className="p-4 pb-12">
          <ScheduledMeetupsSection
            buddies={buddies}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            onOpenBuddyChat={onOpenBuddyChat}
            onNavigateToMap={onNavigateToMap}
          />
        </div>
      ) : (
        <div className="p-4 space-y-3 pb-8">
        {/* User Activity Peak Chart Teaser */}
        <button
          type="button"
          id="open-activity-analytics-hangouts-btn"
          onClick={() => setShowActivityModal(true)}
          className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-neutral-900 to-amber-950/20 border border-amber-500/30 hover:border-amber-500/60 transition flex items-center justify-between group text-left shadow-md"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Графік активності (Recharts)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Пік 19:00–22:30
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Дізнайтеся, коли найбільше людей шукають компанію в барах
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition shrink-0">
            <span>Графік</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Featured Toast of the Evening Widget */}
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/40 rounded-2xl border border-amber-500/30 p-3.5 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base animate-pulse">🍻</span>
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                Тост вечора
                <span className="text-[10px] text-neutral-400 font-normal bg-neutral-950 px-2 py-0.5 rounded-full border border-neutral-800">
                  {currentToast.categoryLabel}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                id="open-all-toasts-btn"
                onClick={() => setShowToastsModal(true)}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-semibold flex items-center gap-1 transition"
                title="Відкрити скриньку всіх тостів"
              >
                <ScrollText className="w-3.5 h-3.5 text-amber-400" />
                <span>Скринька ({ALL_TOASTS.length})</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-neutral-200 font-medium italic leading-relaxed pl-2 border-l-2 border-amber-500/60">
            «{currentToast.text}»
          </p>

          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80 text-xs">
            <button
              type="button"
              id="roll-another-toast-hangouts"
              onClick={handleRollNewToast}
              className="text-[11px] text-neutral-400 hover:text-amber-300 font-medium flex items-center gap-1 transition active:scale-95"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              <span>🎲 Інший тост</span>
            </button>

            <button
              type="button"
              id="copy-evening-toast-btn"
              onClick={handleCopyToast}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-amber-500/10 text-neutral-300 hover:text-amber-400 border border-neutral-800 flex items-center gap-1 transition"
            >
              {copiedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Скопійовано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Скопіювати</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Filter Tabs & Realtime Badge */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] px-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Наживо в Cloud Firestore ({liveCount} активних)</span>
            </div>
            {userLocation && (
              <span className="text-[10px] text-neutral-400 flex items-center gap-1 truncate max-w-[140px]">
                <LocateFixed className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{userLocation.locationName.split(',')[0]}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              id="filter-hangouts-all"
              onClick={() => {
                sounds.playTap();
                setFilterMode('all');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                filterMode === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>Усі кличі</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-950/80 text-neutral-300">
                {hangouts.length}
              </span>
            </button>

            <button
              type="button"
              id="filter-hangouts-live"
              onClick={() => {
                sounds.playTap();
                setFilterMode('live');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                filterMode === 'live'
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Наживо</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-950/80 text-emerald-300">
                {liveCount}
              </span>
            </button>

            <button
              type="button"
              id="filter-hangouts-nearby"
              onClick={() => {
                sounds.playTap();
                setFilterMode('nearby');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                filterMode === 'nearby'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span>Поруч &lt;2.5км</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-950/80 text-amber-300">
                {nearbyCount}
              </span>
            </button>
          </div>
        </div>

        {/* Empty state if filter yields 0 */}
        {filteredHangouts.length === 0 && (
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center flex flex-col items-center justify-center space-y-2">
            <Radio className="w-8 h-8 text-neutral-600 animate-pulse" />
            <p className="text-xs font-semibold text-neutral-300">
              {filterMode === 'nearby'
                ? 'Поблизу вас поки немає активних кличів'
                : 'Немає чекінів у цій категорії'}
            </p>
            <p className="text-[11px] text-neutral-500 max-w-xs">
              Будьте першим — опублікуйте свій чекін у барі, щоб знайти компанію!
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-2 px-3.5 py-1.5 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Опублікувати свій чекін</span>
            </button>
          </div>
        )}

        {filteredHangouts.map((h) => {
          const isJoined = joinedHangouts.includes(h.id);
          const isMyHangout =
            h.userId === currentUserId ||
            h.userId === 'me' ||
            h.userName.includes('Ви');
          const isCloseProximity = typeof h.distanceKm === 'number' && h.distanceKm <= 0.5;

          return (
            <div
              key={h.id}
              className={`bg-neutral-900 rounded-2xl border p-3.5 shadow-md flex flex-col gap-2.5 transition relative overflow-hidden ${
                isMyHangout
                  ? 'border-amber-500/60 bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/30 shadow-amber-500/10'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <img
                      src={h.userAvatar}
                      alt={h.userName}
                      className={`w-10 h-10 rounded-full object-cover border ${
                        isMyHangout
                          ? 'border-amber-400 ring-2 ring-amber-400/40'
                          : 'border-amber-400/40'
                      }`}
                    />
                    {h.isLive && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-neutral-900 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-bold text-white flex items-center gap-1">
                        {h.userName}
                      </h3>
                      {isMyHangout && (
                        <span className="text-[9px] font-bold bg-amber-500 text-neutral-950 px-1.5 py-0.2 rounded-full">
                          Мій клич
                        </span>
                      )}
                      {h.isLive && (
                        <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          НАЖИВО В БАРІ
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                      <Wine className="w-3 h-3" />
                      {h.barName}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    {!isMyHangout && (
                      <button
                        type="button"
                        id={`report-hangout-btn-${h.id}`}
                        onClick={() => setReportingTarget({
                          id: h.id,
                          name: `${h.userName} (${h.barName})`,
                          avatar: h.userAvatar,
                          type: 'hangout',
                        })}
                        className="text-neutral-500 hover:text-amber-400 p-0.5 rounded transition"
                        title="Поскаржитися на цей клич або чекін"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {h.createdAt}
                    </span>
                  </div>
                  {h.distanceFormatted && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-1 ${
                        isCloseProximity
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>{h.distanceFormatted}</span>
                      {isCloseProximity && <span className="text-emerald-400 font-extrabold">• Поруч!</span>}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-neutral-200 leading-relaxed bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80">
                "{h.description}"
              </p>

              {/* Drink preference badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700/50">
                  Пʼють: <strong className="text-neutral-200">{h.drinkPreference}</strong>
                </span>
                {isCloseProximity && (
                  <span className="text-[10px] text-emerald-300 bg-emerald-950/80 border border-emerald-800/50 px-2 py-0.5 rounded-md font-bold">
                    ⚡ Менше 500 метрів від вас
                  </span>
                )}
              </div>

              {/* Meta Row */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                <span className="flex items-center gap-1 text-emerald-400 font-medium truncate max-w-[200px]">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{h.locationArea}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <Users className="w-3 h-3 text-neutral-400" />
                  <span>
                    Місць: {h.participantsCount + (isJoined ? 1 : 0)} /{' '}
                    {h.slotsAvailable + h.participantsCount}
                  </span>
                </span>
              </div>

              {/* Action Button */}
              <div className="flex gap-2 pt-1">
                {isMyHangout ? (
                  <div className="w-full flex items-center gap-2">
                    <div className="flex-1 py-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Ваш клич активний і транслюється поруч</span>
                    </div>
                    {onCloseHangout && (
                      <button
                        type="button"
                        id={`close-hangout-btn-${h.id}`}
                        onClick={() => handleClose(h.id, h.barName)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-rose-950/80 text-neutral-400 hover:text-rose-300 border border-neutral-700 hover:border-rose-800/60 text-xs font-bold flex items-center gap-1 transition"
                        title="Закрити чекін"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Закрити</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      id={`join-hangout-btn-${h.id}`}
                      onClick={() => handleJoin(h.id, h.userName)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow ${
                        isJoined
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                          : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 active:scale-95'
                      }`}
                    >
                      {isJoined ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ви приєдналися! Місце заброньовано</span>
                        </>
                      ) : (
                        <>
                          <Wine className="w-3.5 h-3.5" />
                          <span>Підсісти до столика ({h.slotsAvailable} вільних)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      id={`chat-hangout-btn-${h.id}`}
                      onClick={() => onOpenBuddyChat(h.userName)}
                      className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center justify-center transition"
                      title="Написати автору кличу"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom Banner to encourage creating new Hangouts */}
        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-dashed border-neutral-800 text-center flex flex-col items-center justify-center">
          <p className="text-xs text-neutral-300 font-semibold mb-1">
            Сидите в улюбленому закладі або плануєте вихід?
          </p>
          <p className="text-[11px] text-neutral-400 mb-3">
            Киньте клич, щоб знайти людей за столик поруч із вами.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Створити новий клич</span>
          </button>
        </div>
      </div>
      )}

      {/* Modal: Create Hangout ("Кинути клич на вечір") */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md z-50 flex flex-col justify-end p-2">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-5 max-h-[92%] overflow-y-auto no-scrollbar shadow-2xl space-y-3.5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">
                    Живий чекін у барі 🍻
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    Миттєва трансляція в радіусі для всіх поблизу
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-create-hangout-modal"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateHangout} className="space-y-3 text-xs">
              {/* Bar Name */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Назва закладу чи бару
                </label>
                <input
                  type="text"
                  id="hangout-bar-input"
                  value={barName}
                  onChange={(e) => {
                    setBarName(e.target.value);
                  }}
                  placeholder="напр. Squat 17b, Win Bar, Punkcraft..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
                {/* Quick Presets with coordinates */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {POPULAR_BAR_PRESETS.map((p) => {
                    const isCurrentSelected = barName === p.bar;
                    return (
                      <button
                        key={p.bar}
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setBarName(p.bar);
                          setLocationArea(p.area);
                          setCustomLat(p.lat);
                          setCustomLng(p.lng);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition flex items-center gap-1 ${
                          isCurrentSelected
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 font-bold'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-amber-300 hover:border-neutral-700'
                        }`}
                      >
                        <span>{p.bar}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-neutral-300">
                    Район чи адреса
                  </label>
                  {userLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setLocationArea(userLocation.locationName);
                        setCustomLat(userLocation.lat);
                        setCustomLng(userLocation.lng);
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <LocateFixed className="w-2.5 h-2.5" />
                      <span>Моя позиція</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  id="hangout-area-input"
                  value={locationArea}
                  onChange={(e) => setLocationArea(e.target.value)}
                  placeholder="напр. Київ, Поділ (вул. Хорива)"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
              </div>

              {/* Drinks & Format */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Що пʼємо / Формат
                </label>
                <input
                  type="text"
                  id="hangout-drinks-input"
                  value={drinkPreference}
                  onChange={(e) => setDrinkPreference(e.target.value)}
                  placeholder="напр. Крафтовий IPA, Сухе біле вино, Настілки під пиво..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {['Крафтове пиво', 'Сидр & IPA', 'Сухе вино', 'Авторський коктейль', 'Наливки'].map((dp) => (
                    <button
                      key={dp}
                      type="button"
                      onClick={() => setDrinkPreference(dp)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-amber-300"
                    >
                      {dp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slots Available Counter */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Скільки вільних місць за столиком?
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      id={`slot-btn-${num}`}
                      onClick={() => setSlotsAvailable(num)}
                      className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition ${
                        slotsAvailable === num
                          ? 'bg-amber-500 border-amber-400 text-neutral-950 shadow-md'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description / Pitch */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-neutral-300">
                    Опис / Повідомлення для компанії
                  </label>
                  <span className="text-[10px] text-neutral-500">Чому варто підсісти</span>
                </div>
                <textarea
                  id="hangout-desc-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs resize-none"
                  placeholder="Де сидите, яка атмосфера, що плануєте обговорити..."
                  required
                />

                {/* Quick Templates */}
                <div className="space-y-1 mt-1.5">
                  <span className="text-[10px] text-neutral-400 font-medium">Швидкі заклики:</span>
                  <div className="grid grid-cols-1 gap-1">
                    {QUICK_TEMPLATES.slice(0, 3).map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDescription(tmpl)}
                        className="text-[10px] text-left p-1.5 rounded-lg bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-amber-300 hover:border-neutral-700 transition truncate"
                      >
                        {tmpl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  id="cancel-create-hangout-btn"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 font-semibold text-xs hover:bg-neutral-700 transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  id="submit-create-hangout-btn"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Транслювати наживо 📡</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Toasts Vault Modal */}
      <ToastModal
        isOpen={showToastsModal}
        onClose={() => setShowToastsModal(false)}
        onSelectToast={(toastText) => {
          navigator.clipboard.writeText(toastText);
          showToast('Тост обрано та скопійовано у буфер! 🍻');
        }}
        title="Скринька тостів для компанії 🍻"
        allowCustom={true}
      />

      {/* User Activity & Peak Hours Analytics Modal (Recharts) */}
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
            showToast('Скаргу надіслано модераторам. Дякуємо за пильність!');
          }}
        />
      )}
    </div>
  );
};
