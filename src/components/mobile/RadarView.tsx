import React, { useState, useMemo } from 'react';
import {
  Radio,
  MapPin,
  Beer,
  Plus,
  Clock,
  X,
  Send,
  RefreshCw,
  Compass,
  Navigation,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { BuddyProfile, HangoutAlert } from '../../types';
import { sounds } from '../../services/soundService';
import { ActivityAnalyticsModal } from './ActivityAnalyticsModal';
import {
  UserGeoLocation,
  PRESET_LOCATIONS,
  calculateDistanceKm,
  calculateBearing,
  formatDistance,
} from '../../services/geoService';
import { batterySaverService } from '../../services/batterySaverService';

interface RadarViewProps {
  buddies: BuddyProfile[];
  userLocation: UserGeoLocation;
  onUpdateLocation: (newLocation: UserGeoLocation) => void;
  onSelectBuddy: (buddy: BuddyProfile) => void;
  onOpenChat: (buddy: BuddyProfile) => void;
  onNewHangout: (hangout: HangoutAlert) => void;
}

export const RadarView: React.FC<RadarViewProps> = ({
  buddies,
  userLocation,
  onUpdateLocation,
  onSelectBuddy,
  onOpenChat,
  onNewHangout,
}) => {
  const [selectedBuddy, setSelectedBuddy] = useState<BuddyProfile | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showLocationDrawer, setShowLocationDrawer] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [radarRadiusKm, setRadarRadiusKm] = useState<number>(3); // 1, 3, 5 km
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const [gpsNotification, setGpsNotification] = useState<string | null>(null);

  // Form for custom check-in
  const [customBar, setCustomBar] = useState('Squat 17b');
  const [customNote, setCustomNote] = useState('Сиджу біля бару, замовляю сидр. Хто поруч?');
  const [drinkChoice, setDrinkChoice] = useState('Крафтове пиво / Сидр');

  // Compute live distance and bearing for every buddy relative to userLocation
  const buddiesWithGeo = useMemo(() => {
    return buddies.map((b) => {
      const distanceKm = calculateDistanceKm(
        userLocation.lat,
        userLocation.lng,
        b.coordinates.lat,
        b.coordinates.lng
      );
      const bearing = calculateBearing(
        userLocation.lat,
        userLocation.lng,
        b.coordinates.lat,
        b.coordinates.lng
      );
      return {
        ...b,
        distanceKm,
        bearing,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [buddies, userLocation]);

  // Buddies inside active radar radius
  const buddiesInRadius = useMemo(() => {
    return buddiesWithGeo.filter((b) => b.distanceKm <= radarRadiusKm);
  }, [buddiesWithGeo, radarRadiusKm]);

  // Active bar check-ins sorted by proximity
  const checkIns = useMemo(() => {
    return buddiesWithGeo.filter((b) => b.activeCheckIn);
  }, [buddiesWithGeo]);

  // Temporary notification helper
  const triggerNotification = (msg: string) => {
    setGpsNotification(msg);
    setTimeout(() => {
      setGpsNotification(null);
    }, 3500);
  };

  // Simulate GPS refresh
  const handleRefreshGps = () => {
    sounds.playClink();
    setIsRefreshingGps(true);
    triggerNotification('📡 Сканування супутників GPS та оновлення координат...');

    setTimeout(() => {
      const updatedTime = new Date().toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      onUpdateLocation({
        ...userLocation,
        accuracyMeters: Math.floor(Math.random() * 4) + 4, // 4-8m
        lastUpdated: updatedTime,
        status: 'active',
      });
      setIsRefreshingGps(false);
      triggerNotification(`📍 GPS оновлено: ${userLocation.locationName} (±5м)`);
    }, 800);
  };

  // Switch to a preset location
  const handleSelectPreset = (preset: typeof PRESET_LOCATIONS[0]) => {
    sounds.playClink();
    const updatedTime = new Date().toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    onUpdateLocation({
      lat: preset.lat,
      lng: preset.lng,
      locationName: preset.name,
      accuracyMeters: 5,
      lastUpdated: updatedTime,
      isSimulated: true,
      status: 'active',
    });
    triggerNotification(`📍 Локацію змінено: ${preset.name}`);
    setShowLocationDrawer(false);
  };

  // Request real device GPS if available in browser
  const handleGetRealDeviceGps = () => {
    if (!navigator.geolocation) {
      triggerNotification('⚠️ Геолокація не підтримується цим браузером');
      return;
    }
    setIsRefreshingGps(true);
    triggerNotification('🛰️ Запит до нативного датчика геолокації пристрою...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const updatedTime = new Date().toLocaleTimeString('uk-UA', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        onUpdateLocation({
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lng: Math.round(pos.coords.longitude * 10000) / 10000,
          locationName: 'Реальна геолокація пристрою',
          accuracyMeters: Math.round(pos.coords.accuracy) || 8,
          lastUpdated: updatedTime,
          isSimulated: false,
          status: 'active',
        });
        setIsRefreshingGps(false);
        triggerNotification('✅ Отримано реальні координати вашого пристрою!');
      },
      () => {
        setIsRefreshingGps(false);
        triggerNotification('ℹ️ Використовуємо калібровані координати Києва (Поділ)');
      },
      batterySaverService.getGeolocationOptions()
    );
  };

  const handleCreateCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBar.trim()) return;

    sounds.playClink();
    const newAlert: HangoutAlert = {
      id: `hangout-${Date.now()}`,
      userId: 'me',
      userName: 'Ви (Мій чек-ін)',
      userAvatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      barName: customBar,
      locationArea: userLocation.locationName,
      drinkPreference: drinkChoice,
      description: customNote,
      createdAt: 'Щойно',
      slotsAvailable: 2,
      participantsCount: 1,
      lat: userLocation.lat,
      lng: userLocation.lng,
      isLive: true,
      status: 'active',
      joinedUsers: ['me'],
    };

    onNewHangout(newAlert);
    setShowCheckInModal(false);
    triggerNotification(`📡 Живий чек-ін у "${customBar}" додано на радар та транслюється всім поблизу!`);
  };

  // Helper for walking time
  const getWalkTimeMinutes = (distKm: number) => {
    const mins = Math.max(1, Math.round((distKm / 4.5) * 60));
    return `~${mins} хв пішки`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-y-auto no-scrollbar relative select-none">
      {/* Floating GPS Notification Toast */}
      {gpsNotification && (
        <div className="absolute top-14 left-4 right-4 z-40 bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs px-3 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 truncate">{gpsNotification}</span>
        </div>
      )}

      {/* Top Header with Live Location Status */}
      <div className="px-4 py-2.5 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Radio className={`w-4 h-4 ${isRefreshingGps ? 'animate-spin text-amber-400' : 'animate-pulse'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-neutral-100 truncate">
                  {userLocation.locationName}
                </h2>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  GPS ±{userLocation.accuracyMeters}м
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                <span>{userLocation.lat.toFixed(4)}°N, {userLocation.lng.toFixed(4)}°E</span>
                <span>• Оновлено {userLocation.lastUpdated}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="open-activity-modal-radar-btn"
              type="button"
              onClick={() => {
                sounds.playClink();
                setShowActivityModal(true);
              }}
              title="Графік пікових годин активності (Recharts)"
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-400 border border-neutral-800 transition active:scale-95 flex items-center gap-1 text-xs"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold hidden xs:inline">Графік</span>
            </button>

            <button
              id="refresh-gps-btn"
              type="button"
              onClick={handleRefreshGps}
              disabled={isRefreshingGps}
              title="Оновити GPS координати"
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-emerald-400 border border-neutral-800 transition active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingGps ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              id="radar-checkin-btn"
              type="button"
              onClick={() => setShowCheckInModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Я в барі!</span>
            </button>
          </div>
        </div>

        {/* GPS Control Bar (Simulation & Presets) */}
        <div className="mt-2 pt-2 border-t border-neutral-900 flex items-center justify-between text-[11px] gap-2">
          <button
            type="button"
            id="open-location-drawer-btn"
            onClick={() => setShowLocationDrawer(!showLocationDrawer)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 font-medium transition truncate"
          >
            <Navigation className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">Змінити район</span>
          </button>

          {/* Radar Scale Filter */}
          <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-md border border-neutral-800">
            {[1, 3, 5].map((km) => (
              <button
                key={km}
                type="button"
                id={`radius-btn-${km}`}
                onClick={() => setRadarRadiusKm(km)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  radarRadiusKm === km
                    ? 'bg-amber-500 text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {km}км
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expandable Location Selector Panel */}
      {showLocationDrawer && (
        <div className="mx-4 mt-2 p-3 bg-neutral-900/95 border border-neutral-800 rounded-2xl shadow-xl space-y-2.5 animate-in fade-in slide-in-from-top-2 z-10">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Імітація геолокації (Київ)</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowLocationDrawer(false)}
              className="text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {PRESET_LOCATIONS.map((preset) => {
              const isCurrent = userLocation.locationName.includes(preset.name.split(' ')[0]);
              return (
                <button
                  key={preset.id}
                  type="button"
                  id={`preset-${preset.id}`}
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex items-center justify-between p-2 rounded-xl text-left border transition ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold">{preset.name}</p>
                    <p className="text-[10px] text-neutral-400">Бари: {preset.popularBars}</p>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">
                      Тут
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              id="device-gps-btn"
              onClick={handleGetRealDeviceGps}
              className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>Зчитати GPS мого смартфона / браузера</span>
            </button>
          </div>
        </div>
      )}

      {/* Radar Canvas / Animated Scanner */}
      <div className="p-3 flex flex-col items-center justify-center relative">
        <div className="w-72 h-72 rounded-full border border-emerald-500/25 bg-emerald-950/15 relative flex items-center justify-center overflow-hidden shadow-2xl shadow-emerald-950/40">
          {/* Compass labels */}
          <span className="absolute top-1 text-[9px] font-bold text-emerald-500/70 tracking-widest">
            ПН (N)
          </span>
          <span className="absolute bottom-1 text-[9px] font-bold text-emerald-500/70 tracking-widest">
            ПД (S)
          </span>
          <span className="absolute left-1.5 text-[9px] font-bold text-emerald-500/70 tracking-widest">
            ЗХ (W)
          </span>
          <span className="absolute right-1.5 text-[9px] font-bold text-emerald-500/70 tracking-widest">
            СХ (E)
          </span>

          {/* Concentric distance rings proportional to selected radius */}
          <div className="w-56 h-56 rounded-full border border-emerald-500/20 absolute flex items-start justify-center">
            <span className="text-[8px] text-emerald-400/50 mt-1">{(radarRadiusKm * 0.75).toFixed(1)} км</span>
          </div>
          <div className="w-36 h-36 rounded-full border border-emerald-500/20 absolute flex items-start justify-center">
            <span className="text-[8px] text-emerald-400/50 mt-1">{(radarRadiusKm * 0.5).toFixed(1)} км</span>
          </div>
          <div className="w-20 h-20 rounded-full border border-emerald-500/25 absolute flex items-start justify-center">
            <span className="text-[8px] text-emerald-400/50 mt-0.5">{(radarRadiusKm * 0.25).toFixed(1)} км</span>
          </div>

          {/* Crosshairs */}
          <div className="absolute w-full h-[1px] bg-emerald-500/10" />
          <div className="absolute h-full w-[1px] bg-emerald-500/10" />

          {/* Rotating radar sweep line */}
          <div
            className="absolute inset-0 origin-center pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(16, 185, 129, 0.28) 0deg, transparent 65deg, transparent 360deg)',
              animation: 'spin 4s linear infinite',
            }}
          />

          {/* Center User Point */}
          <div className="relative z-10 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/50">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span className="w-2 h-2 rounded-full bg-white absolute" />
            <span className="absolute -bottom-4 text-[8px] font-bold text-emerald-300 whitespace-nowrap bg-neutral-900/90 px-1 rounded border border-emerald-800/40">
              Ви тут
            </span>
          </div>

          {/* Dynamic Radar Buddies Dots Positioned by REAL Bearing & Distance */}
          {buddiesInRadius.map((buddy) => {
            // Calculate pixel offset from center (radar container is 288x288, radius is 144px, safe area ~126px)
            const radarRadiusPx = 122;
            const distanceFraction = Math.min(buddy.distanceKm / radarRadiusKm, 0.94);
            const r = Math.max(22, distanceFraction * radarRadiusPx);

            // Bearing: 0 deg is North (-y), 90 deg is East (+x), 180 deg is South (+y), 270 deg is West (-x)
            const bearingRad = (buddy.bearing * Math.PI) / 180;
            const x = Math.sin(bearingRad) * r;
            const y = -Math.cos(bearingRad) * r;

            const isSelected = selectedBuddy?.id === buddy.id;

            return (
              <button
                key={buddy.id}
                id={`radar-dot-${buddy.id}`}
                type="button"
                onClick={() => {
                  sounds.playClink();
                  setSelectedBuddy(buddy);
                }}
                className="absolute z-20 group transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 hover:scale-125 focus:outline-none"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                }}
              >
                <div className="relative">
                  <div
                    className={`w-8 h-8 rounded-full overflow-hidden shadow-lg bg-neutral-900 transition-all ${
                      isSelected
                        ? 'ring-2 ring-amber-400 scale-110 shadow-amber-500/50'
                        : 'border-2 border-amber-400/80 hover:border-amber-300'
                    }`}
                  >
                    <img
                      src={buddy.avatar}
                      alt={buddy.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {buddy.activeCheckIn && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-neutral-950 animate-ping" />
                  )}

                  {/* Tooltip on hover / selection */}
                  <div
                    className={`absolute top-8 left-1/2 transform -translate-x-1/2 bg-neutral-900/95 text-neutral-100 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-neutral-700 whitespace-nowrap shadow-md pointer-events-none transition ${
                      isSelected ? 'opacity-100 ring-1 ring-amber-400' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {buddy.name} ({formatDistance(buddy.distanceKm)})
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status subtext */}
        <div className="mt-2 text-center">
          <p className="text-[11px] font-medium text-neutral-300">
            Знайдено <span className="text-amber-400 font-bold">{buddiesInRadius.length}</span> людей для компанії у радіусі {radarRadiusKm} км
          </p>
          <p className="text-[10px] text-neutral-500">
            Торкніться аватара на радарі для тосту, чату або перегляду бару
          </p>
        </div>
      </div>

      {/* Selected Buddy Quick Bottom Card */}
      {selectedBuddy && (
        <div className="mx-4 mb-3 p-3 bg-neutral-900/95 rounded-2xl border border-amber-500/40 shadow-2xl relative animate-in fade-in slide-in-from-bottom-2">
          <button
            type="button"
            id="close-selected-buddy-btn"
            onClick={() => setSelectedBuddy(null)}
            className="absolute top-2.5 right-2.5 p-1 text-neutral-400 hover:text-neutral-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-3">
            <img
              src={selectedBuddy.avatar}
              alt={selectedBuddy.name}
              className="w-12 h-12 rounded-xl object-cover border border-amber-400/50 shadow"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                {selectedBuddy.name}, {selectedBuddy.age}
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/70 px-1 rounded border border-amber-800/60">
                  {formatDistance(selectedBuddy.distanceKm)}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {getWalkTimeMinutes(selectedBuddy.distanceKm)}
                </span>
              </h4>
              <p className="text-[11px] text-neutral-300 truncate">{selectedBuddy.tagline}</p>
              {selectedBuddy.activeCheckIn ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-medium mt-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  Зараз у <strong className="text-white">{selectedBuddy.activeCheckIn.barName}</strong>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 mt-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {selectedBuddy.locationName}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              id="selected-view-profile-btn"
              onClick={() => onSelectBuddy(selectedBuddy)}
              className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-[11px] font-semibold text-neutral-200 rounded-lg transition"
            >
              Анкета
            </button>
            <button
              type="button"
              id="selected-write-chat-btn"
              onClick={() => {
                onOpenChat(selectedBuddy);
              }}
              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-[11px] font-bold text-neutral-950 rounded-lg flex items-center justify-center gap-1 transition shadow"
            >
              <Beer className="w-3 h-3" />
              <span>Будьмо! / Чат</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Bar Check-Ins Feed (Sorted by actual GPS distance) */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-400" />
            <span>Хто де сидить просто зараз ({checkIns.length})</span>
          </h3>
          <span className="text-[10px] text-neutral-500">
            За відстанню від вас
          </span>
        </div>

        <div className="space-y-2.5">
          {checkIns.map((buddy) => (
            <div
              key={buddy.id}
              className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 hover:border-neutral-700 transition flex flex-col gap-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={buddy.avatar}
                    alt={buddy.name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-amber-400/50"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      {buddy.name}
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-800/40">
                        {formatDistance(buddy.distanceKm)}
                      </span>
                    </h4>
                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                      <Beer className="w-2.5 h-2.5" />
                      {buddy.activeCheckIn?.barName} ({getWalkTimeMinutes(buddy.distanceKm)})
                    </span>
                  </div>
                </div>

                <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {buddy.activeCheckIn?.sinceTime}
                </span>
              </div>

              <p className="text-xs text-neutral-300 bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80 italic">
                "{buddy.activeCheckIn?.note}"
              </p>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-neutral-400">
                  Пʼє: {buddy.preferredDrinks.join(', ')}
                </span>
                <button
                  type="button"
                  id={`join-bar-btn-${buddy.id}`}
                  onClick={() => onOpenChat(buddy)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <Send className="w-3 h-3" />
                  <span>Підсісти / Чат</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Check-In Modal ("Я в барі!") */}
      {showCheckInModal && (
        <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md z-50 flex flex-col justify-end p-2">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Beer className="w-4 h-4 text-amber-400" />
                Створити чек-ін у закладі
              </h3>
              <button
                type="button"
                id="close-checkin-modal-btn"
                onClick={() => setShowCheckInModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-200 bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCheckIn} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Назва бару чи закладу
                </label>
                <input
                  type="text"
                  id="checkin-bar-input"
                  value={customBar}
                  onChange={(e) => setCustomBar(e.target.value)}
                  placeholder="напр. Squat 17b, Varvar Bar, Win Bar"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Що замовляєте / напій
                </label>
                <input
                  type="text"
                  id="checkin-drink-input"
                  value={drinkChoice}
                  onChange={(e) => setDrinkChoice(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Повідомлення для тих, хто поряд
                </label>
                <textarea
                  id="checkin-note-textarea"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  rows={2}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs resize-none"
                  placeholder="Де сидите, які плани, скільки вільних місць..."
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  id="cancel-checkin-btn"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 py-2 rounded-xl bg-neutral-800 text-neutral-300 font-semibold text-xs"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  id="submit-checkin-btn"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition"
                >
                  Опублікувати на радар
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Activity & Peak Hours Analytics Modal (Recharts) */}
      <ActivityAnalyticsModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
      />
    </div>
  );
};
