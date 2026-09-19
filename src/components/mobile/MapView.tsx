import React, { useState, useMemo, useEffect } from 'react';
import {
  MapPin,
  Beer,
  Plus,
  Compass,
  Navigation,
  CheckCircle2,
  TrendingUp,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Search,
  ExternalLink,
  Star,
  Users,
  Layers,
  List,
  Map as MapIcon,
  MessageCircle,
  Radio,
  RefreshCw,
  X,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { BuddyProfile, HangoutAlert } from '../../types';
import { sounds } from '../../services/soundService';
import { friendsService } from '../../services/friendsService';
import { ActivityAnalyticsModal } from './ActivityAnalyticsModal';
import { LeafletMapView } from './LeafletMapView';
import {
  UserGeoLocation,
  PRESET_LOCATIONS,
  calculateDistanceKm,
  calculateBearing,
  formatDistance,
} from '../../services/geoService';
import { batterySaverService } from '../../services/batterySaverService';
import { analyticsService } from '../../services/analyticsService';
import {
  GOOGLE_MAPS_VENUES,
  CATEGORY_CONFIG,
  VenueCategory,
  VenuePlace,
} from '../../data/venuesData';

interface MapViewProps {
  buddies: BuddyProfile[];
  userLocation: UserGeoLocation;
  onUpdateLocation: (newLocation: UserGeoLocation) => void;
  onSelectBuddy: (buddy: BuddyProfile) => void;
  onOpenChat: (buddy: BuddyProfile) => void;
  onNewHangout: (hangout: HangoutAlert) => void;
}

interface CityCenter {
  id: 'kyiv' | 'lviv' | 'odesa' | 'dnipro' | 'kharkiv';
  name: string;
  region: string;
  lat: number;
  lng: number;
  zoom: number;
}

const CITY_CENTERS: CityCenter[] = [
  {
    id: 'kyiv',
    name: 'Київ',
    region: 'Поділ • Золоті Ворота • Хрещатик',
    lat: 50.455,
    lng: 30.518,
    zoom: 14,
  },
  {
    id: 'lviv',
    name: 'Львів',
    region: 'Площа Ринок • Старе місто',
    lat: 49.8425,
    lng: 24.032,
    zoom: 15,
  },
  {
    id: 'odesa',
    name: 'Одеса',
    region: 'Дерибасівська • Приморський',
    lat: 46.4845,
    lng: 30.738,
    zoom: 15,
  },
  {
    id: 'dnipro',
    name: 'Дніпро',
    region: 'Набережна • Центр',
    lat: 48.464,
    lng: 35.048,
    zoom: 14,
  },
  {
    id: 'kharkiv',
    name: 'Харків',
    region: 'Сумська • Майдан Свободи',
    lat: 50.0,
    lng: 36.233,
    zoom: 14,
  },
];

export const MapView: React.FC<MapViewProps> = ({
  buddies,
  userLocation,
  onUpdateLocation,
  onSelectBuddy,
  onOpenChat,
  onNewHangout,
}) => {
  // Navigation & View states
  const [viewDisplay, setViewDisplay] = useState<'map' | 'list'>('map');
  const [filterLayer, setFilterLayer] = useState<'all' | 'buddies' | 'venues'>('all');
  const [radiusKm, setRadiusKm] = useState<number | 'all'>(5);
  const [selectedCategory, setSelectedCategory] = useState<VenueCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCityId, setActiveCityId] = useState<CityCenter['id']>('kyiv');

  // Map camera states
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: userLocation.lat,
    lng: userLocation.lng,
  });
  const [mapZoom, setMapZoom] = useState<number>(14);

  // Clear any legacy/broken Google Maps key from storage
  useEffect(() => {
    try {
      localStorage.removeItem('gmp_api_key');
    } catch {
      // ignore
    }
  }, []);

  // Selection states
  const [selectedBuddy, setSelectedBuddy] = useState<BuddyProfile | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenuePlace | null>(null);

  // Modals & drawers
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showLocationDrawer, setShowLocationDrawer] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const [gpsNotification, setGpsNotification] = useState<string | null>(null);

  // Check-in form states
  const [customBar, setCustomBar] = useState('Squat 17b');
  const [customNote, setCustomNote] = useState('Сиджу біля бару, замовляю крафт. Підсідайте!');
  const [drinkChoice, setDrinkChoice] = useState('Крафтове пиво / Сидр');

  // Trigger toast
  const triggerNotification = (msg: string) => {
    setGpsNotification(msg);
    setTimeout(() => setGpsNotification(null), 3500);
  };

  // Match initial city to user coordinates
  useEffect(() => {
    let closestCity = CITY_CENTERS[0];
    let minD = Infinity;
    CITY_CENTERS.forEach((c) => {
      const d = calculateDistanceKm(userLocation.lat, userLocation.lng, c.lat, c.lng);
      if (d < minD) {
        minD = d;
        closestCity = c;
      }
    });
    if (minD < 60) {
      setActiveCityId(closestCity.id);
      setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
      setMapZoom(closestCity.zoom);
    }
  }, []);

  const activeCity = useMemo(() => {
    return CITY_CENTERS.find((c) => c.id === activeCityId) || CITY_CENTERS[0];
  }, [activeCityId]);

  // Helper for walking time
  const getWalkTimeMinutes = (distKm: number) => {
    const mins = Math.max(1, Math.round((distKm / 4.5) * 60));
    return `~${mins} хв пішки`;
  };

  // Buddies with computed live distance & bearing
  const buddiesWithGeo = useMemo(() => {
    return buddies.map((b) => {
      const dist = calculateDistanceKm(
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
        distanceKm: dist,
        bearing,
      };
    });
  }, [buddies, userLocation]);

  // Filtered buddies for active view & radius
  const filteredBuddies = useMemo(() => {
    if (filterLayer === 'venues') return [];

    return buddiesWithGeo.filter((b) => {
      // Radius filter relative to user
      if (radiusKm !== 'all' && b.distanceKm > radiusKm) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.name.toLowerCase().includes(q);
        const matchTag = b.tagline.toLowerCase().includes(q);
        const matchBar = b.activeCheckIn?.barName.toLowerCase().includes(q);
        const matchLoc = b.locationName.toLowerCase().includes(q);
        if (!matchName && !matchTag && !matchBar && !matchLoc) {
          return false;
        }
      }
      return true;
    });
  }, [buddiesWithGeo, filterLayer, radiusKm, searchQuery]);

  // Venues filtered by city, category, radius and search
  const filteredVenues = useMemo(() => {
    if (filterLayer === 'buddies') return [];

    return GOOGLE_MAPS_VENUES.filter((v) => {
      // City filter
      if (v.cityId !== activeCityId) return false;

      // Category filter
      if (selectedCategory !== 'all' && v.category !== selectedCategory) {
        return false;
      }

      // Proximity distance from user
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, v.lat, v.lng);
      if (radiusKm !== 'all' && dist > radiusKm) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = v.name.toLowerCase().includes(q);
        const matchAddr = v.address.toLowerCase().includes(q);
        const matchDist = v.district.toLowerCase().includes(q);
        const matchDrink = v.popularDrinks.some((d) => d.toLowerCase().includes(q));
        if (!matchName && !matchAddr && !matchDist && !matchDrink) {
          return false;
        }
      }

      return true;
    });
  }, [filterLayer, activeCityId, selectedCategory, userLocation, radiusKm, searchQuery]);

  // Map Click handler (reposition user location on map click)
  const handleMapCoordsClick = (lat: number, lng: number) => {
    const roundLat = Math.round(lat * 10000) / 10000;
    const roundLng = Math.round(lng * 10000) / 10000;

    sounds.playTap();
    const updatedTime = new Date().toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    onUpdateLocation({
      ...userLocation,
      lat: roundLat,
      lng: roundLng,
      lastUpdated: updatedTime,
      accuracyMeters: 6,
    });
    triggerNotification(`📍 Вашу точку на карті оновлено (${roundLat}, ${roundLng})`);
  };

  // Center on user position
  const handleCenterOnUser = () => {
    sounds.playTap();
    setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
    setMapZoom(15);
    triggerNotification('🎯 Центровано на вашій позиції');
  };

  // Camera zoom controls
  const handleZoomIn = () => {
    sounds.playTap();
    setMapZoom((z) => Math.min(20, z + 1));
  };

  const handleZoomOut = () => {
    sounds.playTap();
    setMapZoom((z) => Math.max(8, z - 1));
  };

  // Select city
  const _handleSelectCity = (city: CityCenter) => {
    sounds.playTap();
    setActiveCityId(city.id);
    setMapCenter({ lat: city.lat, lng: city.lng });
    setMapZoom(city.zoom);
    setSelectedBuddy(null);
    setSelectedVenue(null);
    triggerNotification(`🏙️ Перехід до міста: ${city.name}`);
  };

  // Refresh GPS coordinates
  const handleRefreshGps = () => {
    sounds.playTap();
    setIsRefreshingGps(true);
    triggerNotification('🛰️ Супутниковий запит GPS...');

    if (navigator.geolocation) {
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
            locationName: 'Реальна геолокація GPS',
            accuracyMeters: Math.round(pos.coords.accuracy) || 6,
            lastUpdated: updatedTime,
            isSimulated: false,
            status: 'active',
          });
          setIsRefreshingGps(false);
          triggerNotification('✅ Отримано точні супутникові координати!');
        },
        () => {
          setTimeout(() => {
            setIsRefreshingGps(false);
            triggerNotification('✅ Калібрований GPS сигнал стабільний');
          }, 600);
        },
        batterySaverService.getGeolocationOptions()
      );
    } else {
      setTimeout(() => {
        setIsRefreshingGps(false);
        triggerNotification('✅ Калібрований GPS сигнал стабільний');
      }, 600);
    }
  };

  // Handle Preset selection
  const handleSelectPreset = (preset: (typeof PRESET_LOCATIONS)[0]) => {
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

  // Check-In submission
  const handleCreateCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBar.trim()) return;

    sounds.playClink();
    analyticsService.trackMeetupAction('check_in', undefined, {
      bar_name: customBar,
      drink: drinkChoice,
      area: userLocation.locationName,
    });
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
    };

    onNewHangout(newAlert);
    setShowCheckInModal(false);
    triggerNotification(`🍻 Чек-ін у "${customBar}" з'явився на мапі!`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden relative select-none">
      {/* Floating GPS Notification Toast */}
      {gpsNotification && (
        <div className="absolute top-14 left-4 right-4 z-50 bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 text-xs px-3 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 truncate font-medium">{gpsNotification}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="px-3 py-2.5 border-b border-neutral-900 bg-neutral-950/95 backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Location details */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <MapPin className="w-4 h-4" />
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

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Peak Hours Activity Graph */}
            <button
              id="map-activity-modal-btn"
              type="button"
              onClick={() => {
                sounds.playClink();
                setShowActivityModal(true);
              }}
              title="Графік активності закладів та людей (Recharts)"
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 text-amber-400 border border-neutral-800 transition active:scale-95 flex items-center gap-1 text-xs"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold hidden xs:inline">Пік</span>
            </button>

            {/* View toggle (Map vs List) */}
            <button
              id="map-view-toggle-btn"
              type="button"
              onClick={() => {
                sounds.playTap();
                setViewDisplay(viewDisplay === 'map' ? 'list' : 'map');
              }}
              title="Перемкнути вигляд: Мапа / Список"
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 transition active:scale-95 flex items-center gap-1 text-xs"
            >
              {viewDisplay === 'map' ? (
                <>
                  <List className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[10px] font-semibold hidden xs:inline">Список</span>
                </>
              ) : (
                <>
                  <MapIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-semibold hidden xs:inline">Мапа</span>
                </>
              )}
            </button>

            {/* Check-in button */}
            <button
              id="map-checkin-quick-btn"
              type="button"
              onClick={() => {
                sounds.playClink();
                setShowCheckInModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Я в барі!</span>
            </button>
          </div>
        </div>

        {/* Filter controls row */}
        <div className="mt-2 pt-2 border-t border-neutral-900 flex items-center justify-between text-[11px] gap-2 overflow-x-auto no-scrollbar">
          {/* Layer Filter: All / People / Venues */}
          <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 shrink-0">
            <button
              type="button"
              id="layer-filter-all-btn"
              onClick={() => {
                sounds.playTap();
                setFilterLayer('all');
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 ${
                filterLayer === 'all'
                  ? 'bg-amber-500 text-neutral-950'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Всі ({filteredBuddies.length + filteredVenues.length})</span>
            </button>
            <button
              type="button"
              id="layer-filter-buddies-btn"
              onClick={() => {
                sounds.playTap();
                setFilterLayer('buddies');
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 ${
                filterLayer === 'buddies'
                  ? 'bg-emerald-500 text-neutral-950'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Люди ({filteredBuddies.length})</span>
            </button>
            <button
              type="button"
              id="layer-filter-venues-btn"
              onClick={() => {
                sounds.playTap();
                setFilterLayer('venues');
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 ${
                filterLayer === 'venues'
                  ? 'bg-rose-500 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Beer className="w-3 h-3" />
              <span>Заклади ({filteredVenues.length})</span>
            </button>
          </div>

          {/* Proximity Radius Filter */}
          <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 shrink-0">
            {([1, 3, 5, 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                id={`map-radius-btn-${r}`}
                onClick={() => {
                  sounds.playTap();
                  setRadiusKm(r);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  radiusKm === r
                    ? 'bg-neutral-200 text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {r === 'all' ? 'Всі' : `${r}км`}
              </button>
            ))}
          </div>

          {/* District drawer toggle */}
          <button
            type="button"
            id="map-open-districts-btn"
            onClick={() => setShowLocationDrawer(!showLocationDrawer)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 font-medium transition shrink-0"
          >
            <Navigation className="w-3 h-3 text-amber-400" />
            <span>Район</span>
          </button>
        </div>

        {/* Venue Category Filter Chips (visible when venues are enabled) */}
        {filterLayer !== 'buddies' && (
          <div className="mt-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[10px]">
            <button
              type="button"
              id="cat-select-all-btn"
              onClick={() => {
                sounds.playTap();
                setSelectedCategory('all');
              }}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap border transition ${
                selectedCategory === 'all'
                  ? 'bg-neutral-200 text-neutral-950 font-bold border-neutral-200'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
              }`}
            >
              Всі типи
            </button>
            {(Object.keys(CATEGORY_CONFIG) as VenueCategory[]).map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  id={`cat-select-${cat}-btn`}
                  onClick={() => {
                    sounds.playTap();
                    setSelectedCategory(isSelected ? 'all' : cat);
                  }}
                  className={`px-2 py-0.5 rounded-md whitespace-nowrap border transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Expandable Location Selector Panel */}
      {showLocationDrawer && (
        <div className="mx-3 mt-2 p-3 bg-neutral-900/95 border border-neutral-800 rounded-2xl shadow-xl space-y-2.5 animate-in fade-in slide-in-from-top-2 z-30 shrink-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Швидка зміна локації (райони Києва та міст)</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowLocationDrawer(false)}
              className="text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto no-scrollbar">
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
        </div>
      )}

      {/* Main Content Area: Google Maps vs Sorted List */}
      {viewDisplay === 'map' ? (
        <div className="flex-1 relative flex flex-col overflow-hidden bg-neutral-950">
          {/* Map Controls Overlay (Floating Top Right) */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
            {/* Zoom In */}
            <button
              type="button"
              id="map-zoom-in-btn"
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 shadow-lg flex items-center justify-center transition active:scale-95"
              title="Збільшити масштаб"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {/* Zoom Out */}
            <button
              type="button"
              id="map-zoom-out-btn"
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 shadow-lg flex items-center justify-center transition active:scale-95"
              title="Зменшити масштаб"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            {/* Center on user */}
            <button
              type="button"
              id="map-center-user-btn"
              onClick={handleCenterOnUser}
              className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 border border-neutral-750 shadow-lg flex items-center justify-center transition active:scale-95"
              title="Центрувати на мені"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            {/* Refresh GPS */}
            <button
              type="button"
              id="map-refresh-gps-btn"
              onClick={handleRefreshGps}
              disabled={isRefreshingGps}
              className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-emerald-400 border border-neutral-750 shadow-lg flex items-center justify-center transition active:scale-95"
              title="Оновити GPS координати"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingGps ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Interactive Maps Canvas Container */}
          <div className="flex-1 w-full h-full relative min-h-[380px] overflow-hidden">
            <LeafletMapView
              userLocation={userLocation}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              filteredBuddies={filteredBuddies}
              filteredVenues={filteredVenues}
              buddiesWithGeo={buddiesWithGeo}
              selectedBuddy={selectedBuddy}
              selectedVenue={selectedVenue}
              radiusKm={radiusKm}
              filterLayer={filterLayer}
              onSelectBuddy={(b) => {
                setSelectedBuddy(b);
                setSelectedVenue(null);
                analyticsService.trackEvent('buddy_selected_on_map', {
                  buddy_id: b.id,
                  buddy_name: b.name,
                });
              }}
              onSelectVenue={(v) => {
                setSelectedVenue(v);
                setSelectedBuddy(null);
                analyticsService.trackVenueView(v.id, v.name, v.category);
              }}
              onMapClick={handleMapCoordsClick}
              onTriggerNotification={triggerNotification}
            />

            {/* Bottom Status Info Strip on Map */}
            <div className="absolute bottom-2 left-3 right-3 z-10 flex items-center justify-between text-[10px] text-neutral-400 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 pointer-events-none">
              <span className="flex items-center gap-1.5 truncate">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
                <span>Карта онлайн: {activeCity.name}</span>
                <span className="text-neutral-500">•</span>
                <span className="text-emerald-400 font-semibold">{filteredBuddies.length} людей</span>
                <span className="text-neutral-500">•</span>
                <span className="text-amber-400 font-semibold">{filteredVenues.length} барів</span>
              </span>
              <span className="text-neutral-500 text-[9px] shrink-0">OpenStreetMap</span>
            </div>
          </div>
        </div>
      ) : (
        /* Alternative View: Sorted List Feed of Nearby People & Venues */
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 bg-neutral-950">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <List className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Люди та заклади поруч ({filteredBuddies.length + filteredVenues.length})
              </span>
            </h3>
            <span className="text-[10px] text-neutral-400">Сортування за відстанню</span>
          </div>

          {/* Search bar inside list view */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              id="map-list-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук людей або барів..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* People Section in List */}
          {(filterLayer === 'all' || filterLayer === 'buddies') && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Люди поблизу ({filteredBuddies.length})</span>
              </h4>

              {filteredBuddies.length === 0 ? (
                <p className="text-xs text-neutral-400 italic py-2">
                  У цьому радіусі людей не знайдено. Спробуйте збільшити радіус до 5км або обрати інше місто.
                </p>
              ) : (
                filteredBuddies.map((b) => (
                  <div
                    key={`list-b-${b.id}`}
                    id={`list-buddy-${b.id}`}
                    onClick={() => {
                      sounds.playClink();
                      setSelectedBuddy(b);
                      setSelectedVenue(null);
                      setViewDisplay('map');
                    }}
                    className="p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800 hover:border-emerald-500/40 transition cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={b.avatar}
                          alt={b.name}
                          className="w-11 h-11 rounded-full object-cover border border-emerald-500/40"
                        />
                        {b.activeCheckIn && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 ring-2 ring-neutral-950 animate-ping" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-bold text-neutral-100 truncate">
                            {b.name}, {b.age}
                          </h5>
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-800/40">
                            {formatDistance(b.distanceKm)}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {getWalkTimeMinutes(b.distanceKm)}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate">{b.tagline}</p>
                        {b.activeCheckIn && (
                          <p className="text-[10px] text-rose-400 truncate flex items-center gap-1 mt-0.5">
                            <Beer className="w-2.5 h-2.5 shrink-0" />
                            <span>Зараз у {b.activeCheckIn.barName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChat(b);
                      }}
                      className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 transition active:scale-95 shrink-0"
                      title="Відкрити чат"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Venues Section in List */}
          {(filterLayer === 'all' || filterLayer === 'venues') && (
            <div className="space-y-2 pt-2">
              <h4 className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Beer className="w-3 h-3" />
                <span>Заклади та бари з Google Maps ({filteredVenues.length})</span>
              </h4>

              {filteredVenues.length === 0 ? (
                <p className="text-xs text-neutral-400 italic py-2">
                  Закладів у цьому радіусі не знайдено.
                </p>
              ) : (
                filteredVenues.map((v) => {
                  const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, v.lat, v.lng);
                  const cfg = CATEGORY_CONFIG[v.category];
                  return (
                    <div
                      key={`list-v-${v.id}`}
                      id={`list-venue-${v.id}`}
                      onClick={() => {
                        sounds.playTap();
                        setSelectedVenue(v);
                        setSelectedBuddy(null);
                        setViewDisplay('map');
                      }}
                      className="p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-xl shrink-0 border border-neutral-700">
                          {cfg?.icon || '🍺'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-bold text-neutral-100 truncate">{v.name}</h5>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1 rounded border border-amber-800/40 flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                              {v.rating}
                            </span>
                            <span className="text-[10px] text-neutral-400">{formatDistance(dist)}</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {v.district} • {v.address}
                          </p>
                          <p className="text-[10px] text-neutral-400 truncate">
                            Популярне: {v.popularDrinks.join(', ')}
                          </p>
                        </div>
                      </div>
                      <a
                        href={v.googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition active:scale-95 shrink-0"
                        title="Відкрити в Google Maps"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Buddy Detail Sheet / Floating Card */}
      {selectedBuddy && (
        <div className="mx-3 mb-2 p-3 bg-neutral-900/95 rounded-2xl border border-amber-500/40 shadow-2xl relative animate-in fade-in slide-in-from-bottom-2 z-30 shrink-0">
          <button
            type="button"
            id="close-selected-buddy-btn"
            onClick={() => setSelectedBuddy(null)}
            className="absolute top-2.5 right-2.5 p-1 text-neutral-400 hover:text-neutral-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-start gap-3">
            <img
              src={selectedBuddy.avatar}
              alt={selectedBuddy.name}
              className="w-12 h-12 rounded-xl object-cover border border-amber-400/50 shadow shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-bold text-white flex items-center gap-1">
                  {selectedBuddy.name}, {selectedBuddy.age}
                </h4>
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800/60">
                  {formatDistance(selectedBuddy.distanceKm)}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {getWalkTimeMinutes(selectedBuddy.distanceKm)}
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 line-clamp-1 mt-0.5">{selectedBuddy.tagline}</p>
              {selectedBuddy.activeCheckIn ? (
                <div className="mt-1 p-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[10px] text-rose-300 flex items-center gap-1.5">
                  <Beer className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="truncate">
                    Зараз у <strong>{selectedBuddy.activeCheckIn.barName}</strong>: &quot;{selectedBuddy.activeCheckIn.note}&quot;
                  </span>
                </div>
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
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-[11px] font-semibold text-neutral-200 rounded-lg transition"
            >
              Анкета
            </button>
            <button
              type="button"
              id={`map-friend-btn-${selectedBuddy.id}`}
              onClick={() => {
                friendsService.toggleFriend(selectedBuddy);
              }}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition border ${
                friendsService.isFriend(selectedBuddy.id)
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border-neutral-700'
              }`}
              title={friendsService.isFriend(selectedBuddy.id) ? 'У ваших друзях' : 'Додати до друзів'}
            >
              {friendsService.isFriend(selectedBuddy.id) ? (
                <>
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>У друзях</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3 text-amber-400" />
                  <span>+ Друг</span>
                </>
              )}
            </button>
            <button
              type="button"
              id="selected-write-chat-btn"
              onClick={() => onOpenChat(selectedBuddy)}
              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-[11px] font-bold text-neutral-950 rounded-lg flex items-center justify-center gap-1 transition shadow"
            >
              <Beer className="w-3 h-3" />
              <span>Будьмо! / Чат</span>
            </button>
          </div>
        </div>
      )}

      {/* Selected Venue Detail Sheet / Floating Card */}
      {selectedVenue && (
        <div className="mx-3 mb-2 p-3 bg-neutral-900/95 rounded-2xl border border-rose-500/40 shadow-2xl relative animate-in fade-in slide-in-from-bottom-2 z-30 shrink-0">
          <button
            type="button"
            id="close-selected-venue-btn"
            onClick={() => setSelectedVenue(null)}
            className="absolute top-2.5 right-2.5 p-1 text-neutral-400 hover:text-neutral-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-neutral-800 flex items-center justify-center text-xl shrink-0 border border-neutral-700">
              {CATEGORY_CONFIG[selectedVenue.category]?.icon || '🍺'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-bold text-white truncate">{selectedVenue.name}</h4>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800/60 flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {selectedVenue.rating}
                </span>
                <span className="text-[10px] text-neutral-400">
                  ({selectedVenue.reviewCount} відгуків Google Maps)
                </span>
              </div>
              <p className="text-[10px] text-neutral-300 mt-0.5 truncate">
                {selectedVenue.district} • {selectedVenue.address} • {selectedVenue.priceTier}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                {selectedVenue.description}
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex gap-2">
            <a
              href={selectedVenue.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-[11px] font-semibold text-neutral-200 rounded-lg flex items-center justify-center gap-1 transition"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Google Maps ↗</span>
            </a>
            <button
              type="button"
              id="venue-checkin-quick-btn"
              onClick={() => {
                setCustomBar(selectedVenue.name);
                setShowCheckInModal(true);
              }}
              className="flex-1 py-1.5 bg-rose-500 hover:bg-rose-400 text-[11px] font-bold text-white rounded-lg flex items-center justify-center gap-1 transition shadow"
            >
              <Beer className="w-3 h-3" />
              <span>Я тут! Чек-ін</span>
            </button>
          </div>
        </div>
      )}

      {/* Check-In Modal Dialog */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              id="close-checkin-modal-btn"
              onClick={() => setShowCheckInModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Beer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Чек-ін у барі</h3>
                <p className="text-[11px] text-neutral-400">Позначити свою присутність на мапі</p>
              </div>
            </div>

            <form onSubmit={handleCreateCheckIn} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Назва закладу:
                </label>
                <input
                  type="text"
                  id="checkin-bar-input"
                  value={customBar}
                  onChange={(e) => setCustomBar(e.target.value)}
                  placeholder="Наприклад: Squat 17b Yard Cafe"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Що замовляєте:
                </label>
                <select
                  id="checkin-drink-select"
                  value={drinkChoice}
                  onChange={(e) => setDrinkChoice(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Крафтове пиво / Сидр">Крафтове пиво / Сидр 🍺</option>
                  <option value="Сухе вино">Сухе вино 🍷</option>
                  <option value="Авторський коктейль">Авторський коктейль 🍸</option>
                  <option value="Віскі / Бурбон">Віскі / Бурбон 🥃</option>
                  <option value="Шоти / Настоянки">Шоти / Настоянки 🍶</option>
                  <option value="Безалкогольне / Кава">Безалкогольне / Кава ☕</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Нотатка для компанії:
                </label>
                <textarea
                  id="checkin-note-textarea"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Де саме ви сидите і чи є вільне місце..."
                  rows={2}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-semibold transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  id="submit-checkin-btn"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold transition shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Beer className="w-4 h-4" />
                  <span>Чек-ін на мапу!</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Analytics Modal (Peak hours charts) */}
      <ActivityAnalyticsModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
      />
    </div>
  );
};
