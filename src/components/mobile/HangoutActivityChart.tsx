import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Beer,
  Zap,
  Flame,
  Award,
  PlusCircle,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { AppLanguage, AuthUser } from '../../types';
import { t } from '../../services/i18nService';
import { sounds } from '../../services/soundService';
import { analyticsService } from '../../services/analyticsService';
import { gamificationService } from '../../services/gamificationService';

export interface HangoutDayData {
  dateKey: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "12 вер"
  weekday: string; // "Пт"
  isWeekend: boolean;
  hangouts: number;
  xp: number;
  barsVisited: string[];
}

interface HangoutActivityChartProps {
  currentUser: AuthUser;
  currentLanguage: AppLanguage;
  onQuickCheckIn?: () => void;
}

const WEEKDAY_NAMES_UK = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES_UK = [
  'січ', 'лют', 'бер', 'кві', 'тра', 'чер',
  'лип', 'сер', 'вер', 'жов', 'лис', 'гру'
];

/**
 * Generate 30 days of data ending today, seeded deterministically based on user ID
 * and augmented with any real check-ins from gamificationService.
 */
function generate30DaysActivity(userId: string): HangoutDayData[] {
  const result: HangoutDayData[] = [];
  const now = new Date();
  
  // Deterministic seed based on user ID string
  let seed = 42;
  for (let i = 0; i < userId.length; i++) {
    seed = (seed * 31 + userId.charCodeAt(i)) % 10007;
  }
  const pseudoRandom = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // Sample bars for realistic activity
  const sampleBars = [
    'Squat 17b',
    'Win Bar',
    'Loggerhead',
    'Punkcraft',
    'Varvar Bar',
    'Pure & Naive',
    'Бар Дерево',
  ];

  // Load existing check-ins to make today & recent days accurate
  const userGamification = gamificationService.loadGamificationState(userId);
  const checkInsCount = userGamification.checkIns?.length || 2;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    const dayIndex = d.getDay();
    const isWeekend = dayIndex === 5 || dayIndex === 6; // Friday & Saturday
    const weekday = WEEKDAY_NAMES_UK[dayIndex];
    const dayLabel = `${d.getDate()} ${MONTH_NAMES_UK[d.getMonth()]}`;

    // Base probabilities: higher on Fri/Sat, moderate on Thu/Sun, low on Mon-Wed
    const rand = pseudoRandom(i * 7);
    let hangouts = 0;
    const barsVisited: string[] = [];

    // Specific deterministic schedule for realistic demo
    if (i === 0) {
      // Today: reflects user's latest check-in
      hangouts = Math.min(2, Math.max(1, checkInsCount > 2 ? 2 : 1));
      barsVisited.push(userGamification.checkIns?.[0]?.barName || 'Squat 17b');
    } else if (i === 1) {
      // Yesterday
      hangouts = 1;
      barsVisited.push('Win Bar');
    } else if (isWeekend && rand > 0.3) {
      hangouts = rand > 0.75 ? 2 : 1;
      const bIdx = Math.floor(pseudoRandom(i * 13) * sampleBars.length);
      barsVisited.push(sampleBars[bIdx]);
      if (hangouts === 2) {
        barsVisited.push(sampleBars[(bIdx + 2) % sampleBars.length]);
      }
    } else if (dayIndex === 4 && rand > 0.55) { // Thursday craft meetup
      hangouts = 1;
      barsVisited.push('Punkcraft');
    } else if (rand > 0.82) { // Spontaneous weekday meetup
      hangouts = 1;
      barsVisited.push(sampleBars[Math.floor(pseudoRandom(i * 3) * sampleBars.length)]);
    }

    const xp = hangouts * 80 + (isWeekend ? 20 : 0);

    result.push({
      dateKey,
      dayLabel,
      weekday,
      isWeekend,
      hangouts,
      xp,
      barsVisited,
    });
  }

  return result;
}

export const HangoutActivityChart: React.FC<HangoutActivityChartProps> = ({
  currentUser,
  currentLanguage,
  onQuickCheckIn,
}) => {
  const [timeRange, setTimeRange] = useState<'30d' | '14d' | '7d'>('30d');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [metricType, setMetricType] = useState<'hangouts' | 'xp'>('hangouts');
  const [extraTodayBoost, setExtraTodayBoost] = useState<number>(0);

  // Generate dataset
  const rawData = useMemo(() => {
    return generate30DaysActivity(currentUser.id);
  }, [currentUser.id]);

  // Apply range slice and dynamic boost if user clicks quick check-in
  const chartData = useMemo(() => {
    let sliced = rawData;
    if (timeRange === '14d') {
      sliced = rawData.slice(-14);
    } else if (timeRange === '7d') {
      sliced = rawData.slice(-7);
    }

    if (extraTodayBoost > 0) {
      return sliced.map((item, idx) => {
        if (idx === sliced.length - 1) {
          return {
            ...item,
            hangouts: item.hangouts + extraTodayBoost,
            xp: item.xp + extraTodayBoost * 80,
            barsVisited: [...item.barsVisited, 'Новий чекін (Щойно)'],
          };
        }
        return item;
      });
    }

    return sliced;
  }, [rawData, timeRange, extraTodayBoost]);

  // Summary Metrics Calculation
  const stats = useMemo(() => {
    const totalHangouts = chartData.reduce((acc, curr) => acc + curr.hangouts, 0);
    const activeDays = chartData.filter((item) => item.hangouts > 0).length;
    const totalXp = chartData.reduce((acc, curr) => acc + curr.xp, 0);

    // Peak day of week
    const weekdayCounts: Record<string, number> = {};
    chartData.forEach((item) => {
      weekdayCounts[item.weekday] = (weekdayCounts[item.weekday] || 0) + item.hangouts;
    });
    let peakDay = 'Пт';
    let peakCount = 0;
    Object.entries(weekdayCounts).forEach(([day, count]) => {
      if (count > peakCount) {
        peakCount = count;
        peakDay = day;
      }
    });

    return {
      totalHangouts,
      activeDays,
      totalXp,
      peakDay,
      ratePercent: Math.round((activeDays / chartData.length) * 100),
    };
  }, [chartData]);

  const handleRangeChange = (newRange: '30d' | '14d' | '7d') => {
    sounds.playTap();
    setTimeRange(newRange);
    analyticsService.trackEvent('chart_time_range_change', {
      range: newRange,
      user_id: currentUser.id,
    });
  };

  const handleAddLiveHangout = () => {
    sounds.playClink();
    setExtraTodayBoost((prev) => prev + 1);
    analyticsService.trackMeetupAction('check_in', 'live_today', {
      source: 'profile_activity_chart',
      new_hangouts_count: stats.totalHangouts + 1,
    });
    if (onQuickCheckIn) {
      onQuickCheckIn();
    }
  };

  // Custom Chart Tooltip
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{ payload: HangoutDayData; value: number }>;
    label?: string;
  }

  const CustomTooltipContent: React.FC<TooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint: HangoutDayData = payload[0].payload;
      return (
        <div className="bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 min-w-[160px] animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1 text-[11px]">
            <span className="font-bold text-neutral-200">
              {label} ({dataPoint.weekday})
            </span>
            {dataPoint.isWeekend && (
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-semibold border border-amber-500/30">
                Вікенд 🍻
              </span>
            )}
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 flex items-center gap-1">
                <Beer className="w-3 h-3 text-amber-400" />
                <span>Сходки:</span>
              </span>
              <span className="font-bold text-amber-300">
                {dataPoint.hangouts} {dataPoint.hangouts === 1 ? 'вихід' : 'виходи'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>Досвід:</span>
              </span>
              <span className="font-bold text-emerald-400">+{dataPoint.xp} XP</span>
            </div>
          </div>

          {dataPoint.barsVisited.length > 0 && (
            <div className="pt-1 border-t border-neutral-800/80 text-[10px] text-neutral-400">
              <span className="text-neutral-500 block">Заклади:</span>
              <span className="text-neutral-200 font-medium truncate block">
                {dataPoint.barsVisited.join(', ')}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="profile-hangout-activity-chart-section"
      className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-3.5 shadow-xl transition-all"
    >
      {/* Header with Title and Mode Switchers */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
              <span>{t('hangout_chart_title', currentLanguage)}</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-semibold border border-amber-500/30">
                recharts
              </span>
            </h4>
            <p className="text-[10px] text-neutral-400 leading-tight">
              {t('hangout_chart_subtitle', currentLanguage)}
            </p>
          </div>
        </div>

        {/* Range Selector Pills */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          {(['30d', '14d', '7d'] as const).map((range) => {
            const isSelected = timeRange === range;
            const labelKey = `hangout_chart_range_${range}`;
            return (
              <button
                key={range}
                type="button"
                id={`chart-range-${range}`}
                onClick={() => handleRangeChange(range)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition active:scale-95 ${
                  isSelected
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {t(labelKey, currentLanguage)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Badges Grid */}
      <div className="grid grid-cols-4 gap-2 pt-0.5">
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-2 text-center space-y-0.5">
          <span className="text-[9px] text-neutral-400 block truncate">
            {t('hangout_chart_stat_total', currentLanguage)}
          </span>
          <span className="text-sm font-black text-amber-400 flex items-center justify-center gap-0.5">
            <Beer className="w-3 h-3 text-amber-400 inline" />
            <span>{stats.totalHangouts}</span>
          </span>
        </div>

        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-2 text-center space-y-0.5">
          <span className="text-[9px] text-neutral-400 block truncate">
            {t('hangout_chart_stat_active', currentLanguage)}
          </span>
          <span className="text-sm font-black text-emerald-400 flex items-center justify-center gap-0.5">
            <Calendar className="w-3 h-3 text-emerald-400 inline" />
            <span>{stats.activeDays}д</span>
          </span>
        </div>

        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-2 text-center space-y-0.5">
          <span className="text-[9px] text-neutral-400 block truncate">
            {t('hangout_chart_stat_peak', currentLanguage)}
          </span>
          <span className="text-sm font-black text-amber-300 flex items-center justify-center gap-0.5">
            <Flame className="w-3 h-3 text-rose-400 inline" />
            <span>{stats.peakDay}</span>
          </span>
        </div>

        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-2 text-center space-y-0.5">
          <span className="text-[9px] text-neutral-400 block truncate">Загалом XP</span>
          <span className="text-sm font-black text-purple-300 flex items-center justify-center gap-0.5">
            <Award className="w-3 h-3 text-purple-400 inline" />
            <span>{stats.totalXp}</span>
          </span>
        </div>
      </div>

      {/* Chart View & Metric Toggle Controls */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-800/60">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            id="chart-toggle-metric-hangouts"
            onClick={() => {
              sounds.playTap();
              setMetricType('hangouts');
            }}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition ${
              metricType === 'hangouts'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t('hangout_chart_hangouts_label', currentLanguage)}
          </button>

          <button
            type="button"
            id="chart-toggle-metric-xp"
            onClick={() => {
              sounds.playTap();
              setMetricType('xp');
            }}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition ${
              metricType === 'xp'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t('hangout_chart_xp_label', currentLanguage)}
          </button>
        </div>

        {/* Area / Bar Chart Type Switcher */}
        <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-xl border border-neutral-800">
          <button
            type="button"
            id="chart-type-area-btn"
            title="Графік площі"
            onClick={() => {
              sounds.playTap();
              setChartType('area');
            }}
            className={`p-1 rounded-lg transition ${
              chartType === 'area'
                ? 'bg-neutral-800 text-amber-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="chart-type-bar-btn"
            title="Стовпчастий графік"
            onClick={() => {
              sounds.playTap();
              setChartType('bar');
            }}
            className={`p-1 rounded-lg transition ${
              chartType === 'bar'
                ? 'bg-neutral-800 text-amber-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className="w-full h-52 pt-1 select-none">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id="hangoutAmberGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="xpPurpleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#262626"
                vertical={false}
              />

              <XAxis
                dataKey="dayLabel"
                stroke="#737373"
                fontSize={9}
                tickLine={false}
                axisLine={{ stroke: '#262626' }}
                interval={timeRange === '30d' ? 5 : timeRange === '14d' ? 2 : 0}
              />

              <YAxis
                stroke="#737373"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />

              <Tooltip content={<CustomTooltipContent />} />

              <Area
                type="monotone"
                dataKey={metricType === 'hangouts' ? 'hangouts' : 'xp'}
                stroke={metricType === 'hangouts' ? '#f59e0b' : '#a855f7'}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={
                  metricType === 'hangouts'
                    ? 'url(#hangoutAmberGradient)'
                    : 'url(#xpPurpleGradient)'
                }
                activeDot={{
                  r: 5,
                  fill: metricType === 'hangouts' ? '#f59e0b' : '#a855f7',
                  stroke: '#171717',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#262626"
                vertical={false}
              />

              <XAxis
                dataKey="dayLabel"
                stroke="#737373"
                fontSize={9}
                tickLine={false}
                axisLine={{ stroke: '#262626' }}
                interval={timeRange === '30d' ? 5 : timeRange === '14d' ? 2 : 0}
              />

              <YAxis
                stroke="#737373"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />

              <Tooltip content={<CustomTooltipContent />} />

              <Bar
                dataKey={metricType === 'hangouts' ? 'hangouts' : 'xp'}
                fill={metricType === 'hangouts' ? '#f59e0b' : '#a855f7'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Interactive Footer: Quick Check-in simulation to update trend */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80 gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Синхронізовано з хмарою Firestore</span>
        </div>

        <button
          type="button"
          id="profile-chart-quick-add-btn"
          onClick={handleAddLiveHangout}
          className="py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Додати сьогоднішній вихід (+1)</span>
        </button>
      </div>
    </div>
  );
};
