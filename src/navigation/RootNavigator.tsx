import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '../theme';
import { useT } from '../hooks/useT';
import { useAppSelector } from '../store/hooks';
import { selectCanUseApp, selectFriendsCount, selectGeoBlock, selectUnreadChatsCount, selectHangouts } from '../store/selectors';
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
import { BirthDateScreen } from '../screens/BirthDateScreen';
import { checkAge } from '../logic/session';
import { GamificationTour } from '../components/GamificationTour';
import { AdBanner } from '../components/AdBanner';
import { useTr } from '../hooks/useT';
import { Button } from '../components/ui';
import { useAppDispatch } from '../store/hooks';
import { auth } from '../services/firebase';
import { handleFirebaseUser, logout } from '../store/thunks/auth';

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

/** The map's own controls sit at the bottom edge; a banner there would invite accidental taps */
const TABS_WITHOUT_ADS: ReadonlySet<string> = new Set<keyof TabParamList>(['Map']);

const Tabs = () => {
  const t = useT();
  const unreadChats = useAppSelector(selectUnreadChatsCount);
  const friends = useAppSelector(selectFriendsCount);
  const hangouts = useAppSelector(selectHangouts).length;

  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => (
          <>
            <AdBanner visible={!TABS_WITHOUT_ADS.has(props.state.routes[props.state.index].name)} />
            <BottomTabBar {...props} />
          </>
        )}
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

const Splash = () => (
  <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={colors.amber} />
  </View>
);

/**
 * Flow: sanctioned-territory block  →  (wait for Firebase) →  sign-in  →  verify email  →  birth date (if unknown)  →  main app.
 * The block wins over everything, even for a signed-in user.
 */
export const RootNavigator = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const authError = useAppSelector((s) => s.ui.authError);
  const authOperation = useAppSelector((s) => s.ui.authOperation);
  const serverEligible = useAppSelector((s) => s.auth.user.serverEligible);
  const isLoggedIn = useAppSelector((s) => s.auth.user.isLoggedIn);
  const emailVerified = useAppSelector((s) => s.auth.user.emailVerified === true);
  const authReady = useAppSelector((s) => s.ui.authReady);
  const canUseApp = useAppSelector(selectCanUseApp);
  const birthDate = useAppSelector((s) => s.auth.user.birthDate);
  const birthDateChecked = useAppSelector((s) => s.auth.birthDateChecked);
  const geoBlocked = useAppSelector(selectGeoBlock).isBlocked;

  if (geoBlocked) return <RussiaBlockScreen />;
  // Firebase is restoring the saved session; avoid flashing the sign-in form at a signed-in user
  if (!authReady) return <Splash />;
  if (!isLoggedIn || authOperation) return <AuthScreen />;
  if (authError) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: colors.bg }}><Text style={{ color: colors.text }}>{tr('Не вдалося виконати дію. Спробуйте пізніше')}</Text><Button label={tr('Повторити')} onPress={() => dispatch(handleFirebaseUser(auth.currentUser))} /><Button label={tr('Вийти')} variant="secondary" onPress={() => dispatch(logout())} /></View>;
  if (!emailVerified) return <VerifyEmailScreen />;
  if (!canUseApp) {
    if (serverEligible === false && birthDateChecked) return <BirthDateScreen />;
    // Verified, but the age is not confirmed. Nothing of the app is shown (and nothing is published: see
    // selectCanUseApp) until it is. Not asked yet -> look it up, then ask; under 21 -> the account is being removed.
    if (!birthDate) return birthDateChecked ? <BirthDateScreen /> : <Splash />;
    return checkAge(birthDate) === 'invalid' ? <BirthDateScreen /> : <Splash />;
  }

  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} getId={({ params }) => params.chatId} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: tr('Сповіщення'), presentation: 'modal' }} />
      <Stack.Screen name="Toasts" component={ToastsScreen} options={{ title: tr('Тости 🥂'), presentation: 'modal' }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: tr('Заблоковані') }} />
    </Stack.Navigator>
  );
};
