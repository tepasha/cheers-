import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Award, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Flame, 
  PartyPopper,
  HelpCircle,
  Sparkles,
  X,
  Info
} from 'lucide-react';
import { UserGamificationState, UserLevelInfo } from '../../types';
import { 
  gamificationService, 
  LEVELS_CONFIG, 
  ALL_ACHIEVEMENTS 
} from '../../services/gamificationService';
import { sounds } from '../../services/soundService';

interface GamificationProgressCardProps {
  userId?: string;
  userName?: string;
  currentLocationName?: string;
  onCheckInSuccess?: (barName: string, xpEarned: number) => void;
  onOpenTour?: () => void;
}

const QUICK_CHECKIN_BARS = [
  { name: 'Squat 17b', area: 'Поділ / Шевченківський' },
  { name: 'Win Bar', area: 'Поділ, вул. Хорива' },
  { name: 'Loggerhead', area: 'Центр, б-р Шевченка' },
  { name: 'Punkcraft', area: 'Поділ, вул. Ігорівська' },
  { name: 'Varvar Bar', area: 'Поділ, Верхній Вал' },
  { name: 'Pure & Naive', area: 'Золоті Ворота' },
];

export const GamificationProgressCard: React.FC<GamificationProgressCardProps> = ({
  userId = 'me',
  userName = 'Павло',
  currentLocationName = 'Київ, Поділ',
  onCheckInSuccess,
  onOpenTour,
}) => {
  const [gamification, setGamification] = useState<UserGamificationState>(() =>
    gamificationService.loadGamificationState(userId)
  );
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showLevelsLadder, setShowLevelsLadder] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showExplainerTooltip, setShowExplainerTooltip] = useState(false);

  // Form for custom check-in
  const [selectedBar, setSelectedBar] = useState(QUICK_CHECKIN_BARS[0].name);
  const [customBar, setCustomBar] = useState('');
  const [checkInNote, setCheckInNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Celebratory Level-Up Modal
  const [levelUpData, setLevelUpData] = useState<{
    newLevel: UserLevelInfo;
    prevLevel: UserLevelInfo;
  } | null>(null);

  // Notification toast
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const handleStorage = () => {
      setGamification(gamificationService.loadGamificationState(userId));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  const levelInfo = gamificationService.getLevelInfo(gamification.xp);
  const { currentLevel, nextLevel, progressPercent, xpInCurrentLevel, xpNeededForNextLevel } = levelInfo;

  const handlePerformCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBarName = customBar.trim() || selectedBar;
    if (!finalBarName) return;

    setIsSubmitting(true);
    const result = gamificationService.recordCheckIn(userId, {
      barName: finalBarName,
      area: currentLocationName,
      note: checkInNote.trim() || 'Успішна дружня зустріч у закладі! 🍻',
      type: 'bar_visit',
    });

    setGamification(result.updatedState);
    setIsSubmitting(false);
    setShowCheckInModal(false);
    setCustomBar('');
    setCheckInNote('');

    if (result.didLevelUp) {
      setLevelUpData({
        newLevel: result.newLevel,
        prevLevel: result.prevLevel,
      });
    } else {
      setNotification(`🎉 +${result.earnedXp} XP! Успішний чекін у «${finalBarName}»!`);
      setTimeout(() => setNotification(null), 3500);
    }

    if (onCheckInSuccess) {
      onCheckInSuccess(finalBarName, result.earnedXp);
    }
  };

  const unlockedAchievementsCount = (gamification.achievements || []).length;
  const achievementsWithStatus = gamificationService.getAchievementsWithStatus(
    gamification.achievements
  );

  return (
    <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-4 shadow-xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Floating XP Notification */}
      {notification && (
        <div className="absolute top-2 left-3 right-3 z-30 bg-amber-500 text-neutral-950 text-xs font-bold px-3 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <PartyPopper className="w-4 h-4 shrink-0 text-neutral-950" />
          <span className="flex-1 truncate">{notification}</span>
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-neutral-950 flex items-center justify-center text-base font-bold shadow-md shadow-amber-500/20">
            {currentLevel.badgeEmoji}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-neutral-100">
                Рівень {currentLevel.level}: {currentLevel.title}
              </span>
              <button
                type="button"
                id="gamification-header-help-tooltip-btn"
                onClick={() => {
                  sounds.playTap();
                  setShowExplainerTooltip(!showExplainerTooltip);
                }}
                className={`p-1 rounded-lg transition ${
                  showExplainerTooltip
                    ? 'text-amber-300 bg-amber-500/20'
                    : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
                }`}
                title="Підказка: як працює система балів та рівнів"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-amber-400 font-medium">
              {currentLevel.perk}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-extrabold text-amber-400 leading-none">
            {gamification.xp} <span className="text-[10px] text-neutral-400 font-normal">XP</span>
          </div>
          <span className="text-[9px] text-neutral-400 font-medium">
            {gamification.totalMeetups} {gamification.totalMeetups === 1 ? 'зустріч' : 'зустрічей'}
          </span>
        </div>
      </div>

      {/* Interactive Tooltip Popover Explainer for Point & Level System */}
      {showExplainerTooltip && (
        <div className="bg-neutral-950 border border-amber-500/40 rounded-2xl p-3.5 space-y-2.5 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Як працює система балів та рівнів:</span>
            </div>
            <button
              type="button"
              id="close-explainer-tooltip-btn"
              onClick={() => setShowExplainerTooltip(false)}
              className="text-neutral-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-[11px] text-neutral-300">
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/90 rounded-lg border border-neutral-800">
              <span className="flex items-center gap-1.5">
                <span>📍</span>
                <span>Чекін або відмітка в закладі</span>
              </span>
              <strong className="text-amber-400">+100 XP</strong>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/90 rounded-lg border border-neutral-800">
              <span className="flex items-center gap-1.5">
                <span>👥</span>
                <span>Підсадка до столика у «Тусовках»</span>
              </span>
              <strong className="text-amber-400">+80 XP</strong>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/90 rounded-lg border border-neutral-800">
              <span className="flex items-center gap-1.5">
                <span>🥂</span>
                <span>Взаємний тост келихами «Будьмо!»</span>
              </span>
              <strong className="text-amber-400">+30 XP</strong>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/90 rounded-lg border border-neutral-800">
              <span className="flex items-center gap-1.5">
                <span>🎖️</span>
                <span>Бонус за розблокування бейджів</span>
              </span>
              <strong className="text-amber-400">+50..100 XP</strong>
            </div>
          </div>

          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Кожні 100–300 XP підвищують ваш рівень («Level Up»), надають унікальний бейдж біля імені та відкривають пріоритет у пошуку компанії!
          </p>

          {onOpenTour && (
            <button
              type="button"
              id="reopen-onboarding-tour-btn"
              onClick={() => {
                setShowExplainerTooltip(false);
                onOpenTour();
              }}
              className="w-full py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/40 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Переглянути інтерактивний гід для новачків</span>
            </button>
          )}
        </div>
      )}

      {/* Progress Bar Container */}
      <div className="space-y-1.5 bg-neutral-950/80 p-3 rounded-2xl border border-neutral-800/80">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-neutral-300 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>Прогрес до наступного рівня</span>
          </span>
          <span className="font-bold text-amber-400">
            {progressPercent}%
          </span>
        </div>

        {/* The Bar */}
        <div className="w-full h-3 bg-neutral-800/90 rounded-full overflow-hidden p-0.5 relative shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 transition-all duration-700 relative"
            style={{ width: `${Math.max(4, progressPercent)}%` }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/40 rounded-full animate-pulse" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
          <span>
            {nextLevel
              ? `${xpInCurrentLevel} / ${nextLevel.minXp - currentLevel.minXp} XP`
              : 'Максимальний ранг досягнуто!'}
          </span>
          <span>
            {nextLevel ? (
              <>
                Ще <strong className="text-neutral-200">{xpNeededForNextLevel} XP</strong> до «{nextLevel.title} {nextLevel.badgeEmoji}»
              </>
            ) : (
              'Легендарний статус 🏆'
            )}
          </span>
        </div>
      </div>

      {/* Gamification Stats Triad */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-neutral-950/60 p-2.5 rounded-2xl border border-neutral-800/70">
          <span className="text-[10px] text-neutral-400 block mb-0.5">Зустрічей</span>
          <span className="text-sm font-extrabold text-neutral-100 flex items-center justify-center gap-1">
            <span>🍻</span>
            <span>{gamification.totalMeetups}</span>
          </span>
        </div>

        <div className="bg-neutral-950/60 p-2.5 rounded-2xl border border-neutral-800/70">
          <span className="text-[10px] text-neutral-400 block mb-0.5">Бейджів</span>
          <span className="text-sm font-extrabold text-amber-300 flex items-center justify-center gap-1">
            <span>🎖️</span>
            <span>{unlockedAchievementsCount}/{ALL_ACHIEVEMENTS.length}</span>
          </span>
        </div>

        <div className="bg-neutral-950/60 p-2.5 rounded-2xl border border-neutral-800/70">
          <span className="text-[10px] text-neutral-400 block mb-0.5">Ранг</span>
          <span className="text-xs font-bold text-neutral-200 truncate block mt-0.5">
            №{currentLevel.level} {currentLevel.badgeEmoji}
          </span>
        </div>
      </div>

      {/* Quick Action Button: Check-in / Record Meetup */}
      <div className="flex gap-2">
        <button
          type="button"
          id="open-checkin-modal-btn"
          onClick={() => {
            sounds.playClink();
            setShowCheckInModal(true);
          }}
          className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Відмітити зустріч у барі (+100 XP)</span>
        </button>

        <button
          type="button"
          id="toggle-achievements-btn"
          onClick={() => {
            sounds.playTap();
            setShowAchievements(!showAchievements);
          }}
          className="px-3 py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-semibold border border-neutral-700 flex items-center gap-1 transition"
          title="Переглянути досягнення та бейджі"
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>Бейджі</span>
        </button>
      </div>

      {/* Collapsible: Level Ladder (Всі ранги гри) */}
      <div className="border-t border-neutral-800/80 pt-2">
        <button
          type="button"
          id="toggle-levels-ladder-btn"
          onClick={() => setShowLevelsLadder(!showLevelsLadder)}
          className="w-full flex items-center justify-between text-[11px] text-neutral-400 hover:text-neutral-200 transition py-1"
        >
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Шкала рівнів «Level up» ({LEVELS_CONFIG.length} рангів)</span>
          </span>
          {showLevelsLadder ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {showLevelsLadder && (
          <div className="mt-2 space-y-1.5 animate-in fade-in">
            {LEVELS_CONFIG.map((lvl) => {
              const isCurrent = lvl.level === currentLevel.level;
              const isUnlocked = gamification.xp >= lvl.minXp;
              return (
                <div
                  key={lvl.level}
                  className={`p-2 rounded-xl text-xs flex items-center justify-between transition ${
                    isCurrent
                      ? 'bg-amber-500/20 border border-amber-500/50 text-amber-200 font-bold'
                      : isUnlocked
                      ? 'bg-neutral-950/60 border border-neutral-800 text-neutral-300'
                      : 'bg-neutral-950/30 border border-neutral-900 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{lvl.badgeEmoji}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>Рівень {lvl.level}: {lvl.title}</span>
                        {isCurrent && (
                          <span className="text-[9px] bg-amber-400 text-neutral-950 px-1 rounded font-black">
                            Ви тут
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] opacity-75 font-normal block">
                        {lvl.perk}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono shrink-0 ml-2">
                    {lvl.minXp} XP
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible: Achievements (Бейджі) */}
      {showAchievements && (
        <div className="border-t border-neutral-800/80 pt-2 animate-in fade-in space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
            <span>Нагороди та бейджі:</span>
            <span className="text-[10px] text-amber-400">
              {unlockedAchievementsCount} з {ALL_ACHIEVEMENTS.length} розблоковано
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {achievementsWithStatus.map((ach) => (
              <div
                key={ach.id}
                className={`p-2 rounded-xl border text-left flex items-start gap-2 ${
                  ach.isUnlocked
                    ? 'bg-amber-500/10 border-amber-500/40 text-neutral-200'
                    : 'bg-neutral-950/40 border-neutral-800/60 text-neutral-500 opacity-60'
                }`}
              >
                <span className="text-lg shrink-0">{ach.icon}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate flex items-center gap-1">
                    <span>{ach.title}</span>
                    {ach.isUnlocked && <CheckCircle2 className="w-3 h-3 text-amber-400" />}
                  </div>
                  <p className="text-[9px] leading-tight line-clamp-2 mt-0.5">
                    {ach.description}
                  </p>
                  <span className="text-[9px] text-amber-400 font-semibold block mt-1">
                    +{ach.xpReward} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Check-Ins History Feed */}
      {gamification.checkIns.length > 0 && (
        <div className="border-t border-neutral-800/80 pt-2.5">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
            Історія останніх зустрічей:
          </span>
          <div className="space-y-1.5">
            {gamification.checkIns.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-2 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">🍻</span>
                  <div className="min-w-0">
                    <span className="font-bold text-neutral-200 truncate block">
                      {item.barName}
                    </span>
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1 truncate">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{item.area}</span>
                      {item.buddyName && (
                        <span>• разом з {item.buddyName}</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span className="text-[11px] font-bold text-amber-400 block">
                    +{item.pointsEarned} XP
                  </span>
                  <span className="text-[9px] text-neutral-500 flex items-center gap-0.5 justify-end">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{item.timestamp}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check-In Modal Dialog */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl w-full max-w-sm p-4 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Чекін у закладі</h3>
                  <p className="text-[10px] text-neutral-400">+100 XP за успішну зустріч</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckInModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePerformCheckIn} className="space-y-3">
              {/* Quick Select Bar Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">
                  Оберіть заклад зі списку:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_CHECKIN_BARS.map((bar) => (
                    <button
                      key={bar.name}
                      type="button"
                      onClick={() => {
                        setSelectedBar(bar.name);
                        setCustomBar('');
                      }}
                      className={`p-2 rounded-xl text-left border transition text-xs ${
                        selectedBar === bar.name && !customBar
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="truncate font-semibold">{bar.name}</div>
                      <div className="text-[9px] text-neutral-500 truncate">{bar.area}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Or enter custom bar */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Або введіть інший бар:
                </label>
                <input
                  type="text"
                  value={customBar}
                  onChange={(e) => setCustomBar(e.target.value)}
                  placeholder="Наприклад: БарменДиктат, Торф..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Враження або коментар (опціонально):
                </label>
                <input
                  type="text"
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  placeholder="Чудове IPA та приємні бесіди!"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 hover:brightness-105 transition"
              >
                {isSubmitting ? 'Збереження...' : 'Зафіксувати чекін (+100 XP) 🍻'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Level-Up Celebratory Dialog */}
      {levelUpData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border-2 border-amber-500/80 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-in zoom-in-95">
            <div className="text-5xl animate-bounce">
              {levelUpData.newLevel.badgeEmoji}
            </div>

            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[11px] uppercase tracking-wider border border-amber-500/40">
                ⚡ LEVEL UP! НОВИЙ РАНГ ⚡
              </span>
              <h3 className="text-xl font-black text-white">
                Рівень {levelUpData.newLevel.level}: {levelUpData.newLevel.title}
              </h3>
              <p className="text-xs text-neutral-300 pt-1">
                Вітаємо, {userName}! За успішні зустрічі у барах ви здобули новий рівень майстерності!
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-xs text-amber-200">
              <span className="font-bold block mb-0.5">🏆 Відкрито нову перевагу:</span>
              <span>{levelUpData.newLevel.perk}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playClink();
                setLevelUpData(null);
              }}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs shadow-lg shadow-amber-500/25 transition active:scale-95"
            >
              Продовжити святкувати! 🍻
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
