export type DrinkType = 
  | 'beer' 
  | 'craft' 
  | 'wine' 
  | 'cocktail' 
  | 'whiskey' 
  | 'cider' 
  | 'shots' 
  | 'non_alcoholic';

export type PaymentEtiquette = 
  | 'split_50_50' 
  | 'each_for_themselves' 
  | 'i_treat' 
  | 'rounds';

export type MoodType = 
  | 'chill_talk' 
  | 'coding_it' 
  | 'board_games' 
  | 'bar_crawl' 
  | 'sports_football' 
  | 'deep_philosophy' 
  | 'live_music';

export interface BuddyProfile {
  id: string;
  name: string;
  age: number;
  avatar: string;
  tagline: string;
  bio: string;
  locationName: string;
  distanceKm: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  preferredDrinks: DrinkType[];
  paymentRule: PaymentEtiquette;
  currentMood: MoodType;
  favoriteBars: string[];
  talkTopics: string[];
  online: boolean;
  activeCheckIn?: {
    barName: string;
    note: string;
    sinceTime: string;
  };
  level?: number;
  levelTitle?: string;
  totalCheckIns?: number;
  isFriend?: boolean;
  friendSince?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isMe: boolean;
  type?: 'text' | 'cheers' | 'location_proposal';
  isEncrypted?: boolean;
  cipherPayload?: string;
  isFromCache?: boolean;
  hasPendingWrites?: boolean;
  proposalData?: {
    barName: string;
    address: string;
    time: string;
    status: 'pending' | 'accepted' | 'declined';
  };
}

export interface ChatThread {
  id: string;
  buddy: BuddyProfile;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export interface HangoutAlert {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  barName: string;
  locationArea: string;
  drinkPreference: string;
  description: string;
  createdAt: string;
  slotsAvailable: number;
  participantsCount: number;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  distanceFormatted?: string;
  isLive?: boolean;
  status?: 'active' | 'closed';
  joinedUsers?: string[];
}

export interface MeetupParticipant {
  userId: string;
  userName: string;
  userAvatar: string;
  role: 'host' | 'member';
  status: 'going' | 'invited' | 'declined';
  joinedAt?: string;
}

export interface GroupMeetup {
  id: string;
  title: string;
  description: string;
  venueName: string;
  venueAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  dateTimeIso?: string;
  drinkPreference?: string;
  maxParticipants: number;
  participants: MeetupParticipant[];
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
  lat?: number;
  lng?: number;
  distanceKm?: number;
  distanceFormatted?: string;
  createdAt: string;
  topicTag?: string;
}

export interface FilterSettings {
  maxDistance: number;
  drinks: DrinkType[];
  moods: MoodType[];
  paymentRules: PaymentEtiquette[];
  interests: string[];
  searchQuery?: string;
}

export type ActiveTab = 'discover' | 'map' | 'radar' | 'hangouts' | 'friends' | 'chats' | 'profile';

export type DeviceMode = 'iphone' | 'android' | 'fluid';

export type AppLanguage = 'uk' | 'en' | 'pl' | 'de';

export interface LanguageMeta {
  code: AppLanguage;
  name: string;
  nativeName: string;
  flag: string;
  regionHint: string;
}

export interface GeoBlockInfo {
  isBlocked: boolean;
  reason: string;
  detectedCountry?: string;
  detectedTimezone?: string;
  isSimulated?: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'email' | 'guest';
  googleId?: string;
  isLoggedIn: boolean;
  accessToken?: string;
  joinedAt?: string;
  emailVerified?: boolean;
}

export interface FavoriteVenueItem {
  id: string;
  name: string;
  area: string;
  category: string;
  lat: number;
  lng: number;
  comment?: string;
  createdAt?: string;
}

export type PushNotificationType = 
  | 'table_seat' 
  | 'chat_message' 
  | 'cheers_toast' 
  | 'hangout_alert'
  | 'friend_added'
  | 'meetup_invite'
  | 'meetup_joined'
  | 'safety_alert'
  | 'system';

export interface PushNotificationItem {
  id: string;
  type: PushNotificationType;
  title: string;
  body: string;
  subtitle?: string;
  timestamp: string;
  createdAt: number;
  avatar?: string;
  venueName?: string;
  chatId?: string;
  buddyId?: string;
  buddyName?: string;
  hangoutId?: string;
  isRead?: boolean;
  actionUrl?: string;
  actionText?: string;
}

export interface PushNotificationSettings {
  soundEnabled: boolean;
  bannerEnabled: boolean;
  webPushEnabled: boolean;
  vibrateEnabled: boolean;
}

export interface UserLevelInfo {
  level: number;
  title: string;
  badgeEmoji: string;
  minXp: number;
  maxXp: number;
  perk: string;
}

export interface UserCheckInRecord {
  id: string;
  barName: string;
  area: string;
  timestamp: string;
  pointsEarned: number;
  note?: string;
  buddyName?: string;
  type: 'bar_visit' | 'hangout_join' | 'cheers_toast' | 'meetup_proposal';
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  isUnlocked: boolean;
  xpReward: number;
}

export interface UserGamificationState {
  xp: number;
  level: number;
  totalMeetups: number;
  checkIns: UserCheckInRecord[];
  achievements: string[];
}

export type ReportCategory =
  | 'harassment'
  | 'suspicious'
  | 'inappropriate_content'
  | 'underage'
  | 'toxic_behavior'
  | 'spam'
  | 'other';

export type ReportTargetType = 'profile' | 'hangout' | 'checkin' | 'chat' | 'group_meetup';

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetId: string;
  targetType: ReportTargetType;
  targetName: string;
  targetAvatar?: string;
  category: ReportCategory;
  categoryTitle: string;
  comment: string;
  timestamp: string;
  createdAt: number;
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface BlockedUserRecord {
  userId: string;
  userName: string;
  userAvatar?: string;
  blockedAt: string;
  reason?: string;
  autoBlocked?: boolean;
}


