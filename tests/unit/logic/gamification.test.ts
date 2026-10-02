import { describe, it, expect } from 'vitest';
import {
  ALL_ACHIEVEMENTS,
  EMPTY_GAMIFICATION_STATE,
  LEVELS_CONFIG,
  applyBonusXp,
  applyCheckIn,
  getAchievementsWithStatus,
  getLevelInfo,
} from '@/logic/gamification';

describe('getLevelInfo', () => {
  it('starts at level 1 with no next-level progress', () => {
    const info = getLevelInfo(0);
    expect(info.currentLevel.level).toBe(1);
    expect(info.nextLevel?.level).toBe(2);
    expect(info.progressPercent).toBe(0);
  });

  it('computes progress inside a level', () => {
    const info = getLevelInfo(150); // level 2 spans 100..300
    expect(info.currentLevel.level).toBe(2);
    expect(info.progressPercent).toBe(25);
    expect(info.xpNeededForNextLevel).toBe(150);
  });

  it('caps at the max level', () => {
    const top = LEVELS_CONFIG[LEVELS_CONFIG.length - 1];
    const info = getLevelInfo(top.minXp + 5000);
    expect(info.currentLevel.level).toBe(top.level);
    expect(info.nextLevel).toBeNull();
    expect(info.progressPercent).toBe(100);
  });
});

describe('applyCheckIn', () => {
  it('awards base XP plus the first-visit bonus for a new bar', () => {
    const r = applyCheckIn(EMPTY_GAMIFICATION_STATE, { barName: 'Squat 17b', type: 'bar_visit' }, 1);
    expect(r.earnedXp).toBe(125);
    expect(r.updatedState.totalMeetups).toBe(1);
    expect(r.updatedState.checkIns).toHaveLength(1);
  });

  it('does not give the explorer bonus for a repeat visit', () => {
    const first = applyCheckIn(EMPTY_GAMIFICATION_STATE, { barName: 'Win Bar', type: 'bar_visit' }, 1);
    const second = applyCheckIn(first.updatedState, { barName: 'win bar', type: 'bar_visit' }, 2);
    expect(second.earnedXp).toBe(100);
  });

  it('uses the per-type XP table', () => {
    const base = EMPTY_GAMIFICATION_STATE;
    expect(applyCheckIn(base, { barName: 'A', type: 'hangout_join' }).earnedXp).toBe(80);
    expect(applyCheckIn(base, { barName: 'A', type: 'cheers_toast' }).earnedXp).toBe(30);
    expect(applyCheckIn(base, { barName: 'A', type: 'meetup_proposal' }).earnedXp).toBe(90);
  });

  it('unlocks achievements once and adds their XP reward', () => {
    const r = applyCheckIn(EMPTY_GAMIFICATION_STATE, { barName: 'Squat 17b', area: 'Київ, Поділ', type: 'bar_visit' });
    const ids = r.unlockedAchievements.map((a) => a.id);
    expect(ids).toContain('first_checkin');
    expect(ids).toContain('podil_king');

    const reward = ALL_ACHIEVEMENTS.filter((a) => ids.includes(a.id)).reduce((s, a) => s + a.xpReward, 0);
    expect(r.updatedState.xp).toBe(125 + reward);

    const again = applyCheckIn(r.updatedState, { barName: 'Other', type: 'bar_visit' });
    expect(again.unlockedAchievements.map((a) => a.id)).not.toContain('first_checkin');
  });

  it('flags a level up', () => {
    const r = applyCheckIn({ ...EMPTY_GAMIFICATION_STATE, xp: 95 }, { barName: 'X', type: 'cheers_toast' });
    expect(r.didLevelUp).toBe(true);
    expect(r.newLevel.level).toBe(2);
  });

  it('does not mutate the input state', () => {
    const snapshot = JSON.stringify(EMPTY_GAMIFICATION_STATE);
    applyCheckIn(EMPTY_GAMIFICATION_STATE, { barName: 'X', type: 'bar_visit' });
    expect(JSON.stringify(EMPTY_GAMIFICATION_STATE)).toBe(snapshot);
  });
});

describe('applyBonusXp / achievements', () => {
  it('adds XP and updates level', () => {
    const r = applyBonusXp({ ...EMPTY_GAMIFICATION_STATE, xp: 80 }, 50);
    expect(r.updatedState.xp).toBe(130);
    expect(r.updatedState.level).toBe(2);
    expect(r.didLevelUp).toBe(true);
  });

  it('marks unlocked achievements', () => {
    const list = getAchievementsWithStatus(['first_checkin']);
    expect(list.find((a) => a.id === 'first_checkin')?.isUnlocked).toBe(true);
    expect(list.find((a) => a.id === 'toast_master')?.isUnlocked).toBe(false);
  });
});
