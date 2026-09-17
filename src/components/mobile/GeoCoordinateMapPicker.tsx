import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  Locate, 
  Beer, 
  Crosshair,
  Search,
  ExternalLink,
  Star,
  MapPin,
  X,
  Sparkles,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { calculateDistanceKm, formatDistance } from '../../services/geoService';
import { 
  GOOGLE_MAPS_VENUES, 
  CATEGORY_CONFIG, 
  VenueCategory, 
  VenuePlace, 
  parseGoogleMapsInput 
} from '../../data/venuesData';
import { sounds } from '../../services/soundService';

interface GeoCoordinateMapPickerProps {
  initialLat: number;
  initialLng: number;
  initialName?: string;
  onApplyCoordinates: (lat: number, lng: number, placeName: string) => void;
  onCancel?: () => void;
}

interface MapCityPreset {
  id: 'kyiv' | 'lviv' | 'odesa' | 'dnipro' | 'kharkiv';
  name: string;
  region: string;
  lat: number;
  lng: number;
  zoomSpan: { latSpan: number; lngSpan: number };
}

const CITY_PRESETS: MapCityPreset[] = [
  {
    id: 'kyiv',
    name: 'Київ',
    region: 'Поділ • Золоті Ворота • Центр',
    lat: 50.4550,
    lng: 30.5180,
    zoomSpan: { latSpan: 0.08, lngSpan: 0.12 },
  },
  {
    id: 'lviv',
    name: 'Львів',
    region: 'Площа Ринок • Старе місто',
    lat: 49.8425,
    lng: 24.0320,
    zoomSpan: { latSpan: 0.016, lngSpan: 0.024 },
  },
  {
    id: 'odesa',
    name: 'Одеса',
    region: 'Дерибасівська • Приморський',
    lat: 46.4845,
    lng: 30.7380,
    zoomSpan: { latSpan: 0.018, lngSpan: 0.026 },
  },
  {
    id: 'dnipro',
    name: 'Дніпро',
    region: 'Набережна • Центр',
    lat: 48.4640,
    lng: 35.0480,
    zoomSpan: { latSpan: 0.020, lngSpan: 0.030 },
  },
  {
    id: 'kharkiv',
    name: 'Харків',
    region: 'Сумська • Майдан Свободи',
    lat: 50.0000,
    lng: 36.2330,
    zoomSpan: { latSpan: 0.022, lngSpan: 0.032 },
  },
];

export const GeoCoordinateMapPicker: React.FC<GeoCoordinateMapPickerProps> = ({
  initialLat,
  initialLng,
  initialName = '',
  onApplyCoordinates,
  onCancel,
}) => {
  const [selectedLat, setSelectedLat] = useState<number>(initialLat || 50.4635);
  const [selectedLng, setSelectedLng] = useState<number>(initialLng || 30.5180);
  const [placeName, setPlaceName] = useState<string>(initialName);
  const [zoomLevel, setZoomLevel] = useState<number>(1.1);
  const [activeCityId, setActiveCityId] = useState<MapCityPreset['id']>('kyiv');
  const [selectedCategory, setSelectedCategory] = useState<VenueCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVenue, setSelectedVenue] = useState<VenuePlace | null>(null);
  const [isFineTuneOpen, setIsFineTuneOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const mapSvgRef = useRef<SVGSVGElement | null>(null);

  // Match initial coordinates to the closest city preset on mount
  useEffect(() => {
    let closestCity = CITY_PRESETS[0];
    let minDistance = Infinity;
    CITY_PRESETS.forEach(c => {
      const d = calculateDistanceKm(selectedLat, selectedLng, c.lat, c.lng);
      if (d < minDistance) {
        minDistance = d;
        closestCity = c;
      }
    });
    // If within 50km of another city, set that city as active
    if (minDistance < 50) {
      setActiveCityId(closestCity.id);
    }
  }, []);

  // Map viewport center and span
  const activeCity = useMemo(() => {
    return CITY_PRESETS.find(c => c.id === activeCityId) || CITY_PRESETS[0];
  }, [activeCityId]);

  // Dynamic bounds depending on center and zoom
  const currentSpan = useMemo(() => {
    return {
      latSpan: activeCity.zoomSpan.latSpan / zoomLevel,
      lngSpan: activeCity.zoomSpan.lngSpan / zoomLevel,
    };
  }, [activeCity, zoomLevel]);

  // Bounding box for mapping coordinates to SVG viewBox (0, 0, 600, 420)
  const mapBounds = useMemo(() => {
    const centerLat = activeCity.lat;
    const centerLng = activeCity.lng;

    return {
      minLat: centerLat - currentSpan.latSpan / 2,
      maxLat: centerLat + currentSpan.latSpan / 2,
      minLng: centerLng - currentSpan.lngSpan / 2,
      maxLng: centerLng + currentSpan.lngSpan / 2,
    };
  }, [activeCity, currentSpan]);

  // Convert (lat, lng) to SVG (x, y)
  const coordsToSvg = (lat: number, lng: number) => {
    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 600;
    // Latitude increases northwards, SVG y increases downwards
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * 420;
    return { x, y };
  };

  // Convert SVG (x, y) back to (lat, lng)
  const svgToCoords = (x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(600, x));
    const clampedY = Math.max(0, Math.min(420, y));

    const lng = mapBounds.minLng + (clampedX / 600) * (mapBounds.maxLng - mapBounds.minLng);
    const lat = mapBounds.maxLat - (clampedY / 420) * (mapBounds.maxLat - mapBounds.minLat);

    return {
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
    };
  };

  // Filter venues by active city, category, and search query
  const cityVenues = useMemo(() => {
    return GOOGLE_MAPS_VENUES.filter(v => v.cityId === activeCityId);
  }, [activeCityId]);

  const filteredVenues = useMemo(() => {
    return cityVenues.filter(v => {
      if (selectedCategory !== 'all' && v.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = v.name.toLowerCase().includes(q);
        const matchAddress = v.address.toLowerCase().includes(q);
        const matchDistrict = v.district.toLowerCase().includes(q);
        const matchDrink = v.popularDrinks.some(d => d.toLowerCase().includes(q));
        if (!matchName && !matchAddress && !matchDistrict && !matchDrink) {
          return false;
        }
      }
      return true;
    });
  }, [cityVenues, selectedCategory, searchQuery]);

  // Nearest venue to current pin
  const nearestVenue = useMemo(() => {
    let bestDist = Infinity;
    let bestVenue: VenuePlace | null = null;

    cityVenues.forEach(v => {
      const d = calculateDistanceKm(selectedLat, selectedLng, v.lat, v.lng);
      if (d < bestDist) {
        bestDist = d;
        bestVenue = v;
      }
    });

    if (!bestVenue) return null;
    return { venue: bestVenue, distanceKm: bestDist };
  }, [cityVenues, selectedLat, selectedLng]);

  // Handle click on map SVG to relocate pin
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!mapSvgRef.current) return;
    const rect = mapSvgRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 600;
    const clickY = ((e.clientY - rect.top) / rect.height) * 420;

    const newCoords = svgToCoords(clickX, clickY);
    setSelectedLat(newCoords.lat);
    setSelectedLng(newCoords.lng);
    sounds.playTap();

    // Check if clicked close to a known venue (< 150m)
    let closestVenue: VenuePlace | null = null;
    let minD = Infinity;
    cityVenues.forEach(v => {
      const d = calculateDistanceKm(newCoords.lat, newCoords.lng, v.lat, v.lng);
      if (d < minD) {
        minD = d;
        closestVenue = v;
      }
    });

    if (closestVenue && minD < 0.15) {
      const v = closestVenue as VenuePlace;
      setSelectedVenue(v);
      setPlaceName(`${v.name} (${v.district})`);
    } else if (closestVenue && minD < 0.5) {
      const v = closestVenue as VenuePlace;
      setSelectedVenue(null);
      setPlaceName(`${v.district}, біля ${v.name} (~${Math.round(minD * 1000)}м)`);
    } else {
      setSelectedVenue(null);
      setPlaceName(`${activeCity.name} (${newCoords.lat}, ${newCoords.lng})`);
    }
  };

  // Select a specific venue (from pin, carousel, or search)
  const handleSelectVenue = (venue: VenuePlace) => {
    setSelectedVenue(venue);
    setSelectedLat(venue.lat);
    setSelectedLng(venue.lng);
    setPlaceName(`${venue.name} (${venue.address})`);
    sounds.playTap();
  };

  // Switch City
  const handleSelectCity = (preset: MapCityPreset) => {
    setActiveCityId(preset.id);
    setSelectedLat(preset.lat);
    setSelectedLng(preset.lng);
    setSelectedVenue(null);
    setSearchQuery('');
    setSelectedCategory('all');
    setPlaceName(`${preset.name}, ${preset.region}`);
    sounds.playClink();
  };

  // Handle Google Maps input (URL, coordinates, or query text)
  const handleGoogleMapsInput = (input: string) => {
    setSearchQuery(input);
    const parsed = parseGoogleMapsInput(input);
    if (parsed) {
      setSelectedLat(parsed.lat);
      setSelectedLng(parsed.lng);
      sounds.playClink();

      // Check if coordinates match an existing venue
      const matchedVenue = GOOGLE_MAPS_VENUES.find(
        v => Math.abs(v.lat - parsed.lat) < 0.002 && Math.abs(v.lng - parsed.lng) < 0.002
      );

      if (matchedVenue) {
        setSelectedVenue(matchedVenue);
        setActiveCityId(matchedVenue.cityId);
        setPlaceName(`${matchedVenue.name} (${matchedVenue.address})`);
        setNotification(`📍 Знайдено в Google Maps: ${matchedVenue.name}!`);
      } else {
        setSelectedVenue(null);
        setPlaceName(`Точка з Google Maps (${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)})`);
        setNotification(`📍 Координати з Google Maps успішно застосовано!`);
      }

      setTimeout(() => setNotification(null), 3500);
    }
  };

  // Apply location to parent
  const handleConfirm = () => {
    const finalName = placeName.trim() || `${activeCity.name} (${selectedLat.toFixed(4)}, ${selectedLng.toFixed(4)})`;
    sounds.playClink();
    onApplyCoordinates(selectedLat, selectedLng, finalName);
  };

  const pinPos = coordsToSvg(selectedLat, selectedLng);
  const isPinInView = pinPos.x >= 0 && pinPos.x <= 600 && pinPos.y >= 0 && pinPos.y <= 420;

  return (
    <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-3 shadow-2xl">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs px-3 py-2 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{notification}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Мапа закладів з Google Maps</span>
              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] font-mono rounded">
                Verified Places
              </span>
            </h3>
            <p className="text-[10px] text-neutral-400">
              Точні координати барів, пабів та винних місць
            </p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            id="map-zoom-in-btn"
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.3, 3.0))}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Збільшити масштаб"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono px-1 text-neutral-400">
            {zoomLevel.toFixed(1)}x
          </span>
          <button
            type="button"
            id="map-zoom-out-btn"
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.3, 0.7))}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Зменшити масштаб"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* City Presets Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {CITY_PRESETS.map((city) => {
          const isActive = city.id === activeCityId;
          const venueCount = GOOGLE_MAPS_VENUES.filter(v => v.cityId === city.id).length;
          return (
            <button
              key={city.id}
              type="button"
              id={`map-city-preset-${city.id}`}
              onClick={() => handleSelectCity(city)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                isActive
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>{city.name}</span>
              <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-850 text-neutral-400'}`}>
                {venueCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Google Maps Search & URL Parser Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-500">
          <Search className="w-3.5 h-3.5" />
        </div>
        <input
          type="text"
          id="map-search-places-input"
          value={searchQuery}
          onChange={(e) => handleGoogleMapsInput(e.target.value)}
          placeholder="Пошук закладу або посилання / координати з Google Maps..."
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => {
            setSelectedCategory('all');
            sounds.playTap();
          }}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition ${
            selectedCategory === 'all'
              ? 'bg-neutral-100 text-neutral-950 font-bold'
              : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Всі заклади ({cityVenues.length})
        </button>
        {(['craft', 'cocktail', 'wine', 'pub', 'cider', 'cultural', 'shots'] as VenueCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = cityVenues.filter(v => v.category === cat).length;
          if (count === 0) return null;
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                sounds.playTap();
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition flex items-center gap-1 ${
                isActive
                  ? `${cfg.bg} ${cfg.text} border font-bold shadow-sm`
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span className="text-[9px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Map Visual Area */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden shadow-inner group">
        <svg
          ref={mapSvgRef}
          viewBox="0 0 600 420"
          className="w-full h-full cursor-crosshair select-none"
          onClick={handleMapClick}
        >
          {/* Background Grid Lines (GPS parallels & meridians) */}
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#262626" strokeWidth="0.8" strokeDasharray="2,2" />
            </pattern>
            <linearGradient id="river-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
            </linearGradient>
            <radialGradient id="pin-beacon-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="venue-selected-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grid background */}
          <rect width="600" height="420" fill="#0a0a0a" />
          <rect width="600" height="420" fill="url(#grid-pattern)" />

          {/* KYIV: River & Districts */}
          {activeCityId === 'kyiv' && (
            <g className="pointer-events-none">
              <path
                d="M 330 0 Q 300 80 340 140 T 360 260 Q 370 340 330 420"
                fill="none"
                stroke="url(#river-grad)"
                strokeWidth="48"
                strokeLinecap="round"
              />
              <ellipse cx="345" cy="180" rx="14" ry="40" fill="#171717" stroke="#0284c7" strokeWidth="1" strokeOpacity="0.3" />
              <ellipse cx="370" cy="270" rx="16" ry="32" fill="#171717" stroke="#0284c7" strokeWidth="1" strokeOpacity="0.3" />

              {/* Bridges */}
              <line x1="280" y1="120" x2="360" y2="135" stroke="#525252" strokeWidth="3" strokeDasharray="3,2" />
              <text x="365" y="132" fill="#737373" fontSize="8" fontFamily="monospace">Північний міст</text>
              <line x1="290" y1="210" x2="380" y2="215" stroke="#525252" strokeWidth="3" strokeDasharray="3,2" />
              <text x="385" y="218" fill="#737373" fontSize="8" fontFamily="monospace">Міст Метро</text>
              <line x1="270" y1="290" x2="380" y2="310" stroke="#525252" strokeWidth="3" strokeDasharray="3,2" />
              <text x="385" y="312" fill="#737373" fontSize="8" fontFamily="monospace">Міст Патона</text>

              {/* District indicators */}
              <circle cx="280" cy="130" r="50" fill="#f59e0b" fillOpacity="0.04" stroke="#f59e0b" strokeOpacity="0.2" strokeDasharray="4,3" />
              <text x="245" y="110" fill="#f59e0b" fontSize="11" fontWeight="bold" opacity="0.85">ПОДІЛ</text>
              <circle cx="260" cy="210" r="45" fill="#eab308" fillOpacity="0.03" stroke="#eab308" strokeOpacity="0.2" strokeDasharray="4,3" />
              <text x="200" y="200" fill="#fbbf24" fontSize="10" fontWeight="bold" opacity="0.8">ЗОЛОТІ ВОРОТА</text>
              <text x="280" y="195" fill="#38bdf8" fontSize="10" fontWeight="bold" opacity="0.8">ХРЕЩАТИК</text>
              <text x="320" y="280" fill="#737373" fontSize="10" fontWeight="bold">ПЕЧЕРСЬК</text>
            </g>
          )}

          {/* LVIV: Old Town & Castle Hill */}
          {activeCityId === 'lviv' && (
            <g className="pointer-events-none">
              <polygon points="260,180 340,180 340,240 260,240" fill="#f59e0b" fillOpacity="0.05" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" />
              <text x="270" y="215" fill="#f59e0b" fontSize="11" fontWeight="bold" opacity="0.9">ПЛОЩА РИНОК</text>
              <circle cx="430" cy="120" r="35" fill="#22c55e" fillOpacity="0.05" stroke="#22c55e" strokeWidth="1" strokeDasharray="3,3" />
              <text x="400" y="125" fill="#4ade80" fontSize="10" fontWeight="bold" opacity="0.8">ВИСОКИЙ ЗАМОК</text>
              <text x="250" y="160" fill="#a3a3a3" fontSize="9">вул. Вірменська</text>
            </g>
          )}

          {/* ODESA: Black Sea Coastline */}
          {activeCityId === 'odesa' && (
            <g className="pointer-events-none">
              <path
                d="M 450 0 Q 420 180 470 280 T 520 420 L 600 420 L 600 0 Z"
                fill="#0369a1"
                fillOpacity="0.25"
                stroke="#0284c7"
                strokeWidth="2"
              />
              <text x="510" y="200" fill="#38bdf8" fontSize="12" fontWeight="bold" opacity="0.8">ЧОРНЕ МОРЕ</text>
              <text x="350" y="140" fill="#f59e0b" fontSize="10" fontWeight="bold">Приморський бульвар</text>
              <line x1="280" y1="180" x2="360" y2="260" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,2" />
              <text x="270" y="230" fill="#fbbf24" fontSize="10" fontWeight="bold">Дерибасівська</text>
            </g>
          )}

          {/* DNIPRO: River & Islands */}
          {activeCityId === 'dnipro' && (
            <g className="pointer-events-none">
              <path
                d="M 200 0 Q 300 160 480 240 T 600 320"
                fill="none"
                stroke="url(#river-grad)"
                strokeWidth="55"
                strokeLinecap="round"
              />
              <ellipse cx="440" cy="220" rx="35" ry="15" fill="#171717" stroke="#0284c7" strokeWidth="1" />
              <text x="400" y="225" fill="#38bdf8" fontSize="9" fontWeight="bold">Монастирський острів</text>
              <text x="210" y="260" fill="#f59e0b" fontSize="10" fontWeight="bold">Центр • Набережна</text>
            </g>
          )}

          {/* KHARKIV: Freedom Square */}
          {activeCityId === 'kharkiv' && (
            <g className="pointer-events-none">
              <ellipse cx="300" cy="180" rx="60" ry="35" fill="#38bdf8" fillOpacity="0.04" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
              <text x="245" y="185" fill="#38bdf8" fontSize="10" fontWeight="bold">Майдан Свободи</text>
              <line x1="300" y1="180" x2="320" y2="350" stroke="#eab308" strokeWidth="2" strokeDasharray="4,2" />
              <text x="330" y="270" fill="#fbbf24" fontSize="10" fontWeight="bold">вул. Сумська</text>
            </g>
          )}

          {/* GOOGLE MAPS VENUES VECTOR PINS */}
          {filteredVenues.map((venue) => {
            const pos = coordsToSvg(venue.lat, venue.lng);
            if (pos.x < -20 || pos.x > 620 || pos.y < -20 || pos.y > 440) return null;

            const isSelected = selectedVenue?.id === venue.id;
            const catConfig = CATEGORY_CONFIG[venue.category];

            return (
              <g
                key={venue.id}
                id={`venue-pin-${venue.id}`}
                className="cursor-pointer transition-all duration-300 group"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectVenue(venue);
                }}
              >
                {/* Glow ring if selected */}
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r="22" fill="url(#venue-selected-glow)">
                    <animate attributeName="r" values="16;26;16" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Pin Head */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 11 : 9}
                  fill={catConfig.pinColor}
                  stroke="#0a0a0a"
                  strokeWidth="2"
                  className="transition-transform group-hover:scale-125"
                  filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.7))"
                />

                {/* Category Icon Emoji inside pin */}
                <text
                  x={pos.x}
                  y={pos.y + (isSelected ? 3.5 : 3)}
                  fontSize={isSelected ? 10 : 8.5}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {catConfig.icon}
                </text>

                {/* Venue Label & Google Rating Pill */}
                <g transform={`translate(${pos.x}, ${pos.y - (isSelected ? 16 : 14)})`}>
                  <rect
                    x="-45"
                    y="-14"
                    width="90"
                    height="14"
                    rx="4"
                    fill={isSelected ? '#171717' : '#0a0a0a'}
                    stroke={isSelected ? '#10b981' : '#333'}
                    strokeWidth="1"
                    opacity={isSelected ? 1 : 0.9}
                  />
                  <text
                    x="-40"
                    y="-4"
                    fill="#f59e0b"
                    fontSize="8"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    ★ {venue.rating}
                  </text>
                  <text
                    x="-18"
                    y="-4"
                    fill={isSelected ? '#ffffff' : '#d4d4d4'}
                    fontSize="7.5"
                    fontWeight={isSelected ? 'bold' : '600'}
                    fontFamily="sans-serif"
                  >
                    {venue.name.length > 12 ? `${venue.name.slice(0, 11)}…` : venue.name}
                  </text>
                </g>
              </g>
            );
          })}

          {/* ACTIVE USER PIN WITH RADAR BEACON */}
          {isPinInView && (
            <g className="transition-all duration-200 pointer-events-none">
              {/* Radar pulse ripples */}
              <circle cx={pinPos.x} cy={pinPos.y} r="28" fill="url(#pin-beacon-glow)">
                <animate attributeName="r" values="10;32;10" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.4s" repeatCount="indefinite" />
              </circle>

              <circle cx={pinPos.x} cy={pinPos.y} r="8" fill="#f59e0b" fillOpacity="0.4" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx={pinPos.x} cy={pinPos.y} r="4" fill="#fbbf24" stroke="#0a0a0a" strokeWidth="1" />

              {/* Pin Icon / Pointer */}
              <path
                d={`M ${pinPos.x} ${pinPos.y - 4} L ${pinPos.x - 7} ${pinPos.y - 24} A 8 8 0 1 1 ${pinPos.x + 7} ${pinPos.y - 24} Z`}
                fill="#f59e0b"
                stroke="#171717"
                strokeWidth="1.5"
                filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.6))"
              />
              <circle cx={pinPos.x} cy={pinPos.y - 24} r="3" fill="#171717" />
            </g>
          )}

          {/* Scale Legend (km) */}
          <g className="pointer-events-none">
            <line x1="20" y1="400" x2="80" y2="400" stroke="#737373" strokeWidth="2" />
            <line x1="20" y1="396" x2="20" y2="404" stroke="#737373" strokeWidth="2" />
            <line x1="80" y1="396" x2="80" y2="404" stroke="#737373" strokeWidth="2" />
            <text x="30" y="394" fill="#a3a3a3" fontSize="8" fontFamily="monospace">
              ~{(activeCity.zoomSpan.lngSpan * 111 / 10 / zoomLevel).toFixed(1)} км
            </text>
          </g>

          {/* Compass Rose */}
          <g className="pointer-events-none" transform="translate(565, 35)">
            <circle cx="0" cy="0" r="14" fill="#171717" stroke="#404040" strokeWidth="1" />
            <polygon points="0,-11 4,-2 0,0" fill="#ef4444" />
            <polygon points="0,11 4,2 0,0" fill="#737373" />
            <polygon points="0,-11 -4,-2 0,0" fill="#dc2626" />
            <polygon points="0,11 -4,2 0,0" fill="#525252" />
            <text x="-3" y="-13" fill="#ef4444" fontSize="8" fontWeight="bold" fontFamily="monospace">N</text>
          </g>
        </svg>

        {/* Floating Instructions */}
        <div className="absolute top-2.5 left-2.5 bg-neutral-900/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-neutral-800 text-[10px] text-amber-300 flex items-center gap-1.5 shadow-md pointer-events-none">
          <Crosshair className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Клікніть на заклад або в будь-яку точку</span>
        </div>

        {/* Reset to City Center button */}
        <button
          type="button"
          onClick={() => {
            setSelectedLat(activeCity.lat);
            setSelectedLng(activeCity.lng);
            setSelectedVenue(null);
            setPlaceName(`${activeCity.name} (Центр)`);
            sounds.playSwoosh();
          }}
          className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-lg bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-sm transition"
        >
          <Locate className="w-3 h-3 text-amber-400" />
          <span>Центр міста</span>
        </button>
      </div>

      {/* SELECTED GOOGLE MAPS VENUE DETAIL CARD */}
      {selectedVenue && (
        <div className="p-3 bg-neutral-950 rounded-2xl border border-amber-500/40 shadow-xl space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-1">
                  <span>{selectedVenue.name}</span>
                  <span className="text-[10px] text-emerald-400" title="Верифіковано в Google Maps">✓</span>
                </h4>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${CATEGORY_CONFIG[selectedVenue.category].bg} ${CATEGORY_CONFIG[selectedVenue.category].text}`}>
                  {CATEGORY_CONFIG[selectedVenue.category].icon} {selectedVenue.categoryLabel}
                </span>
                <span className="text-[9px] font-mono text-neutral-400 bg-neutral-900 px-1 py-0.2 rounded">
                  {selectedVenue.priceTier}
                </span>
              </div>
              <p className="text-[10px] text-neutral-300 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                <span>{selectedVenue.address} ({selectedVenue.district})</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedVenue(null)}
              className="text-neutral-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rating, Reviews and Hours from Google Maps */}
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <div className="flex items-center gap-1 bg-amber-950/60 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{selectedVenue.rating.toFixed(1)}</span>
              <span className="text-[9px] text-amber-400/70">({selectedVenue.reviewCount.toLocaleString()} відгуків Google Maps)</span>
            </div>
            <div className="flex items-center gap-1 text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
              <Clock className="w-3 h-3 text-neutral-400" />
              <span>{selectedVenue.openingHours}</span>
            </div>
            <a
              href={selectedVenue.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-950/40 border border-sky-800/50 px-2 py-0.5 rounded-md transition ml-auto"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              <span>Google Maps ↗</span>
            </a>
          </div>

          <p className="text-[11px] text-neutral-300 bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/80">
            {selectedVenue.description}
          </p>

          {/* Popular Drinks */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="text-[10px] text-neutral-400">Популярне:</span>
            {selectedVenue.popularDrinks.map((drink) => (
              <span
                key={drink}
                className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-200"
              >
                {drink}
              </span>
            ))}
          </div>

          {/* Action to set location to this venue */}
          <button
            type="button"
            id={`select-venue-as-location-btn-${selectedVenue.id}`}
            onClick={() => {
              setSelectedLat(selectedVenue.lat);
              setSelectedLng(selectedVenue.lng);
              setPlaceName(`${selectedVenue.name} (${selectedVenue.address})`);
              sounds.playClink();
              setNotification(`📍 Вибрано заклад: ${selectedVenue.name}!`);
              setTimeout(() => setNotification(null), 3000);
            }}
            className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Встановити мої координати в цьому закладі</span>
          </button>
        </div>
      )}

      {/* Horizontal Carousel of Nearby Venues in City */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
          <span className="flex items-center gap-1">
            <Beer className="w-3 h-3 text-amber-400" />
            <span>Заклади в місті {activeCity.name} ({filteredVenues.length})</span>
          </span>
          <span className="text-[10px] text-neutral-400 font-normal">
            Торкніться для переходу
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {filteredVenues.map((venue) => {
            const isSelected = selectedVenue?.id === venue.id;
            const dist = calculateDistanceKm(selectedLat, selectedLng, venue.lat, venue.lng);
            const catConfig = CATEGORY_CONFIG[venue.category];

            return (
              <button
                key={venue.id}
                type="button"
                id={`carousel-venue-${venue.id}`}
                onClick={() => handleSelectVenue(venue)}
                className={`min-w-[170px] max-w-[200px] p-2 rounded-xl text-left border transition shrink-0 ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold truncate">{venue.name}</span>
                  <span className="text-[10px] shrink-0 font-bold text-amber-400">★ {venue.rating}</span>
                </div>
                <div className="text-[9px] text-neutral-400 truncate mb-1">
                  {catConfig.icon} {venue.categoryLabel} • {venue.district}
                </div>
                <div className="flex items-center justify-between text-[9px] text-neutral-400 font-mono">
                  <span>{formatDistance(dist)}</span>
                  <span className="text-sky-400 hover:underline">Мапа</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Selected Coordinates Bar & Place Name */}
      <div className="space-y-2 bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-bold text-neutral-200">Вибрана точка:</span>
          </div>
          <div className="font-mono text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/30">
            {selectedLat.toFixed(4)}° N, {selectedLng.toFixed(4)}° E
          </div>
        </div>

        {/* Custom Place Name Input */}
        <div className="space-y-1">
          <label className="block text-[10px] text-neutral-400">
            Назва / адреса локації для компанії:
          </label>
          <input
            type="text"
            id="map-selected-place-name-input"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="напр. Squat 17b або Поділ, Контрактова площа"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Proximity hint if not on exact venue */}
        {nearestVenue && !selectedVenue && (
          <div className="text-[10px] text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              Поруч: <strong className="text-neutral-200">{nearestVenue.venue.name}</strong> ({nearestVenue.venue.address}) —{' '}
              <span className="text-amber-300 font-mono">{formatDistance(nearestVenue.distanceKm)}</span>
            </span>
          </div>
        )}

        {/* Fine-tune toggle button */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setIsFineTuneOpen(!isFineTuneOpen)}
            className="text-[10px] text-neutral-400 hover:text-neutral-200 underline decoration-dotted"
          >
            {isFineTuneOpen ? 'Сховати ручне точне коригування' : 'Точне коригування цифр GPS (±0.0001°)...'}
          </button>

          {isFineTuneOpen && (
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-900 animate-in fade-in">
              <div>
                <label className="block text-[10px] text-neutral-500 font-mono">Широта (Lat):</label>
                <input
                  type="number"
                  step="0.0001"
                  value={selectedLat}
                  onChange={(e) => setSelectedLat(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-neutral-500 font-mono">Довгота (Lng):</label>
                <input
                  type="number"
                  step="0.0001"
                  value={selectedLng}
                  onChange={(e) => setSelectedLng(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
          >
            Скасувати
          </button>
        )}
        <button
          type="button"
          id="confirm-map-coords-btn"
          onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg active:scale-98"
        >
          <Check className="w-4 h-4" />
          <span>Встановити цю точку на мапі</span>
        </button>
      </div>
    </div>
  );
};
