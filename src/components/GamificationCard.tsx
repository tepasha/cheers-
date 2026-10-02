import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Field, Row, SectionTitle, Sheet } from './ui';
import { colors, radius, spacing, typography } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectGamification, selectLevelProgress } from '../store/selectors';
import { recordCheckIn } from '../store/thunks/gamification';
import { pushNotification } from '../store/thunks/notifications';
import { LEVELS_CONFIG, getAchievementsWithStatus } from '../logic/gamification';
import { useTr } from '../hooks/useT';
import { ph } from '../services/i18nService';

export const XpBar = ({ percent }: { percent: number }) => (
  <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }}>
    <View style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', backgroundColor: colors.amber }} />
  </View>
);

export const XP_RULES: { label: string; xp: string }[] = [
  { label: ph('Візит у бар'), xp: '+100' },
  { label: ph('Приєднання до столика'), xp: '+80' },
  { label: ph('Тост «Будьмо!»'), xp: '+30' },
  { label: ph('Новий друг'), xp: '+50' },
  { label: ph('Запланована зустріч'), xp: '+75' },
];

export const GamificationCard = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectGamification);
  const progress = useAppSelector(selectLevelProgress);
  const [showDetails, setShowDetails] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [bar, setBar] = useState('');
  const [note, setNote] = useState('');

  const { currentLevel, nextLevel } = progress;
  const achievements = getAchievementsWithStatus(state.achievements);

  const submitCheckIn = () => {
    const result = dispatch(recordCheckIn({ barName: bar.trim(), note: note.trim() || undefined, type: 'bar_visit' }));
    dispatch(
      pushNotification({
        type: 'system',
        title: `🎉 +${result.earnedXp} XP!`,
        body: tr('Успішний чекін у «{bar}»', { bar: bar.trim() }),
        subtitle: result.didLevelUp ? tr('Новий рівень: {title} {badgeEmoji}', { title: result.newLevel.title, badgeEmoji: result.newLevel.badgeEmoji }) : result.unlockedAchievements.map((a) => `${a.icon} ${a.title}`).join(', ') || undefined,
      })
    );
    setBar('');
    setNote('');
    setShowCheckIn(false);
  };

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.heading}>
              {currentLevel.badgeEmoji} {tr('Рівень {level}: {title}', { level: currentLevel.level, title: tr(currentLevel.title) })}
            </Text>
            <Text style={typography.small}>{tr(currentLevel.perk)}</Text>
          </View>
          <Text style={[typography.title, { color: colors.amberSoft }]}>{state.xp} XP</Text>
        </Row>
        <XpBar percent={progress.progressPercent} />
        <Text style={typography.tiny}>
          {nextLevel ? tr('Ще {xpNeededForNextLevel} XP до «{title} {badgeEmoji}»', { xpNeededForNextLevel: progress.xpNeededForNextLevel, title: nextLevel.title, badgeEmoji: nextLevel.badgeEmoji }) : tr('Максимальний рівень досягнуто 👑')}
        </Text>
        <Row>
          <Button label={tr('Відмітити візит')} icon="map-pin" small onPress={() => setShowCheckIn(true)} style={{ flex: 1 }} />
          <Button label={tr('Досягнення')} icon="award" small variant="secondary" onPress={() => setShowDetails(true)} style={{ flex: 1 }} />
        </Row>
      </Card>

      <Sheet visible={showCheckIn} onClose={() => setShowCheckIn(false)} title={tr('Відмітити візит')} footer={<Button label={tr('Відмітити (+100 XP)')} icon="check" disabled={!bar.trim()} onPress={submitCheckIn} />}>
        <Field label={tr('ЗАКЛАД')} value={bar} onChangeText={setBar} placeholder={tr('Де ви зараз?')} />
        <Field label={tr('НОТАТКА')} value={note} onChangeText={setNote} multiline placeholder={tr('Як минув вечір?')} />
      </Sheet>

      <Sheet visible={showDetails} onClose={() => setShowDetails(false)} title={tr('Досягнення та рівні')}>
        <SectionTitle>{tr('Як заробляти XP')}</SectionTitle>
        <Card style={{ gap: 6 }}>
          {XP_RULES.map((r) => (
            <Row key={r.label} style={{ justifyContent: 'space-between' }}>
              <Text style={typography.body}>{tr(r.label)}</Text>
              <Badge label={`${r.xp} XP`} />
            </Row>
          ))}
        </Card>

        <SectionTitle>{tr('Досягнення')}</SectionTitle>
        <View style={{ gap: spacing.sm }}>
          {achievements.map((a) => (
            <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: a.isUnlocked ? 1 : 0.5 }}>
              <Text style={{ fontSize: 28 }}>{a.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{tr(a.title)}</Text>
                <Text style={typography.tiny}>{tr(a.description)}</Text>
              </View>
              <Badge label={a.isUnlocked ? '✓' : `+${a.xpReward}`} color={a.isUnlocked ? colors.green : colors.amberSoft} bg={a.isUnlocked ? colors.greenBg : colors.amberBg} />
            </Card>
          ))}
        </View>

        <SectionTitle>{tr('Рівні')}</SectionTitle>
        <View style={{ gap: 6 }}>
          {LEVELS_CONFIG.map((l) => (
            <Row key={l.level} style={{ justifyContent: 'space-between', opacity: l.level <= currentLevel.level ? 1 : 0.5 }}>
              <Text style={typography.body}>
                {l.badgeEmoji} {l.level}. {tr(l.title)}
              </Text>
              <Text style={typography.tiny}>{l.minXp} XP</Text>
            </Row>
          ))}
        </View>

        {state.checkIns.length > 0 && (
          <>
            <SectionTitle>{tr('Історія')}</SectionTitle>
            <View style={{ gap: spacing.sm }}>
              {state.checkIns.slice(0, 15).map((c) => (
                <Row key={c.id} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body}>{c.barName}</Text>
                    <Text style={typography.tiny}>
                      {tr(c.timestamp)}
                      {c.note ? ` • ${tr(c.note)}` : ''}
                    </Text>
                  </View>
                  <Badge label={`+${c.pointsEarned} XP`} />
                </Row>
              ))}
            </View>
          </>
        )}
      </Sheet>
    </>
  );
};
