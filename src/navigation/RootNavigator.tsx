import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '../theme';
import { useT } from '../hooks/useT';
import { useAppSelector } from '../store/hooks';
import { selectFriendsCount, selectGeoBlock, selectUnreadChatsCount, selectHangouts } from '../store/selectors';
import type { RootStackParamList, TabParamList } from './types';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { MapScreen } from '../screens/MapScreen';
import { HangoutsScreen } from '../screens/HangoutsScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ToastsScreen } from '../screens/ToastsScreen';
import { BlockedUsersScreen } from '../screens/BlockedUsersScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { RussiaBlockScreen } from '../screens/RussiaBlockScreen';
import { GamificationTour } from '../components/GamificationTour';
import { useTr } from '../hooks/useT';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<keyof TabParamList, React.ComponentProps<typeof Feather>['name']> = {
  Discover: 'compass',
  Map: 'map',
  Hangouts: 'radio',
  Friends: 'users',
  Chats: 'message-circle',
  Profile: 'user',
};

const Tabs = () => {
  const t = useT();
  const unreadChats = useAppSelector(selectUnreadChatsCount);
  const friends = useAppSelector(selectFriendsCount);
  const hangouts = useAppSelector(selectHangouts).length;

  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.amber,
          tabBarInactiveTintColor: colors.textDim,
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
          tabBarBadgeStyle: { backgroundColor: colors.amber, color: colors.onAmber },
          tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS[route.name]} size={size - 2} color={color} />,
        })}
      >
        <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: t('tab_discover'), tabBarLabel: t('tab_discover') }} />
        <Tab.Screen name="Map" component={MapScreen} options={{ title: t('tab_map'), tabBarLabel: t('tab_map') }} />
        <Tab.Screen name="Hangouts" component={HangoutsScreen} options={{ title: t('tab_hangouts'), tabBarLabel: t('tab_hangouts'), tabBarBadge: badge(hangouts) }} />
        <Tab.Screen name="Friends" component={FriendsScreen} options={{ title: t('tab_friends'), tabBarLabel: t('tab_friends'), tabBarBadge: badge(friends) }} />
        <Tab.Screen name="Chats" component={ChatsScreen} options={{ title: t('tab_chats'), tabBarLabel: t('tab_chats'), tabBarBadge: badge(unreadChats) }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tab_profile'), tabBarLabel: t('tab_profile') }} />
      </Tab.Navigator>
      <GamificationTour />
    </>
  );
};

const headerOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  contentStyle: { backgroundColor: colors.bg },
};

/**
 * Flow: sanctioned-territory block  →  (wait for Firebase) →  sign-in  →  verify email  →  main app.
 * The block wins over everything, even for a signed-in user.
 */
export const RootNavigator = () => {
  const tr = useTr();
  const isLoggedIn = useAppSelector((s) => s.auth.user.isLoggedIn);
  const emailVerified = useAppSelector((s) => s.auth.user.emailVerified === true);
  const authReady = useAppSelector((s) => s.ui.authReady);
  const geoBlocked = useAppSelector(selectGeoBlock).isBlocked;

  if (geoBlocked) return <RussiaBlockScreen />;
  if (!authReady) {
    // Firebase is restoring the saved session; avoid flashing the sign-in form at a signed-in user
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }
  if (!isLoggedIn) return <AuthScreen />;
  if (!emailVerified) return <VerifyEmailScreen />;

  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: tr('Сповіщення'), presentation: 'modal' }} />
      <Stack.Screen name="Toasts" component={ToastsScreen} options={{ title: tr('Тости 🥂'), presentation: 'modal' }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: tr('Заблоковані') }} />
    </Stack.Navigator>
  );
};
