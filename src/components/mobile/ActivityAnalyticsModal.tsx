import React, { useState } from 'react';
import {
  X,
  Clock,
  Calendar,
  Flame,
  Zap,
  TrendingUp,
  Sparkles,
  Beer,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  HOURLY_ACTIVITY_DATA,
  DAILY_ACTIVITY_DATA,
  DRINKS_PEAK_DISTRIBUTION,
  getCurrentActivityInsights,
  HourlyActivity,
  DailyActivity
} from '../../data/activityData';
import { sounds } from '../../services/soundService';

interface ActivityAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToHangouts?: () => void;
}

type TabMode = 'hourly' | 'daily' | 'drinks';

export const ActivityAnalyticsModal: React.FC<ActivityAnalyticsModalProps> = ({
  isOpen,
  onClose,
  onGoToHangouts,
}) => {
  const [tab, setTab] = useState<TabMode>('hourly');
  const insights = getCurrentActivityInsights();

  if (!isOpen) return null;

  const CustomHourlyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as HourlyActivity;
      return (
        <div className="bg-neutral-900/95 border border-amber-500/50 p-2.5 rounded-xl shadow-2xl text-xs backdrop-blur-md min-w-[170px]">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-1 mb-1.5 font-bold text-white">
            <span className="flex items-center gap-1">🕒 {data.hour}</span>
            <span className="text-[10px] text-amber-400 font-normal">{data.statusLabel}</span>
          </div>
          <div className="space-y-1 text-neutral-300 text-[11px]">
            <div className="flex justify-between gap-3">
              <span className="text-neutral-400">Шукають компанію:</span>
              <span className="font-bold text-amber-400">{data.activeUsers} людей</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-neutral-400">Кличі в барах:</span>
              <span className="font-semibold text-white">{data.hangoutsCount} столиків</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-neutral-400">Шанс знайти пару:</span>
              <span className="font-semibold text-emerald-400">{data.matchProbability}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDailyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as DailyActivity;
      return (
        <div className="bg-neutral-900/95 border border-amber-500/50 p-2.5 rounded-xl shadow-2xl text-xs backdrop-blur-md min-w-[180px]">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-1 mb-1.5 font-bold text-white">
            <span>📅 {data.day}</span>
            <span className="text-[10px] text-amber-400 font-normal">{data.isWeekend ? 'Вихідний' : 'Будень'}</span>
          </div>
          <div className="space-y-1 text-neutral-300 text-[11px]">
            <div className="flex justify-between gap-3">
              <span className="text-neutral-400">Середній онлайн:</span>
              <span className="font-bold text-amber-400">~{data.activeUsers} чол.</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-neutral-400">Пікове вікно:</span>
              <span className="font-semibold text-white">{data.peakWindow}</span>
            </div>
            <div className="flex justify-between gap-3 text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/60">
              <span className="italic">«{data.topVibe}»</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex flex-col justify-end p-2 animate-in fade-in duration-200">
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 shadow-2xl flex flex-col max-h-[92%] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Активність у додатку
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live аналітика
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Коли найбільше людей шукають компанію в барах
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-analytics-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Status Highlight */}
        <div className="py-2 shrink-0">
          <div className="p-2.5 rounded-2xl bg-gradient-to-r from-neutral-950 via-neutral-950 to-amber-950/30 border border-amber-500/30 flex items-center justify-between gap-2 shadow-sm">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span>{insights.currentActivityStatus}</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-tight">
                {insights.recommendationTip}
              </p>
            </div>

            {onGoToHangouts && (
              <button
                type="button"
                id="analytics-go-hangouts-btn"
                onClick={() => {
                  sounds.playClink();
                  onClose();
                  onGoToHangouts();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1 shrink-0 shadow transition active:scale-95"
              >
                <span>Знайти</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 shrink-0 mb-2">
          <button
            type="button"
            id="analytics-tab-hourly"
            onClick={() => {
              sounds.playClink();
              setTab('hourly');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              tab === 'hourly'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>По годинах (24h)</span>
          </button>

          <button
            type="button"
            id="analytics-tab-daily"
            onClick={() => {
              sounds.playClink();
              setTab('daily');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              tab === 'daily'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>По днях тижня</span>
          </button>

          <button
            type="button"
            id="analytics-tab-drinks"
            onClick={() => {
              sounds.playClink();
              setTab('drinks');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              tab === 'drinks'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Beer className="w-3.5 h-3.5" />
            <span>Напої в пік</span>
          </button>
        </div>

        {/* Scrollable Chart & Insights Container */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-0.5">
          {/* Chart Display Area */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1">
                {tab === 'hourly' && '🕒 Графік пошуку компанії за добу'}
                {tab === 'daily' && '📅 Порівняння активності за днями'}
                {tab === 'drinks' && '🍻 Що пʼють у години піку'}
              </span>
              <span className="text-[10px] text-neutral-500">
                {tab === 'hourly' ? 'Пік: 19:00 – 22:30' : tab === 'daily' ? 'Пт-Сб: х2.5 людей' : 'Крафт лідирує'}
              </span>
            </div>

            {/* Recharts Component: Hourly Area Chart */}
            {tab === 'hourly' && (
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={HOURLY_ACTIVITY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      stroke="#737373"
                      fontSize={9}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      stroke="#737373"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomHourlyTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="activeUsers"
                      name="Активні користувачі"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#amberGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recharts Component: Daily Bar Chart */}
            {tab === 'daily' && (
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DAILY_ACTIVITY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis
                      dataKey="dayShort"
                      stroke="#737373"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#737373"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomDailyTooltip />} />
                    <Bar dataKey="activeUsers" radius={[6, 6, 0, 0]}>
                      {DAILY_ACTIVITY_DATA.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.dayShort === 'Пт' || entry.dayShort === 'Сб' ? '#f59e0b' : '#525252'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Drinks in Peak Hours */}
            {tab === 'drinks' && (
              <div className="py-2 space-y-2.5">
                {DRINKS_PEAK_DISTRIBUTION.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        <span>{item.emoji}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="font-bold text-amber-400">{item.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-neutral-950 p-2.5 rounded-2xl border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Золоті години</span>
              </div>
              <div className="text-sm font-bold text-white">19:00 – 22:30</div>
              <p className="text-[10px] text-neutral-500 leading-tight">
                98% відповідей за 3-5 хв, максимум відкритих столиків
              </p>
            </div>

            <div className="bg-neutral-950 p-2.5 rounded-2xl border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Найгарячіші дні</span>
              </div>
              <div className="text-sm font-bold text-white">Пʼятниця & Субота</div>
              <p className="text-[10px] text-neutral-500 leading-tight">
                До 920+ людей онлайн у барах Подолу та Рейтарської
              </p>
            </div>

            <div className="bg-neutral-950 p-2.5 rounded-2xl border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Швидкість метчу</span>
              </div>
              <div className="text-sm font-bold text-emerald-400">~ 4 хвилини</div>
              <p className="text-[10px] text-neutral-500 leading-tight">
                Середній час від публікації кличу до першого гостя
              </p>
            </div>

            <div className="bg-neutral-950 p-2.5 rounded-2xl border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Середа («Маленька пт»)</span>
              </div>
              <div className="text-sm font-bold text-white">18:30 – 22:00</div>
              <p className="text-[10px] text-neutral-500 leading-tight">
                Сплеск +65% серед тижня для спокійного крафту
              </p>
            </div>
          </div>

          {/* Useful Tips for Users */}
          <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-3 space-y-1.5">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1">
              💡 Як отримати максимум від додатку:
            </h4>
            <ul className="text-[11px] text-neutral-300 space-y-1 pl-1 list-disc list-inside">
              <li>
                <span className="font-semibold text-white">Кидайте клич о 17:30–18:30:</span> люди якраз закінчують роботу та обирають, куди піти.
              </li>
              <li>
                <span className="font-semibold text-white">Вмикайте Радар після 19:00:</span> у цей час навколо вас найбільша концентрація компанії на відстані до 1-2 км.
              </li>
              <li>
                <span className="font-semibold text-white">Субота з 16:00:</span> ідеально для посиденьок на терасах та денного крафту чи вина.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
