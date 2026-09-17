import React, { useState } from 'react';
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
  Database,
  Bell,
  UserX,
  LifeBuoy,
} from 'lucide-react';
import { DrinkType, PaymentEtiquette, AuthUser, AppLanguage } from '../../types';
import { DRINK_METADATA, PAYMENT_METADATA } from '../../data/mockData';
import { sounds } from '../../services/soundService';
import { SUPPORTED_LANGUAGES, t } from '../../services/i18nService';
import { 
  UserGeoLocation, 
  PRESET_LOCATIONS, 
  PresetLocation 
} from '../../services/geoService';
import { GeoCoordinateMapPicker } from './GeoCoordinateMapPicker';
import { FavoriteVenuesSection } from './FavoriteVenuesSection';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { GamificationProgressCard } from './GamificationProgressCard';
import { safetyModerationService } from '../../services/safetyModerationService';
import { BlockedUsersModal } from './BlockedUsersModal';
import { SosEmergencyModal } from './SosEmergencyModal';

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
}) => {
  const [tagline, setTagline] = useState('React Native розробник, шукаю компанію на крафтове пиво або вино 🍺🍷');
  const [preferredDrinks, setPreferredDrinks] = useState<DrinkType[]>(['craft', 'wine', 'cider']);
  const [paymentRule, setPaymentRule] = useState<PaymentEtiquette>('split_50_50');
  const [isSaved, setIsSaved] = useState(false);

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

  React.useEffect(() => {
    const unsub = safetyModerationService.subscribe(() => {
      setBlockedUsersCount(safetyModerationService.getBlockedUsers().length);
      setReportsCount(safetyModerationService.getReports().length);
    });
    return unsub;
  }, []);

  const toggleDrink = (drink: DrinkType) => {
    setPreferredDrinks((prev) =>
      prev.includes(drink) ? prev.filter((d) => d !== drink) : [...prev, drink]
    );
  };

  const handleSave = () => {
    sounds.playClink();
    setIsSaved(true);
    // Persist profile to Cloud Firestore
    firestoreSyncService.saveUserProfile({
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
      tagline,
      paymentRule,
      preferredDrinks,
      locationName: userLocation.locationName,
      lat: userLocation.lat,
      lng: userLocation.lng,
      updatedAt: new Date().toISOString(),
    });
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
      { timeout: 10000, enableHighAccuracy: true }
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

      <div className="p-4 space-y-4 pb-12">
        {/* User Card */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 shadow-xl flex items-center gap-3.5 relative overflow-hidden">
          <div className="relative">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-bold text-white leading-tight truncate">
                {currentUser.name}, 27
              </h3>
              {isGoogle && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30 flex items-center gap-1">
                  Google
                </span>
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

            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              {currentUser.email || 'Не вказано (Гість)'}
            </p>
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

        {/* 3. Payment Etiquette ("За ним Мій єтикет оплати рахунку") */}
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

        {/* 4. Favorite Venues ("Після цього Улюблені заклади") */}
        <FavoriteVenuesSection userLocation={userLocation} />

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

        {/* Google Authentication & Firebase Status Card */}
        <div className="bg-gradient-to-tr from-amber-950/40 via-neutral-900 to-neutral-900 rounded-2xl border border-amber-500/25 p-3.5 shadow-md space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                </svg>
              </div>
              <span className="text-xs font-bold text-neutral-100">
                {isGoogle ? 'Авторизовано через Google' : 'Google Вхід не виконано'}
              </span>
            </div>

            {isGoogle ? (
              <span className="text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                OAuth 2.0 Active
              </span>
            ) : (
              <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700 px-2 py-0.5 rounded-full">
                Гість
              </span>
            )}
          </div>

          {/* Details */}
          {isGoogle ? (
            <div className="bg-neutral-950/80 rounded-xl p-2.5 font-mono text-[10px] text-neutral-400 space-y-1 border border-neutral-800/80">
              <div><span className="text-neutral-500">Google ID:</span> {currentUser.googleId || '109847291048291048123'}</div>
              <div><span className="text-neutral-500">Email:</span> {currentUser.email}</div>
              <div><span className="text-neutral-500">Scopes:</span> email, profile, openid</div>
              <div><span className="text-neutral-500">Firebase UID:</span> fb_{currentUser.googleId?.slice(0, 8) || 'usr_google'}</div>
              <div className="pt-1.5 mt-1.5 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-amber-400 font-sans font-bold flex items-center gap-1 text-[11px]">
                  <Database className="w-3 h-3" />
                  Cloud Firestore DB
                </span>
                <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded text-[9px] font-mono">
                  Активна онлайн
                </span>
              </div>
              <div className="text-[9px] text-neutral-500 truncate">ID бази: ai-studio-df109a92-91f7-44f7-944f-c92e7aa387b8</div>
            </div>
          ) : (
            <div className="bg-neutral-950/60 rounded-xl p-2.5 text-xs text-neutral-300 border border-neutral-800 space-y-2">
              <p className="text-[11px] text-neutral-400">
                Авторизуйтесь через Google, щоб синхронізувати профіль із Cloud Firestore, зберігати історію чатів та зʼявлятися на радарній карті.
              </p>
              <div className="pt-1 border-t border-neutral-800/60 flex items-center justify-between text-[10px]">
                <span className="text-neutral-400 flex items-center gap-1 font-mono">
                  <Database className="w-3 h-3 text-amber-400" />
                  Firestore:
                </span>
                <span className="text-emerald-400 font-mono text-[9px]">
                  Готова до синхронізації
                </span>
              </div>
              <button
                type="button"
                id="profile-google-login-btn"
                onClick={onGoogleSignIn}
                className="mt-1 w-full py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-black text-xs shadow transition flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                </svg>
                <span>Увійти через Google</span>
              </button>
            </div>
          )}

          {/* Quick Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              id="switch-account-btn"
              onClick={onOpenAuth}
              className="flex-1 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
            >
              {isGoogle ? 'Змінити Google акаунт' : 'Форма входу'}
            </button>
            {currentUser.isLoggedIn && (
              <button
                type="button"
                id="profile-logout-btn"
                onClick={onLogout}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold flex items-center gap-1 border border-rose-800/40 transition"
                title="Вийти з акаунту"
              >
                <LogOut className="w-3 h-3" />
                <span>Вийти</span>
              </button>
            )}
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
    </div>
  );
};
