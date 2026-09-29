import React, { useState, useRef } from 'react';
import { 
  Beer, 
  MapPin, 
  ShieldCheck, 
  LogOut, 
  Save, 
  Check, 
  Globe, 
  Ban, 
  Navigation,
  Locate,
  CheckCircle2,
  Search,
  Bell,
  UserX,
  LifeBuoy,
  Zap,
  BatteryMedium,
  Pencil,
  X,
  Calendar,
  Heart,
  Headphones,
  ExternalLink,
  Copy,
  Send,
  MessageSquare,
  Sparkles,
  Camera,
  Upload,
} from 'lucide-react';
import { DrinkType, PaymentEtiquette, AuthUser, AppLanguage } from '../../types';
import { DRINK_METADATA, PAYMENT_METADATA } from '../../data/mockData';
import { sounds } from '../../services/soundService';
import { SUPPORTED_LANGUAGES, t } from '../../services/i18nService';
import { calculateAge, formatAgeWithUnit, formatBirthDateUkrainian } from '../../utils/ageUtils';
import { 
  UserGeoLocation, 
  PRESET_LOCATIONS, 
  PresetLocation 
} from '../../services/geoService';
import { GeoCoordinateMapPicker } from './GeoCoordinateMapPicker';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { GamificationProgressCard } from './GamificationProgressCard';
import { safetyModerationService } from '../../services/safetyModerationService';
import { batterySaverService } from '../../services/batterySaverService';
import { analyticsService } from '../../services/analyticsService';
import { BlockedUsersModal } from './BlockedUsersModal';
import { SosEmergencyModal } from './SosEmergencyModal';
import { authService } from '../../services/authService';

export interface AvatarPreset {
  id: string;
  name: string;
  category: 'urban' | 'bar' | 'cocktail';
  url: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'p1', name: 'Крафтовий поціновувач', category: 'bar', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80' },
  { id: 'p2', name: 'Винний сомельє', category: 'urban', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80' },
  { id: 'p3', name: 'Барний завсідник', category: 'bar', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80' },
  { id: 'p4', name: 'Коктейльна душа', category: 'cocktail', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80' },
  { id: 'p5', name: 'Хопхед', category: 'bar', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80' },
  { id: 'p6', name: 'Пабний інтелектуал', category: 'urban', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500&auto=format&fit=crop&q=80' },
  { id: 'p7', name: 'Сидровий романтик', category: 'cocktail', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80' },
  { id: 'p8', name: 'Енергійний рейвер', category: 'urban', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=80' },
  { id: 'p9', name: 'Затишний бадді', category: 'cocktail', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80' },
  { id: 'p10', name: 'Київський крафтяр', category: 'bar', url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=500&auto=format&fit=crop&q=80' },
  { id: 'p11', name: 'Львівський батяр', category: 'urban', url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&auto=format&fit=crop&q=80' },
  { id: 'p12', name: 'Харківський олдбой', category: 'bar', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop&q=80' },
];

interface ProfileViewProps {
  currentUser: AuthUser;
  onOpenAuth: () => void;
  onLogout: () => void;
  onGoogleSignIn: () => void;
  currentLanguage: AppLanguage;
  onLanguageChange: (lang: AppLanguage) => void;
  langSourceHint: string;
  userLocation: UserGeoLocation;
  onUpdateLocation: (newLoc: UserGeoLocation) => void;
  onOpenNotifications?: () => void;
  onOpenGamificationTour?: () => void;
  onUpdateUser?: (user: AuthUser) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onGoogleSignIn,
  currentLanguage,
  onLanguageChange,
  langSourceHint,
  userLocation,
  onUpdateLocation,
  onOpenNotifications,
  onOpenGamificationTour,
  onUpdateUser,
}) => {
  const [userName, setUserName] = useState(currentUser.name || 'Павло');
  const [userAvatar, setUserAvatar] = useState(currentUser.avatar || AVATAR_PRESETS[0].url);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(currentUser.avatar || AVATAR_PRESETS[0].url);
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [avatarCategory, setAvatarCategory] = useState<'presets' | 'upload' | 'custom'>('presets');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingNameInline, setIsEditingNameInline] = useState(false);
  const [tagline, setTagline] = useState('React Native розробник, шукаю компанію на крафтове пиво або вино 🍺🍷');
  const [preferredDrinks, setPreferredDrinks] = useState<DrinkType[]>(['craft', 'wine', 'cider']);
  const [paymentRule, setPaymentRule] = useState<PaymentEtiquette>('split_50_50');
  const [isSaved, setIsSaved] = useState(false);

  // Date of Birth & Dynamic Age Calculation State
  const [birthDate, setBirthDate] = useState<string>(currentUser.birthDate || '1998-05-15');
  const [calculatedAge, setCalculatedAge] = useState<number | null>(() =>
    calculateAge(currentUser.birthDate || '1998-05-15')
  );

  React.useEffect(() => {
    if (currentUser.birthDate) {
      setBirthDate(currentUser.birthDate);
      setCalculatedAge(calculateAge(currentUser.birthDate));
    }
    if (currentUser.avatar) {
      setUserAvatar(currentUser.avatar);
      setSelectedAvatarUrl(currentUser.avatar);
    }
  }, [currentUser.birthDate, currentUser.avatar]);

  const handleBirthDateChange = (newDate: string) => {
    setBirthDate(newDate);
    const age = calculateAge(newDate);
    setCalculatedAge(age);
  };

  const handleSaveBirthDate = (newDate?: string) => {
    const targetDate = newDate || birthDate;
    const age = calculateAge(targetDate);
    if (!targetDate) return;
    sounds.playClink();
    const updatedUser: AuthUser = {
      ...currentUser,
      birthDate: targetDate,
      age: age ?? currentUser.age,
    };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    authService.saveUser(updatedUser);
    firestoreSyncService.saveUserProfile({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      tagline,
      paymentRule,
      preferredDrinks,
      locationName: userLocation.locationName,
      lat: userLocation.lat,
      lng: userLocation.lng,
      updatedAt: new Date().toISOString(),
      birthDate: targetDate,
      age: age ?? undefined,
    });
    setGeoNotification(
      age !== null
        ? `🎂 Дату народження збережено! Вік: ${formatAgeWithUnit(age)}`
        : '🎂 Дату народження збережено!'
    );
    setTimeout(() => setGeoNotification(null), 3500);
  };

  React.useEffect(() => {
    setUserName(currentUser.name || '');
  }, [currentUser.name]);

  // Geolocation & District Management States
  const [geoNotification, setGeoNotification] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [locationTab, setLocationTab] = useState<'presets' | 'custom'>('presets');
  const [searchDistrict, setSearchDistrict] = useState('');

  // Safety & Moderation States
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [blockedUsersCount, setBlockedUsersCount] = useState(() => safetyModerationService.getBlockedUsers().length);
  const [reportsCount, setReportsCount] = useState(() => safetyModerationService.getReports().length);

  // Battery Saver Mode State
  const [isBatterySaver, setIsBatterySaver] = useState(() => batterySaverService.isBatterySaverEnabled());

  React.useEffect(() => {
    const unsubSafety = safetyModerationService.subscribe(() => {
      setBlockedUsersCount(safetyModerationService.getBlockedUsers().length);
      setReportsCount(safetyModerationService.getReports().length);
    });
    const unsubBattery = batterySaverService.subscribe((enabled) => {
      setIsBatterySaver(enabled);
    });
    return () => {
      unsubSafety();
      unsubBattery();
    };
  }, []);

  const handleToggleBatterySaver = () => {
    sounds.playTap();
    const nextState = batterySaverService.toggle();
    setIsBatterySaver(nextState);
    analyticsService.trackBatterySaver(nextState);
    if (nextState) {
      setGeoNotification('⚡ Режим Battery Saver активовано: опитування GPS (90с) та оновлення (60с)');
    } else {
      setGeoNotification('🔋 Стандартний режим: висока точність GPS (15с) та Live оновлення');
    }
    setTimeout(() => setGeoNotification(null), 4000);
  };

  // Support Developer & Tech Support States
  const [showSupportDevModal, setShowSupportDevModal] = useState(false);
  const [showTechSupportModal, setShowTechSupportModal] = useState(false);
  const [copiedMono, setCopiedMono] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [selectedDonateAmount, setSelectedDonateAmount] = useState<number | null>(100);
  const [supportTopic, setSupportTopic] = useState<'bug' | 'venue' | 'feature' | 'other'>('bug');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportContact, setSupportContact] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [donationThankYou, setDonationThankYou] = useState(false);

  const handleCopyMonoJar = () => {
    sounds.playTap();
    navigator.clipboard?.writeText('https://send.monobank.ua/jar/budmo');
    setCopiedMono(true);
    setTimeout(() => setCopiedMono(false), 2500);
  };

  const handleCopySupportEmail = () => {
    sounds.playTap();
    navigator.clipboard?.writeText('support@budmo.ua');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSelectDonateTier = (amount: number) => {
    sounds.playClink();
    setSelectedDonateAmount(amount);
    setDonationThankYou(true);
    setTimeout(() => setDonationThankYou(false), 4500);
  };

  const handleSubmitSupportForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    sounds.playSuccess();
    setSupportSent(true);
    setTimeout(() => {
      setSupportSent(false);
      setSupportMessage('');
      setSupportContact('');
      setShowTechSupportModal(false);
    }, 2500);
  };

  const toggleDrink = (drink: DrinkType) => {
    setPreferredDrinks((prev) =>
      prev.includes(drink) ? prev.filter((d) => d !== drink) : [...prev, drink]
    );
  };

  const handleOpenAvatarModal = () => {
    sounds.playTap();
    setSelectedAvatarUrl(userAvatar);
    setShowAvatarModal(true);
  };

  const handleSelectPresetAvatar = (url: string) => {
    sounds.playPop();
    setSelectedAvatarUrl(url);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setGeoNotification('⚠️ Будь ласка, оберіть файл зображення (JPG, PNG, WebP)');
      setTimeout(() => setGeoNotification(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // Optimize to max 400x400 via canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
            setSelectedAvatarUrl(resizedDataUrl);
            sounds.playPop();
          } else {
            setSelectedAvatarUrl(dataUrl);
            sounds.playPop();
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyAvatar = (overrideUrl?: string) => {
    const finalAvatar = (overrideUrl || selectedAvatarUrl || customAvatarInput).trim();
    if (!finalAvatar) return;

    sounds.playSuccess();
    setUserAvatar(finalAvatar);

    const updatedUser: AuthUser = {
      ...currentUser,
      avatar: finalAvatar,
      name: userName,
      birthDate,
      age: calculatedAge ?? currentUser.age,
    };

    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    authService.saveUser(updatedUser);

    firestoreSyncService.saveUserProfile({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: finalAvatar,
      tagline,
      paymentRule,
      preferredDrinks,
      locationName: userLocation.locationName,
      lat: userLocation.lat,
      lng: userLocation.lng,
      updatedAt: new Date().toISOString(),
      birthDate,
      age: calculatedAge ?? undefined,
    });

    setShowAvatarModal(false);
    setGeoNotification('✅ Аватарку успішно оновлено!');
    setTimeout(() => setGeoNotification(null), 3000);
  };

  const handleSaveName = (customName?: string) => {
    const targetName = (customName !== undefined ? customName : userName).trim();
    if (!targetName) return;
    sounds.playClink();
    setUserName(targetName);
    setIsEditingNameInline(false);
    const updatedUser: AuthUser = {
      ...currentUser,
      avatar: userAvatar,
      name: targetName,
      birthDate,
      age: calculatedAge ?? currentUser.age,
    };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    authService.saveUser(updatedUser);
    firestoreSyncService.saveUserProfile({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: userAvatar,
      tagline,
      paymentRule,
      preferredDrinks,
      locationName: userLocation.locationName,
      lat: userLocation.lat,
      lng: userLocation.lng,
      updatedAt: new Date().toISOString(),
      birthDate,
      age: calculatedAge ?? undefined,
    });
    setGeoNotification(`✅ Ім'я успішно оновлено на «${targetName}»!`);
    setTimeout(() => setGeoNotification(null), 3000);
  };

  const handleSave = () => {
    sounds.playClink();
    setIsSaved(true);
    const targetName = userName.trim() || currentUser.name || 'Користувач';
    setUserName(targetName);
    setIsEditingNameInline(false);

    const updatedUser: AuthUser = {
      ...currentUser,
      avatar: userAvatar,
      name: targetName,
      birthDate,
      age: calculatedAge ?? currentUser.age,
    };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    authService.saveUser(updatedUser);

    analyticsService.trackEvent('profile_saved', {
      user_id: currentUser.id,
      preferred_drinks_count: preferredDrinks.length,
      payment_rule: paymentRule,
    });
    // Persist profile to Cloud Firestore
    firestoreSyncService.saveUserProfile({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: userAvatar,
      tagline,
      paymentRule,
      preferredDrinks,
      locationName: userLocation.locationName,
      lat: userLocation.lat,
      lng: userLocation.lng,
      updatedAt: new Date().toISOString(),
      birthDate,
      age: calculatedAge ?? undefined,
    });
    setGeoNotification(`✅ Профіль, вік та ім'я «${targetName}» збережено!`);
    setTimeout(() => setGeoNotification(null), 3000);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // 1. Get real device GPS via browser Geolocation API
  const handleGetDeviceGps = () => {
    if (!navigator.geolocation) {
      setGeoNotification('Браузер не підтримує Web Geolocation API');
      setTimeout(() => setGeoNotification(null), 3500);
      return;
    }
    setIsLocatingGps(true);
    sounds.playSwoosh();
    analyticsService.trackEvent('gps_requested', {
      battery_saver: isBatterySaver,
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const { latitude, longitude, accuracy } = pos.coords;
        const roundedLat = Math.round(latitude * 10000) / 10000;
        const roundedLng = Math.round(longitude * 10000) / 10000;

        let detectedCity = 'Точний GPS пристрою';
        if (roundedLat >= 50.3 && roundedLat <= 50.6 && roundedLng >= 30.2 && roundedLng <= 30.8) {
          detectedCity = 'Київ (GPS точний)';
        } else if (roundedLat >= 49.7 && roundedLat <= 49.9 && roundedLng >= 23.9 && roundedLng <= 24.2) {
          detectedCity = 'Львів (GPS точний)';
        } else if (roundedLat >= 46.4 && roundedLat <= 46.6 && roundedLng >= 30.6 && roundedLng <= 30.8) {
          detectedCity = 'Одеса (GPS точний)';
        }

        const newLoc: UserGeoLocation = {
          lat: roundedLat,
          lng: roundedLng,
          locationName: detectedCity,
          accuracyMeters: Math.round(accuracy || 8),
          lastUpdated: 'Щойно',
          isSimulated: false,
          status: 'active',
        };

        onUpdateLocation(newLoc);
        sounds.playClink();
        setGeoNotification(`🛰️ Геолокацію визначено за GPS (точність ±${Math.round(accuracy || 8)}м)!`);
        setTimeout(() => setGeoNotification(null), 4000);
      },
      (_err) => {
        setIsLocatingGps(false);
        setGeoNotification('Не вдалося отримати GPS або доступ відхилено. Будь ласка, оберіть готовий район нижче.');
        setTimeout(() => setGeoNotification(null), 4000);
      },
      batterySaverService.getGeolocationOptions()
    );
  };

  // 2. Choose from curated bar hotspots
  const handleSelectPreset = (preset: PresetLocation) => {
    const newLoc: UserGeoLocation = {
      lat: preset.lat,
      lng: preset.lng,
      locationName: `${preset.name} • ${preset.area}`,
      accuracyMeters: 5,
      lastUpdated: 'Щойно',
      isSimulated: true,
      status: 'active',
    };
    onUpdateLocation(newLoc);
    sounds.playClink();
    setGeoNotification(`📍 Локацію змінено: ${preset.name}! Радар та відстані перераховано.`);
    setTimeout(() => setGeoNotification(null), 3500);
  };

  // Filter preset locations by search
  const filteredPresets = PRESET_LOCATIONS.filter((p) => {
    const q = searchDistrict.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.area.toLowerCase().includes(q) ||
      p.popularBars.toLowerCase().includes(q)
    );
  });

  const isGoogle = currentUser.provider === 'google' && currentUser.isLoggedIn;

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-y-auto no-scrollbar select-none">
      {/* Floating Geo Notification Toast */}
      {geoNotification && (
        <div className="fixed top-14 left-4 right-4 z-50 bg-amber-950/95 border border-amber-500/50 text-amber-200 text-xs px-3 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="flex-1 text-[11px] font-medium leading-tight">{geoNotification}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5 leading-none">
            {t('profile_title', currentLanguage)}
          </h2>
          <p className="text-[10px] text-neutral-400">Налаштування акаунту, локації та вподобань</p>
        </div>

        <button
          type="button"
          id="save-profile-btn"
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-lg transition shadow"
        >
          {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaved ? t('profile_saved', currentLanguage) : t('save_changes', currentLanguage)}</span>
        </button>
      </div>

      <div className="p-4 space-y-4 pb-2">
        {/* User Card */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 shadow-xl flex items-center gap-3.5 relative overflow-hidden">
          <div 
            className="relative group cursor-pointer shrink-0" 
            onClick={handleOpenAvatarModal}
            title="Натисніть для зміни фото профілю"
          >
            <img
              src={userAvatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md group-hover:brightness-90 transition"
            />
            {/* Camera badge */}
            <button
              type="button"
              id="change-avatar-badge-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAvatarModal();
              }}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-lg border-2 border-neutral-900 transition active:scale-95 cursor-pointer"
              title="Змінити аватарку"
            >
              <Camera className="w-3 h-3 text-neutral-950 stroke-[2.5]" />
            </button>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Interactive Name Display & Inline Editing */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isEditingNameInline ? (
                <div className="flex items-center gap-1.5 min-w-0 py-0.5">
                  <input
                    type="text"
                    id="profile-card-inline-name-input"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') {
                        setUserName(currentUser.name || '');
                        setIsEditingNameInline(false);
                      }
                    }}
                    autoFocus
                    maxLength={35}
                    placeholder="Введіть ім'я"
                    className="bg-neutral-950 border border-amber-400 rounded-lg px-2 py-1 text-sm text-white font-bold w-36 focus:outline-none shadow-inner"
                  />
                  <button
                    type="button"
                    id="profile-card-save-name-btn"
                    onClick={() => handleSaveName()}
                    className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 transition cursor-pointer shadow"
                    title="Зберегти ім'я"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                  <button
                    type="button"
                    id="profile-card-cancel-name-btn"
                    onClick={() => {
                      setUserName(currentUser.name || '');
                      setIsEditingNameInline(false);
                    }}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer"
                    title="Скасувати"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-base font-bold text-white leading-tight truncate">
                    {userName || currentUser.name || 'Користувач'}{calculatedAge !== null ? `, ${calculatedAge}` : ''}
                  </h3>
                  <button
                    type="button"
                    id="profile-edit-name-btn"
                    onClick={() => setIsEditingNameInline(true)}
                    className="p-1 rounded-md bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition cursor-pointer shrink-0"
                    title="Редагувати ім'я"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {isGoogle && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30 flex items-center gap-1 shrink-0">
                      Google
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Interactive Location Indicator */}
            <button
              type="button"
              id="profile-usercard-location-btn"
              onClick={() => {
                const el = document.getElementById('profile-geolocation-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-0.5 text-left transition group"
              title="Натисніть для зміни геопозиції"
            >
              <MapPin className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
              <span className="truncate max-w-[170px] font-medium">{userLocation.locationName}</span>
              <span className="text-[10px] text-neutral-400 group-hover:text-amber-300 font-semibold underline decoration-dotted shrink-0">
                (змінити)
              </span>
            </button>

            {/* Quick avatar edit link */}
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                id="open-change-avatar-link-btn"
                onClick={handleOpenAvatarModal}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Camera className="w-3 h-3" />
                <span>Змінити аватарку</span>
              </button>
            </div>

            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              {currentUser.email || 'Email не вказано'}
            </p>

            {calculatedAge !== null && (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90 font-medium mt-1 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-lg w-fit">
                <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{formatAgeWithUnit(calculatedAge)} ({formatBirthDateUkrainian(birthDate)})</span>
              </div>
            )}
          </div>
        </div>

        {/* Gamification & Level Up Progress Card */}
        <GamificationProgressCard
          userId={currentUser.id}
          userName={currentUser.name}
          currentLocationName={userLocation.locationName}
          onOpenTour={onOpenGamificationTour}
          onCheckInSuccess={(bar, xp) => {
            setGeoNotification(`🍻 Зараховано чекін у «${bar}» (+${xp} XP)!`);
            setTimeout(() => setGeoNotification(null), 3500);
          }}
        />

        {/* 0.1 Date of Birth & Live Age Calculation */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <label htmlFor="profile-birthdate-input" className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>🎂 Дата народження та вік</span>
            </label>
            {calculatedAge !== null && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {formatAgeWithUnit(calculatedAge)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <input
                type="date"
                id="profile-birthdate-input"
                value={birthDate}
                max={new Date().toISOString().split('T')[0]}
                min="1920-01-01"
                onChange={(e) => handleBirthDateChange(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 shadow-inner font-medium transition cursor-pointer [color-scheme:dark]"
              />
              <span className="text-[10px] text-neutral-400 block px-1">
                Вкажіть дату — роки обчислюються автоматично
              </span>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-neutral-400 block">Повний вік:</span>
                {calculatedAge !== null ? (
                  <div className="text-xs font-bold text-amber-400 truncate">
                    {formatAgeWithUnit(calculatedAge)}
                    <span className="text-[10px] text-neutral-400 font-normal ml-1">
                      ({formatBirthDateUkrainian(birthDate)})
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500 italic">Не вказано</span>
                )}
              </div>

              {birthDate !== currentUser.birthDate && (
                <button
                  type="button"
                  id="profile-save-birthdate-btn"
                  onClick={() => handleSaveBirthDate()}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[11px] font-bold rounded-xl transition shadow flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                  title="Зберегти дату народження"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Зберегти</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 1. Tagline / Mood Text ("Мій статус" піднято над "Моя геопозиція") */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <span>💬 Мій статус / Слоган у картці</span>
            </label>
            <span className="text-[10px] text-neutral-400">Відображається в пошуку</span>
          </div>
          <textarea
            id="profile-tagline-textarea"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            rows={2}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-3 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 resize-none shadow-inner"
          />
        </div>

        {/* Payment Etiquette ("Мій етикет оплати рахунку" одразу після "Мій статус") */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-2.5 shadow-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <span>💳 Мій етикет оплати рахунку:</span>
            </label>
            <span className="text-[10px] text-amber-400 font-semibold">
              {PAYMENT_METADATA[paymentRule]?.badge}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PAYMENT_METADATA) as PaymentEtiquette[]).map((rule) => {
              const meta = PAYMENT_METADATA[rule];
              const isSelected = paymentRule === rule;
              return (
                <button
                  key={rule}
                  type="button"
                  id={`profile-payment-${rule}`}
                  onClick={() => {
                    sounds.playTap();
                    setPaymentRule(rule);
                  }}
                  className={`text-xs p-2.5 rounded-xl border text-left font-medium transition ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                  }`}
                >
                  <div className="font-bold leading-tight">{meta.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Drink Preferences ("Що я п’ю найчастіше" одразу після "Мій статус") */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-2.5 shadow-xl">
          <label className="block text-xs font-bold text-neutral-200">
            🍻 Що я п’ю найчастіше:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(DRINK_METADATA) as DrinkType[]).map((drink) => {
              const meta = DRINK_METADATA[drink];
              const isSelected = preferredDrinks.includes(drink);
              return (
                <button
                  key={drink}
                  type="button"
                  id={`profile-drink-${drink}`}
                  onClick={() => toggleDrink(drink)}
                  className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Dedicated Geolocation & District Management Section ("Моя геопозиція") */}
        <div 
          id="profile-geolocation-section" 
          className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-3.5 shadow-xl relative"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                  <span>Моя геопозиція та район</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </h4>
                <p className="text-[10px] text-neutral-400">
                  Впливає на розрахунок відстаней у Пошуку та Радарі
                </p>
              </div>
            </div>

            <div className="text-[10px] font-mono font-semibold bg-neutral-950 text-amber-300 border border-neutral-800 px-2 py-0.5 rounded-full">
              {userLocation.lat.toFixed(4)}°N, {userLocation.lng.toFixed(4)}°E
            </div>
          </div>

          {/* Current Active Location Display Banner */}
          <div className="bg-neutral-950/80 rounded-2xl border border-neutral-800 p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="text-[11px] text-neutral-400 font-medium">
                  Поточне місцезнаходження:
                </div>
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{userLocation.locationName}</span>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shrink-0">
                ±{userLocation.accuracyMeters}м {userLocation.isSimulated ? '(Пресет)' : '(GPS)'}
              </span>
            </div>

            {/* Quick Action Button */}
            <div className="pt-1 border-t border-neutral-900">
              <button
                type="button"
                id="profile-get-gps-btn"
                onClick={handleGetDeviceGps}
                disabled={isLocatingGps}
                className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-500/10 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-50"
                title="Отримати точні координати через GPS пристрою"
              >
                <Locate className={`w-3.5 h-3.5 text-amber-400 ${isLocatingGps ? 'animate-spin' : ''}`} />
                <span>{isLocatingGps ? 'Пошук супутників...' : 'Визначити за GPS'}</span>
              </button>
            </div>
          </div>

          {/* Location Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs font-bold">
            <button
              type="button"
              id="profile-location-tab-presets"
              onClick={() => setLocationTab('presets')}
              className={`py-1.5 rounded-lg transition text-center ${
                locationTab === 'presets'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Барні райони ({PRESET_LOCATIONS.length})
            </button>
            <button
              type="button"
              id="profile-location-tab-custom"
              onClick={() => {
                setLocationTab('custom');
                sounds.playTap();
              }}
              className={`py-1.5 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                locationTab === 'custom'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Мапа координат</span>
            </button>
          </div>

          {/* Tab 1: Preset Bar Districts */}
          {locationTab === 'presets' && (
            <div className="space-y-2.5">
              {/* Search Filter for Districts */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  id="profile-search-district-input"
                  placeholder="Шукати район або улюблений бар..."
                  value={searchDistrict}
                  onChange={(e) => setSearchDistrict(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              {/* Districts List */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar pr-0.5">
                {filteredPresets.map((preset) => {
                  const isSelected =
                    Math.abs(userLocation.lat - preset.lat) < 0.005 &&
                    Math.abs(userLocation.lng - preset.lng) < 0.005;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      id={`preset-loc-${preset.id}`}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                          : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>{preset.name}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-neutral-950">
                              Обрано
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">
                          {preset.area}
                        </div>
                        <div className="text-[10px] text-amber-400/90 truncate flex items-center gap-1">
                          <Beer className="w-3 h-3 shrink-0" />
                          <span className="truncate">{preset.popularBars}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-[9px] font-mono text-neutral-500">
                          {preset.lat.toFixed(2)}°, {preset.lng.toFixed(2)}°
                        </span>
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-neutral-700" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredPresets.length === 0 && (
                  <div className="text-center py-4 text-xs text-neutral-500">
                    Районів за запитом «{searchDistrict}» не знайдено
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Interactive Coordinate Map Picker */}
          {locationTab === 'custom' && (
            <GeoCoordinateMapPicker
              initialLat={userLocation.lat}
              initialLng={userLocation.lng}
              initialName={userLocation.locationName}
              onApplyCoordinates={(lat, lng, placeName) => {
                const newLoc: UserGeoLocation = {
                  lat,
                  lng,
                  locationName: placeName,
                  accuracyMeters: 8,
                  lastUpdated: 'Щойно',
                  isSimulated: true,
                  status: 'active',
                };
                onUpdateLocation(newLoc);
                sounds.playClink();
                setGeoNotification(`📍 Локацію на мапі встановлено: ${placeName}!`);
                setTimeout(() => setGeoNotification(null), 3500);
              }}
            />
          )}
        </div>

        {/* 5. Language Selection & Geo Detection Card */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white leading-tight">
                  {t('language_title', currentLanguage)}
                </h4>
                <p className="text-[10px] text-neutral-400">
                  {langSourceHint}
                </p>
              </div>
            </div>

            <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
              {SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.flag}{' '}
              {SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.nativeName}
            </span>
          </div>

          {/* Languages Grid (Explicitly NO Russian) */}
          <div className="grid grid-cols-2 gap-1.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  id={`lang-btn-${lang.code}`}
                  onClick={() => {
                    sounds.playClink();
                    onLanguageChange(lang.code);
                  }}
                  className={`p-2 rounded-xl border text-left flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{lang.flag}</span>
                    <div className="truncate">
                      <div className="text-xs font-bold truncate leading-tight">
                        {lang.nativeName}
                      </div>
                      <div className="text-[9px] text-neutral-400 truncate">
                        {lang.regionHint}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Russia Block & Strict Ban Notice */}
          <div className="bg-rose-950/40 border border-rose-600/30 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold text-rose-300">
                  Повне гео-блокування території РФ
                </div>
                <p className="text-[10px] text-rose-200/80 leading-relaxed">
                  {t('language_ru_ban_notice', currentLanguage)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Battery Saver Mode Settings Card */}
        <div 
          id="profile-battery-saver-section"
          className={`rounded-3xl border p-4 space-y-3.5 shadow-xl transition-all duration-300 ${
            isBatterySaver
              ? 'bg-gradient-to-br from-amber-950/40 via-neutral-900 to-neutral-900 border-amber-500/50 ring-1 ring-amber-500/20'
              : 'bg-neutral-900 border-neutral-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div 
                className={`w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${
                  isBatterySaver
                    ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                {isBatterySaver ? (
                  <Zap className="w-5 h-5 fill-neutral-950" />
                ) : (
                  <BatteryMedium className="w-5 h-5 text-neutral-300" />
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-neutral-100 leading-tight">
                    {t('battery_saver_title', currentLanguage)}
                  </h4>
                  <span 
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border transition-colors ${
                      isBatterySaver
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {isBatterySaver ? t('battery_saver_active', currentLanguage) : t('battery_saver_disabled', currentLanguage)}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  {t('battery_saver_desc', currentLanguage)}
                </p>
              </div>
            </div>

            {/* Accessible Toggle Switch */}
            <button
              type="button"
              id="battery-saver-toggle"
              role="switch"
              aria-checked={isBatterySaver}
              onClick={handleToggleBatterySaver}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950 ${
                isBatterySaver ? 'bg-amber-500' : 'bg-neutral-800'
              }`}
            >
              <span className="sr-only">Toggle Battery Saver</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-neutral-950 shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                  isBatterySaver ? 'translate-x-5 bg-neutral-950' : 'translate-x-0 bg-neutral-400'
                }`}
              >
                {isBatterySaver && <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />}
              </span>
            </button>
          </div>

          {/* Metrics & Throttling Breakdown */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800/80">
            <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <Navigation className="w-3 h-3 text-amber-400" />
                <span className="font-medium">Опитування GPS:</span>
              </div>
              <div className="text-xs font-bold text-neutral-100 flex items-baseline gap-1">
                <span>{isBatterySaver ? 'кожні 90 сек' : 'кожні 15 сек'}</span>
                <span className="text-[9px] text-neutral-500 font-normal">
                  {isBatterySaver ? '(Low Power)' : '(High Acc)'}
                </span>
              </div>
            </div>

            <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="font-medium">Real-time оновлення:</span>
              </div>
              <div className="text-xs font-bold text-neutral-100 flex items-baseline gap-1">
                <span>{isBatterySaver ? 'кожні 60 сек' : 'миттєво (Live)'}</span>
                <span className="text-[9px] text-neutral-500 font-normal">
                  {isBatterySaver ? '(-65% CPU)' : '(100% Sync)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Push-сповіщення: Центр та статус */}
        <div className="bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900 rounded-2xl border border-amber-500/30 p-3.5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                  <span>Push-сповіщення (Heads-up & Web API)</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-semibold border border-emerald-500/30">
                    Live
                  </span>
                </h4>
                <p className="text-[10px] text-neutral-400">
                  Миттєві сповіщення про нових гостей за столиком та повідомлення
                </p>
              </div>
            </div>
          </div>

          {onOpenNotifications && (
            <button
              type="button"
              id="profile-open-notifications-center-btn"
              onClick={onOpenNotifications}
              className="w-full py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Відкрити Центр сповіщень та налаштування</span>
            </button>
          )}
        </div>

        {/* Anti-abuse, Safety & Moderation Center */}
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/20 rounded-2xl border border-neutral-800 p-3.5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                  <span>Безпека та модерація (Anti-Abuse)</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-semibold border border-emerald-500/30">
                    Активно
                  </span>
                </h4>
                <p className="text-[10px] text-neutral-400">
                  Автоматичний захист від спаму, ботів та токсичної поведінки
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-2.5 text-[11px] text-neutral-300 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Авто-бан підозрілих акаунтів:</span>
              <span className="font-bold text-amber-400">&gt;= 2 скарг або critical flag</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Заблоковані вами користувачі:</span>
              <span className="font-bold text-white bg-neutral-800 px-1.5 py-0.2 rounded">
                {blockedUsersCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Надіслано скарг на модерацію:</span>
              <span className="font-bold text-amber-300 bg-neutral-800 px-1.5 py-0.2 rounded">
                {reportsCount}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              id="profile-open-blocked-modal-btn"
              onClick={() => {
                sounds.playTap();
                setShowBlockedModal(true);
              }}
              className="py-2 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <UserX className="w-3.5 h-3.5 text-rose-400" />
              <span>Чорний список ({blockedUsersCount})</span>
            </button>

            <button
              type="button"
              id="profile-open-sos-btn"
              onClick={() => {
                sounds.playPop();
                setShowSosModal(true);
              }}
              className="py-2 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-700/50 text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-red-400" />
              <span>SOS & Безпека барів</span>
            </button>
          </div>
        </div>

        {/* Account & Support Section */}
        <div className="space-y-2">
          {/* Auth Action Buttons Card */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-2.5 shadow-md flex items-center gap-2">
            {!currentUser.isLoggedIn ? (
              <>
                <button
                  type="button"
                  id="profile-google-login-btn"
                  onClick={onGoogleSignIn}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs shadow transition flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                    <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                  </svg>
                  <span>Увійти через Google</span>
                </button>
                <button
                  type="button"
                  id="switch-account-btn"
                  onClick={onOpenAuth}
                  className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition"
                >
                  Форма входу
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  id="switch-account-btn"
                  onClick={onOpenAuth}
                  className="flex-1 py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition text-center"
                >
                  {isGoogle ? 'Змінити Google акаунт' : 'Змінити акаунт'}
                </button>
                <button
                  type="button"
                  id="profile-logout-btn"
                  onClick={onLogout}
                  className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-rose-800/40 transition shrink-0"
                  title="Вийти з акаунту"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Вийти</span>
                </button>
              </>
            )}
          </div>

          {/* Єдина плашка: Підтримати розробника та Технічна підтримка */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-2.5 shadow-md grid grid-cols-2 gap-2">
            {/* Перша кнопка: Підтримати розробника */}
            <button
              type="button"
              id="profile-support-dev-btn"
              onClick={() => {
                sounds.playTap();
                setShowSupportDevModal(true);
              }}
              className="py-2 px-2 sm:px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer text-center"
            >
              <Heart className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 shrink-0" />
              <span className="truncate">Підтримати розробника</span>
            </button>

            {/* Друга кнопка: Технічна підтримка */}
            <button
              type="button"
              id="profile-tech-support-btn"
              onClick={() => {
                sounds.playTap();
                setShowTechSupportModal(true);
              }}
              className="py-2 px-2 sm:px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer text-center"
            >
              <Headphones className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">Технічна підтримка</span>
            </button>
          </div>
        </div>
      </div>

      {/* Blocked Users & Anti-Abuse Management Modal */}
      <BlockedUsersModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
      />

      {/* SOS Protocol & Bar Emergency Safety Modal */}
      <SosEmergencyModal
        isOpen={showSosModal}
        onClose={() => setShowSosModal(false)}
        venueName={userLocation?.locationName}
      />

      {/* Support Developer Modal */}
      {showSupportDevModal && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSupportDevModal(false);
          }}
        >
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Підтримати розробника 🍺</h3>
                  <p className="text-[10px] text-amber-400/80 font-medium">Розвиток українського проєкту</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportDevModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              <strong className="text-amber-400">«Будьмо!»</strong> — незалежний український застосунок для пошуку компанії у барах та пабах. Без нав'язливої реклами та спаму. Кожен донат допомагає оплачувати сервери та прискорює нові оновлення!
            </p>

            {/* Donation Quick Options */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-neutral-400">Оберіть варіант подяки:</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { amount: 50, icon: '🍺', label: 'Бокал лагера', sub: '50 ₴' },
                  { amount: 100, icon: '🍕', label: 'Піца до пива', sub: '100 ₴' },
                  { amount: 250, icon: '🎉', label: 'Сет крафту', sub: '250 ₴' },
                  { amount: 500, icon: '👑', label: 'Легенда бару', sub: '500 ₴' },
                ].map((tier) => (
                  <button
                    key={tier.amount}
                    type="button"
                    onClick={() => handleSelectDonateTier(tier.amount)}
                    className={`p-2.5 rounded-2xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                      selectedDonateAmount === tier.amount
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                        : 'bg-neutral-950/80 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-lg">{tier.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">{tier.label}</div>
                      <div className="text-[10px] text-amber-400 font-semibold">{tier.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {donationThankYou && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="leading-snug font-medium">
                  Дякуємо від щирого серця! Тисніть Банку Monobank нижче для переказу 🐱🍻
                </span>
              </div>
            )}

            {/* Monobank Jar Card */}
            <div className="bg-neutral-950 rounded-2xl border border-neutral-800 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🐱</span>
                  <span className="text-xs font-bold text-white">Банка Monobank</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  Офіційний збір
                </span>
              </div>

              <div className="text-[11px] text-neutral-400 break-all font-mono bg-neutral-900 p-2 rounded-xl border border-neutral-800 flex items-center justify-between gap-2">
                <span className="truncate">send.monobank.ua/jar/budmo</span>
                <button
                  type="button"
                  onClick={handleCopyMonoJar}
                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition"
                >
                  {copiedMono ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedMono ? 'Скопійовано' : 'Копіювати'}</span>
                </button>
              </div>

              <div className="flex gap-2">
                <a
                  href="https://send.monobank.ua/jar/budmo"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sounds.playClink()}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Перейти до Банки 🐱</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="text-[10px] text-neutral-500 text-center">
              Частина коштів регулярно перераховується на підтримку сил оборони України 🇺🇦
            </div>
          </div>
        </div>
      )}

      {/* Technical Support Modal */}
      {showTechSupportModal && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTechSupportModal(false);
          }}
        >
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Технічна підтримка 💬</h3>
                  <p className="text-[10px] text-sky-400/80 font-medium">Швидкий зв'язок з розробниками</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTechSupportModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Contact Options */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://t.me/budmo_support"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sounds.playTap()}
                className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-sky-500/40 text-left transition flex items-center gap-2.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">Telegram</div>
                  <div className="text-[10px] text-neutral-400 truncate">@budmo_support</div>
                </div>
              </a>

              <button
                type="button"
                onClick={handleCopySupportEmail}
                className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-left transition flex items-center gap-2.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {copiedEmail ? 'Скопійовано!' : 'Email'}
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">support@budmo.ua</div>
                </div>
              </button>
            </div>

            {/* Direct Feedback / Bug Report Form */}
            <form onSubmit={handleSubmitSupportForm} className="space-y-3 bg-neutral-950/80 p-3.5 rounded-2xl border border-neutral-800">
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Надіслати звернення розробникам:</span>
                <span className="text-[10px] text-neutral-500 font-normal">відповідаємо за 15 хв</span>
              </div>

              {/* Topic Selector */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'bug', label: '🐛 Баг / Помилка' },
                  { id: 'venue', label: '📍 Додати заклад' },
                  { id: 'feature', label: '💡 Пропозиція' },
                  { id: 'other', label: '❓ Інше питання' },
                ].map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSupportTopic(topic.id as typeof supportTopic)}
                    className={`text-[11px] px-2.5 py-1 rounded-xl border transition cursor-pointer font-medium ${
                      supportTopic === topic.id
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {topic.label}
                  </button>
                ))}
              </div>

              <div>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Опишіть ваше питання або що варто виправити..."
                  rows={3}
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-sky-400 resize-none shadow-inner"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={supportContact}
                  onChange={(e) => setSupportContact(e.target.value)}
                  placeholder="Ваш контакт для відповіді (Telegram / Email)..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-sky-400 shadow-inner"
                />
              </div>

              {supportSent ? (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Звернення #BM-4892 успішно відправлено розробникам!</span>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!supportMessage.trim()}
                  className="w-full py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-neutral-950 font-bold text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Надіслати звернення</span>
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Avatar Selection & Upload Modal */}
      {showAvatarModal && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAvatarModal(false);
          }}
        >
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Змінити аватарку</h3>
                  <p className="text-[10px] text-neutral-400">Галерея образів або власне фото</p>
                </div>
              </div>
              <button
                type="button"
                id="close-avatar-modal-btn"
                onClick={() => setShowAvatarModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current / Selected Preview */}
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="relative">
                <img
                  src={selectedAvatarUrl || userAvatar}
                  alt="Попередній перегляд"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-xl"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
              </div>
              <span className="text-[11px] text-neutral-400 font-medium">Попередній перегляд</span>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
              <button
                type="button"
                id="avatar-tab-presets"
                onClick={() => {
                  sounds.playTap();
                  setAvatarCategory('presets');
                }}
                className={`py-1.5 px-2 rounded-lg font-semibold transition text-center cursor-pointer ${
                  avatarCategory === 'presets'
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Галерея
              </button>
              <button
                type="button"
                id="avatar-tab-upload"
                onClick={() => {
                  sounds.playTap();
                  setAvatarCategory('upload');
                }}
                className={`py-1.5 px-2 rounded-lg font-semibold transition text-center cursor-pointer ${
                  avatarCategory === 'upload'
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Завантажити
              </button>
              <button
                type="button"
                id="avatar-tab-custom"
                onClick={() => {
                  sounds.playTap();
                  setAvatarCategory('custom');
                }}
                className={`py-1.5 px-2 rounded-lg font-semibold transition text-center cursor-pointer ${
                  avatarCategory === 'custom'
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Посилання
              </button>
            </div>

            {/* Tab 1: Presets Gallery */}
            {avatarCategory === 'presets' && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-400">Оберіть готовий образ:</div>
                <div className="grid grid-cols-4 gap-2.5 max-h-48 overflow-y-auto no-scrollbar p-1">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = selectedAvatarUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetAvatar(preset.url)}
                        className={`relative rounded-xl overflow-hidden border-2 transition active:scale-95 cursor-pointer aspect-square ${
                          isSelected ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg' : 'border-neutral-800 hover:border-neutral-600'
                        }`}
                        title={preset.name}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Upload Own Photo */}
            {avatarCategory === 'upload' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  id="avatar-upload-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-6 border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-2xl bg-amber-500/5 hover:bg-amber-500/10 transition flex flex-col items-center justify-center gap-2 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Оберіть фото з пристрою
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      JPG, PNG, WebP (з галереї чи камери)
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Tab 3: Custom URL Input */}
            {avatarCategory === 'custom' && (
              <div className="space-y-3 bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
                <label className="text-[11px] font-bold text-neutral-400 block">
                  Вставте посилання на зображення:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customAvatarInput}
                    onChange={(e) => {
                      setCustomAvatarInput(e.target.value);
                      if (e.target.value.trim().startsWith('http')) {
                        setSelectedAvatarUrl(e.target.value.trim());
                      }
                    }}
                    placeholder="https://example.com/avatar.jpg"
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customAvatarInput.trim()) {
                        setSelectedAvatarUrl(customAvatarInput.trim());
                        sounds.playPop();
                      }
                    }}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Переглянути
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                id="apply-avatar-btn"
                onClick={() => handleApplyAvatar()}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Зберегти аватарку</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
