import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { UserGeoLocation, formatDistance } from '../../services/geoService';
import { BuddyProfile } from '../../types';
import { VenuePlace, CATEGORY_CONFIG } from '../../data/venuesData';
import { sounds } from '../../services/soundService';

interface BuddyWithGeo extends BuddyProfile {
  distanceKm: number;
}

interface LeafletMapViewProps {
  userLocation: UserGeoLocation;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  filteredBuddies: BuddyWithGeo[];
  filteredVenues: VenuePlace[];
  buddiesWithGeo: BuddyWithGeo[];
  selectedBuddy: BuddyProfile | null;
  selectedVenue: VenuePlace | null;
  radiusKm: number | 'all';
  filterLayer: 'all' | 'buddies' | 'venues';
  onSelectBuddy: (b: BuddyProfile) => void;
  onSelectVenue: (v: VenuePlace) => void;
  onMapClick: (lat: number, lng: number) => void;
  onTriggerNotification: (msg: string) => void;
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  userLocation,
  mapCenter,
  mapZoom,
  filteredBuddies,
  filteredVenues,
  buddiesWithGeo,
  selectedBuddy,
  selectedVenue,
  radiusKm,
  filterLayer,
  onSelectBuddy,
  onSelectVenue,
  onMapClick,
  onTriggerNotification,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = Number.isFinite(mapCenter.lat) ? mapCenter.lat : 50.4501;
    const initialLng = Number.isFinite(mapCenter.lng) ? mapCenter.lng : 30.5234;
    const initialZoom = Number.isFinite(mapZoom) ? mapZoom : 14;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
    });

    // Dark Matter tile layer with automatic fallback to standard OSM tiles if CDN fails
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    });

    tileLayer.on('tileerror', () => {
      // Fallback in case CartoCDN encounters network policy restrictions
      tileLayer.setUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    });

    tileLayer.addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapRef.current = map;

    // Handle map click
    map.on('click', (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    // Force multiple size invalidations to ensure full layout inside flex/mobile containers
    const timers = [50, 150, 350, 700, 1200].map((ms) =>
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, ms)
    );

    return () => {
      timers.forEach(clearTimeout);
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Update Center and Zoom smoothly when props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    const latDiff = Math.abs(currentCenter.lat - mapCenter.lat);
    const lngDiff = Math.abs(currentCenter.lng - mapCenter.lng);
    const zoomDiff = Math.abs(currentZoom - mapZoom);

    if (latDiff > 0.0001 || lngDiff > 0.0001 || zoomDiff > 0.1) {
      map.flyTo([mapCenter.lat, mapCenter.lng], mapZoom, {
        duration: 0.8,
        easeLinearity: 0.25,
      });
    }
  }, [mapCenter.lat, mapCenter.lng, mapZoom]);

  // Handle ResizeObserver for dynamic container adjustments
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Render Markers & Coverage Circle
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // 1. Coverage Radius Circle
    if (radiusKm !== 'all' && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
      const radiusCircle = L.circle([userLocation.lat, userLocation.lng], {
        radius: radiusKm * 1000,
        color: '#10b981',
        weight: 1.5,
        opacity: 0.6,
        fillColor: '#10b981',
        fillOpacity: 0.06,
      });
      layer.addLayer(radiusCircle);
    }

    // 2. User Location Radar Marker
    if (Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
      const userHtml = `
        <div class="relative flex flex-col items-center select-none cursor-pointer -translate-x-1/2 -translate-y-1/2">
          <span class="absolute -inset-3 rounded-full bg-emerald-500/35 animate-ping pointer-events-none"></span>
          <div class="relative w-9 h-9 rounded-full border-2 border-emerald-400 bg-neutral-900 shadow-2xl overflow-hidden flex items-center justify-center ring-2 ring-emerald-500/50">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"
              alt="Ви"
              class="w-full h-full object-cover"
            />
          </div>
          <div class="mt-1 bg-emerald-950/95 border border-emerald-500/70 px-2 py-0.5 rounded-full text-[9px] font-extrabold text-emerald-300 whitespace-nowrap shadow-lg flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Ви тут</span>
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: '',
        html: userHtml,
        iconSize: [40, 50],
        iconAnchor: [20, 25],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        title: `Ви тут (${userLocation.locationName})`,
        zIndexOffset: 1000,
      });

      userMarker.on('click', () => {
        sounds.playTap();
        onTriggerNotification(`📍 Ваша позиція: ${userLocation.locationName} (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`);
      });

      layer.addLayer(userMarker);
    }

    // 3. Buddy Markers Nearby
    if (filterLayer === 'all' || filterLayer === 'buddies') {
      filteredBuddies.forEach((b) => {
        if (!b.coordinates || !Number.isFinite(b.coordinates.lat) || !Number.isFinite(b.coordinates.lng)) return;

        const isSelected = selectedBuddy?.id === b.id;
        const hasCheckIn = !!b.activeCheckIn;

        const buddyHtml = `
          <div class="relative flex flex-col items-center select-none cursor-pointer transition-transform hover:scale-110 -translate-x-1/2 -translate-y-1/2">
            ${hasCheckIn ? '<span class="absolute -inset-2.5 rounded-full bg-rose-500/40 animate-ping pointer-events-none"></span>' : ''}
            ${isSelected ? '<span class="absolute -inset-1.5 rounded-full border-2 border-amber-400 ring-2 ring-amber-400/40 pointer-events-none animate-pulse"></span>' : ''}
            <div class="relative w-8 h-8 rounded-full border-2 overflow-hidden shadow-lg ${
              isSelected
                ? 'border-amber-400 ring-2 ring-amber-400/70 scale-105'
                : hasCheckIn
                ? 'border-rose-500 ring-1 ring-rose-500/40'
                : b.online
                ? 'border-emerald-500'
                : 'border-neutral-500'
            }">
              <img src="${b.avatar}" alt="${b.name}" class="w-full h-full object-cover" />
            </div>
            <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-[9px]">
              ${hasCheckIn ? '🍻' : b.online ? '🟢' : '⚪'}
            </div>
            <div class="mt-1 bg-neutral-950/95 border border-neutral-750 px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-neutral-200 whitespace-nowrap shadow-md flex items-center gap-1">
              <span>${b.name}</span>
              <span class="text-neutral-400 font-normal">• ${formatDistance(b.distanceKm)}</span>
            </div>
          </div>
        `;

        const buddyIcon = L.divIcon({
          className: '',
          html: buddyHtml,
          iconSize: [60, 55],
          iconAnchor: [30, 27],
        });

        const buddyMarker = L.marker([b.coordinates.lat, b.coordinates.lng], {
          icon: buddyIcon,
          title: `${b.name} (${formatDistance(b.distanceKm)})`,
          zIndexOffset: isSelected ? 900 : 500,
        });

        buddyMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          sounds.playClink();
          onSelectBuddy(b);
        });

        layer.addLayer(buddyMarker);
      });
    }

    // 4. Venue Markers
    if (filterLayer === 'all' || filterLayer === 'venues') {
      filteredVenues.forEach((v) => {
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return;

        const isSelected = selectedVenue?.id === v.id;
        const cfg = CATEGORY_CONFIG[v.category];
        const buddiesHere = buddiesWithGeo.filter(
          (b) =>
            b.activeCheckIn &&
            b.activeCheckIn.barName.toLowerCase().includes(v.name.toLowerCase().split(' ')[0])
        );

        const venueHtml = `
          <div class="relative flex flex-col items-center select-none cursor-pointer transition-transform hover:scale-110 -translate-x-1/2 -translate-y-1/2">
            ${isSelected ? '<span class="absolute -inset-1.5 rounded-xl border-2 border-amber-400 pointer-events-none animate-pulse"></span>' : ''}
            <div
              class="w-7 h-7 rounded-xl flex items-center justify-center text-sm shadow-xl border border-neutral-950 text-white ${
                isSelected ? 'ring-2 ring-amber-400 scale-110' : ''
              }"
              style="background-color: ${cfg?.pinColor || '#f59e0b'}"
            >
              ${cfg?.icon || '🍺'}
            </div>
            ${
              buddiesHere.length > 0
                ? `<div class="absolute -top-1.5 -right-1.5 px-1 rounded-full bg-rose-500 border border-neutral-900 text-[8px] font-bold text-white shadow">${buddiesHere.length}👥</div>`
                : ''
            }
            <div
              class="mt-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold whitespace-nowrap shadow-md flex items-center gap-1 border ${
                isSelected
                  ? 'bg-amber-950/95 border-amber-500 text-amber-200'
                  : 'bg-neutral-950/95 border-neutral-800 text-neutral-200'
              }"
            >
              <span class="text-amber-400 font-black">★${v.rating}</span>
              <span>${v.name.slice(0, 14)}</span>
            </div>
          </div>
        `;

        const venueIcon = L.divIcon({
          className: '',
          html: venueHtml,
          iconSize: [70, 55],
          iconAnchor: [35, 27],
        });

        const venueMarker = L.marker([v.lat, v.lng], {
          icon: venueIcon,
          title: `${v.name} (★${v.rating})`,
          zIndexOffset: isSelected ? 800 : 400,
        });

        venueMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          sounds.playTap();
          onSelectVenue(v);
        });

        layer.addLayer(venueMarker);
      });
    }
  }, [
    filteredBuddies,
    filteredVenues,
    buddiesWithGeo,
    selectedBuddy?.id,
    selectedVenue?.id,
    userLocation.lat,
    userLocation.lng,
    radiusKm,
    filterLayer,
  ]);

  return (
    <div
      ref={containerRef}
      id="leaflet-map-canvas"
      className="w-full h-full min-h-[380px] absolute inset-0 z-0 bg-neutral-950"
      style={{ width: '100%', height: '100%', minHeight: '380px' }}
    />
  );
};
