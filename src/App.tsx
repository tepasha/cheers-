import React, { useState, useEffect } from 'react';
import { ActiveTab, BuddyProfile, ChatThread, DeviceMode, HangoutAlert, Message, AuthUser, AppLanguage, GeoBlockInfo, PushNotificationItem } from './types';
import { INITIAL_BUDDIES, INITIAL_CHATS, INITIAL_HANGOUTS } from './data/mockData';
import { MobileFrame } from './components/mobile/MobileFrame';
import { BottomTabBar } from './components/mobile/BottomTabBar';
import { DiscoverView } from './components/mobile/DiscoverView';
import { MapView } from './components/mobile/MapView';
import { HangoutsView } from './components/mobile/HangoutsView';
import { ChatListView } from './components/mobile/ChatListView';
import { ChatRoomView } from './components/mobile/ChatRoomView';
import { ProfileView } from './components/mobile/ProfileView';
import { FriendsView } from './components/mobile/FriendsView';
import { AuthModal } from './components/mobile/AuthModal';
import { ArchitectureHub } from './components/architecture/ArchitectureHub';
import { RussiaBlockScreen } from './components/mobile/RussiaBlockScreen';
import { NotificationCenterModal } from './components/mobile/NotificationCenterModal';
import { 
  GamificationOnboardingTooltip, 
  useGamificationOnboarding 
} from './components/mobile/GamificationOnboardingTooltip';
import { sounds } from './services/soundService';
import { authService } from './services/authService';
import { firestoreSyncService } from './services/firestoreSyncService';
import { pushNotificationService } from './services/pushNotificationService';
import { friendsService } from './services/friendsService';
import {
  checkRussianTerritoryRestriction,
  detectLanguageFromGeo,
  saveAppLanguage,
  setSimulateRuBlock,
} from './services/i18nService';
import {
  UserGeoLocation,
  INITIAL_USER_LOCATION,
  calculateDistanceKm,
} from './services/geoService';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('fluid');
  const [userLocation, setUserLocation] = useState<UserGeoLocation>(INITIAL_USER_LOCATION);

  // App Language State (auto-detected by Geo & Browser, Russian strictly excluded)
  const [currentLanguage, setCurrentLanguage] = useState<AppLanguage>(() => {
    const detected = detectLanguageFromGeo(INITIAL_USER_LOCATION);
    return detected.lang;
  });
  const [langSourceHint, setLangSourceHint] = useState<string>(() => {
    const detected = detectLanguageFromGeo(INITIAL_USER_LOCATION);
    return detected.locationHint;
  });

  // Geoblocking State for Russian Federation
  const [geoBlockInfo, setGeoBlockInfo] = useState<GeoBlockInfo>(() =>
    checkRussianTerritoryRestriction(INITIAL_USER_LOCATION)
  );

  const [buddies, setBuddies] = useState<BuddyProfile[]>(() =>
    INITIAL_BUDDIES.map((b) => ({
      ...b,
      distanceKm: calculateDistanceKm(
        INITIAL_USER_LOCATION.lat,
        INITIAL_USER_LOCATION.lng,
        b.coordinates.lat,
        b.coordinates.lng
      ),
    }))
  );
  const [hangouts, setHangouts] = useState<HangoutAlert[]>(INITIAL_HANGOUTS);
  const [chats, setChats] = useState<ChatThread[]>(INITIAL_CHATS);
  const [selectedChat, setSelectedChat] = useState<ChatThread | null>(null);
  const [friendsCount, setFriendsCount] = useState<number>(() => friendsService.getFriendIds().length);

  // Subscribe to friends list updates
  useEffect(() => {
    const unsub = friendsService.subscribe((updatedFriends) => {
      setFriendsCount(updatedFriends.length);
    });
    return unsub;
  }, []);

  // Subscribe to realtime live Hangouts & bar check-ins from Cloud Firestore
  useEffect(() => {
    const unsub = firestoreSyncService.subscribeToLiveHangouts(
      userLocation,
      (syncedHangouts) => {
        setHangouts(syncedHangouts);
      }
    );
    return unsub;
  }, [userLocation]);

  // Update user coordinates and synchronize buddy distances across the app
  const handleUpdateLocation = (newLoc: UserGeoLocation) => {
    setUserLocation(newLoc);
    // Re-verify geo restrictions
    const check = checkRussianTerritoryRestriction(newLoc);
    setGeoBlockInfo(check);

    setBuddies((prev) =>
      prev.map((b) => ({
        ...b,
        distanceKm: calculateDistanceKm(
          newLoc.lat,
          newLoc.lng,
          b.coordinates.lat,
          b.coordinates.lng
        ),
      }))
    );
  };

  const handleLanguageChange = (lang: AppLanguage) => {
    setCurrentLanguage(lang);
    saveAppLanguage(lang);
    setLangSourceHint('Обрано вручну користувачем');
  };

  const handleDisableRuSimulation = () => {
    setSimulateRuBlock(false);
    setGeoBlockInfo(checkRussianTerritoryRestriction(userLocation));
  };

  // Auth state with Google OAuth provider support
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => authService.getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);

  // Push Notifications State & Web Notifications
  const [unreadNotifications, setUnreadNotifications] = useState<number>(() =>
    pushNotificationService.getUnreadCount()
  );
  const [activePushBanner, setActivePushBanner] = useState<PushNotificationItem | null>(() =>
    pushNotificationService.getActiveBanner()
  );
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  // New user gamification onboarding tooltip guide
  const {
    shouldShow: shouldShowGamificationTour,
    markSeen: handleCloseGamificationTour,
    reOpen: handleOpenGamificationTour,
  } = useGamificationOnboarding(1200);

  useEffect(() => {
    const unsubscribe = pushNotificationService.subscribe((list, banner) => {
      setUnreadNotifications(list.filter((n) => !n.isRead).length);
      setActivePushBanner(banner);
    });
    return unsubscribe;
  }, []);

  // Navigation handlers from Push Notifications
  const handleNavigateToHangout = (_hangoutId?: string, _venueName?: string) => {
    setActiveTab('hangouts');
    setSelectedChat(null);
  };

  const handleNavigateToChat = (chatId?: string, buddyId?: string) => {
    setActiveTab('chats');
    if (chatId) {
      const foundChat = chats.find((c) => c.id === chatId || c.buddy.id === buddyId);
      if (foundChat) {
        setSelectedChat(foundChat);
        return;
      }
    }
    if (buddyId) {
      const foundBuddy = buddies.find((b) => b.id === buddyId);
      if (foundBuddy) {
        handleOpenChatWithBuddy(foundBuddy);
        return;
      }
    }
    if (chats.length > 0) {
      setSelectedChat(chats[0]);
    }
  };

  // Quick Google Sign-In helper
  const handleGoogleQuickSignIn = async () => {
    try {
      const user = await authService.loginWithGoogle();
      setCurrentUser(user);
      sounds.playMatchCheer();
    } catch {
      // Fallback
    }
  };

  const handleLogout = () => {
    sounds.playClink();
    const guestUser = authService.logout();
    setCurrentUser(guestUser);
  };

  // Handle Match
  const handleMatch = (buddy: BuddyProfile) => {
    // Check if chat already exists
    const existingChat = chats.find((c) => c.buddy.id === buddy.id);
    if (!existingChat) {
      const newChat: ChatThread = {
        id: `chat-${buddy.id}`,
        buddy,
        lastMessage: 'У вас новий спільний келих! 🍻 Напишіть тост.',
        lastMessageTime: 'Щойно',
        unreadCount: 1,
        messages: [
          {
            id: `m-${Date.now()}`,
            chatId: `chat-${buddy.id}`,
            senderId: buddy.id,
            senderName: buddy.name,
            text: `Привіт! Радий співпадінню! За який бар сьогодні піднімемо келихи? 🍻`,
            timestamp: 'Щойно',
            isMe: false,
          },
        ],
      };
      setChats((prev) => [newChat, ...prev]);
    }
  };

  // Open Chat with Buddy directly
  const handleOpenChatWithBuddy = (buddy: BuddyProfile) => {
    sounds.playClink();
    let targetChat = chats.find((c) => c.buddy.id === buddy.id);
    if (!targetChat) {
      targetChat = {
        id: `chat-${buddy.id}`,
        buddy,
        lastMessage: 'Початок розмови...',
        lastMessageTime: 'Щойно',
        unreadCount: 0,
        messages: [
          {
            id: `m-init-${Date.now()}`,
            chatId: `chat-${buddy.id}`,
            senderId: buddy.id,
            senderName: buddy.name,
            text: `Привіт! Як настрій щодо зустрічі в барі? 🍻`,
            timestamp: 'Щойно',
            isMe: false,
          },
        ],
      };
      setChats((prev) => [targetChat!, ...prev]);
    }
    setSelectedChat(targetChat);
    setActiveTab('chats');
  };

  // Open chat from Hangouts by user name
  const handleOpenChatByName = (userName: string) => {
    const buddy = buddies.find((b) => b.name === userName) || buddies[0];
    handleOpenChatWithBuddy(buddy);
  };

  // Real-time Firestore encrypted messages listener for the active chat
  useEffect(() => {
    if (!selectedChat) return;

    const unsubscribe = firestoreSyncService.subscribeToEncryptedChat(
      selectedChat.id,
      currentUser.id,
      (incomingMsgs) => {
        if (!incomingMsgs || incomingMsgs.length === 0) return;

        setSelectedChat((prev) => {
          if (!prev || prev.id !== selectedChat.id) return prev;
          const existingIds = new Set(prev.messages.map((m) => m.id));
          const toAdd = incomingMsgs.filter((m) => !existingIds.has(m.id));
          if (toAdd.length === 0) return prev;

          const updatedMessages = [...prev.messages, ...toAdd];
          const latest = updatedMessages[updatedMessages.length - 1];
          return {
            ...prev,
            messages: updatedMessages,
            lastMessage: latest ? latest.text : prev.lastMessage,
            lastMessageTime: latest ? latest.timestamp : prev.lastMessageTime,
          };
        });

        // Also sync overall chats list
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id === selectedChat.id) {
              const existingIds = new Set(c.messages.map((m) => m.id));
              const toAdd = incomingMsgs.filter((m) => !existingIds.has(m.id));
              if (toAdd.length === 0) return c;
              const updatedMessages = [...c.messages, ...toAdd];
              const latest = updatedMessages[updatedMessages.length - 1];
              return {
                ...c,
                messages: updatedMessages,
                lastMessage: latest ? latest.text : c.lastMessage,
                lastMessageTime: latest ? latest.timestamp : c.lastMessageTime,
              };
            }
            return c;
          })
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedChat?.id, currentUser.id]);

  // Handle Send Message with End-to-End Encryption (E2EE) & Firestore Sync
  const handleSendMessage = (
    chatId: string,
    messageText: string,
    type: 'text' | 'cheers' | 'location_proposal' = 'text',
    proposalData?: Message['proposalData']
  ) => {
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      chatId,
      senderId: currentUser.id || 'me',
      senderName: currentUser.name,
      text: messageText,
      timestamp: timeString,
      isMe: true,
      type,
      proposalData,
      isEncrypted: true,
    };

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            lastMessage: type === 'cheers' ? `Тост: ${messageText}` : messageText,
            lastMessageTime: timeString,
            messages: [...c.messages, newMsg],
          };
        }
        return c;
      })
    );

    // Also update selectedChat if currently open
    setSelectedChat((prev) => {
      if (prev && prev.id === chatId) {
        return {
          ...prev,
          lastMessage: messageText,
          lastMessageTime: timeString,
          messages: [...prev.messages, newMsg],
        };
      }
      return prev;
    });

    // Encrypt client-side and synchronize directly to Cloud Firestore
    firestoreSyncService.sendEncryptedMessage(chatId, newMsg).then((encryptedDoc) => {
      if (encryptedDoc?.cipherPayload) {
        // Update local message instance with generated cipher payload for inspector
        setSelectedChat((prev) => {
          if (!prev || prev.id !== chatId) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === newMsg.id ? { ...m, cipherPayload: encryptedDoc.cipherPayload } : m
            ),
          };
        });
      }
    }).catch((err) => {
      console.warn('Firestore encrypted sync notice:', err);
    });
  };

  // Handle new Hangout / live check-in with Cloud Firestore broadcast
  const handleNewHangout = async (newHangout: HangoutAlert) => {
    // Optimistic local update
    setHangouts((prev) => [newHangout, ...prev.filter((h) => h.id !== newHangout.id)]);
    // Instant Firestore publication
    try {
      await firestoreSyncService.publishHangout(newHangout);
    } catch (err) {
      console.warn('Firestore publish notice:', err);
    }
  };

  const handleJoinHangout = async (hangoutId: string) => {
    const target = hangouts.find((h) => h.id === hangoutId);
    setHangouts((prev) =>
      prev.map((h) =>
        h.id === hangoutId ? { ...h, participantsCount: h.participantsCount + 1 } : h
      )
    );

    // Trigger push notification for table seat
    pushNotificationService.triggerTableSeatNotification({
      venueName: target?.barName || 'Squat 17b',
      guestName: 'Богдан',
      hangoutId,
    });

    try {
      await firestoreSyncService.joinLiveHangout(hangoutId, currentUser.id);
    } catch (err) {
      console.warn('Firestore join notice:', err);
    }
  };

  const handleCloseHangout = async (hangoutId: string) => {
    setHangouts((prev) => prev.filter((h) => h.id !== hangoutId));
    try {
      await firestoreSyncService.closeLiveHangout(hangoutId);
    } catch (err) {
      console.warn('Firestore close hangout notice:', err);
    }
  };

  const unreadTotal = chats.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <MobileFrame
      deviceMode={deviceMode}
      onDeviceChange={setDeviceMode}
      onOpenArchitecture={() => setIsArchitectureOpen(true)}
      currentUser={currentUser}
      onOpenAuth={() => setIsAuthModalOpen(true)}
      onOpenNotifications={() => setIsNotificationCenterOpen(true)}
      unreadNotificationsCount={unreadNotifications}
      activeBanner={activePushBanner}
      onNavigateToHangout={handleNavigateToHangout}
      onNavigateToChat={handleNavigateToChat}
    >
      {/* Screen Views based on active Tab */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'discover' && (
          <DiscoverView
            buddies={buddies}
            onMatch={handleMatch}
            onOpenChat={handleOpenChatWithBuddy}
          />
        )}

        {(activeTab === 'map' || activeTab === 'radar') && (
          <MapView
            buddies={buddies}
            userLocation={userLocation}
            onUpdateLocation={handleUpdateLocation}
            onSelectBuddy={(b) => handleOpenChatWithBuddy(b)}
            onOpenChat={handleOpenChatWithBuddy}
            onNewHangout={handleNewHangout}
            hangouts={hangouts}
            onJoinHangout={handleJoinHangout}
          />
        )}

        {activeTab === 'hangouts' && (
          <HangoutsView
            hangouts={hangouts}
            onJoinHangout={handleJoinHangout}
            onCloseHangout={handleCloseHangout}
            onOpenBuddyChat={handleOpenChatByName}
            buddies={buddies}
            onNewHangout={handleNewHangout}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            currentUserAvatar={currentUser.avatar}
            currentLocationName={userLocation.locationName}
            userLocation={userLocation}
            onNavigateToMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'friends' && (
          <FriendsView
            buddies={buddies}
            onOpenChat={handleOpenChatWithBuddy}
            onNavigateToDiscover={() => setActiveTab('discover')}
            onNavigateToMap={() => setActiveTab('map')}
            userLocation={userLocation}
          />
        )}

        {activeTab === 'chats' && (
          selectedChat ? (
            <ChatRoomView
              chat={selectedChat}
              onBack={() => setSelectedChat(null)}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <ChatListView
              chats={chats}
              onSelectChat={(c) => setSelectedChat(c)}
              onQuickDiscover={() => setActiveTab('discover')}
            />
          )
        )}

        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onLogout={handleLogout}
            onGoogleSignIn={handleGoogleQuickSignIn}
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
            langSourceHint={langSourceHint}
            userLocation={userLocation}
            onUpdateLocation={handleUpdateLocation}
            onOpenNotifications={() => setIsNotificationCenterOpen(true)}
            onOpenGamificationTour={handleOpenGamificationTour}
          />
        )}
      </div>

      {/* Persistent Bottom Tab Bar (hidden only when inside active chat room for more messaging space) */}
      {!(activeTab === 'chats' && selectedChat) && (
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            sounds.playClink();
            setSelectedChat(null);
            setActiveTab(tab);
          }}
          unreadCount={unreadTotal}
          activeHangoutsCount={hangouts.length}
          friendsCount={friendsCount}
          currentLanguage={currentLanguage}
          showGamificationTooltip={shouldShowGamificationTour}
        />
      )}

      {/* Russia Geoblock Overlay (Strict Sanction & Security Screen) */}
      {geoBlockInfo.isBlocked && (
        <RussiaBlockScreen
          geoBlockInfo={geoBlockInfo}
          onDisableSimulation={handleDisableRuSimulation}
        />
      )}

      {/* Firebase & Google Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
        }}
        onLogout={handleLogout}
      />

      {/* React Native & Expo + Firebase (Firestore & Auth) Architecture Hub */}
      <ArchitectureHub
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />

      {/* Push Notification Center & Live Simulator Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onNavigateToHangout={handleNavigateToHangout}
        onNavigateToChat={handleNavigateToChat}
      />

      {/* Interactive Onboarding Tooltip Guide for Points & Level System */}
      <GamificationOnboardingTooltip
        isOpen={shouldShowGamificationTour}
        onClose={handleCloseGamificationTour}
        onNavigateToProfile={() => {
          sounds.playClink();
          setActiveTab('profile');
          setSelectedChat(null);
        }}
      />
    </MobileFrame>
  );
}
