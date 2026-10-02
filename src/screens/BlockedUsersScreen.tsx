import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, EmptyState, Row } from '../components/ui';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectBlockedUsers } from '../store/selectors';
import { unblockUser } from '../store/thunks/safety';
import { useTr } from '../hooks/useT';

export const BlockedUsersScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const blocked = useAppSelector(selectBlockedUsers);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <FlatList
        data={blocked}
        keyExtractor={(u) => u.userId}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState emoji="🛡️" title={tr('Список порожній')} subtitle={tr('Заблоковані користувачі зникають з пошуку, кличів і чатів.')} />}
        renderItem={({ item }) => (
          <Card>
            <Row style={{ gap: spacing.md }}>
              <Avatar uri={item.userAvatar} name={item.userName} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={typography.heading}>{item.userName}</Text>
                <Text style={typography.tiny}>
                  {item.reason || tr('Заблоковано')} • {item.blockedAt}
                </Text>
                {item.autoBlocked && <Badge label={tr('Авто-блокування')} color={colors.red} bg={colors.redBg} />}
              </View>
              <Button label={tr('Розблокувати')} small variant="secondary" onPress={() => dispatch(unblockUser(item.userId))} />
            </Row>
          </Card>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
