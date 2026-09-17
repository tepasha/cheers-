import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Plus, 
  Edit3, 
  Trash2, 
  MapPin, 
  ExternalLink, 
  Check, 
  X, 
  Sparkles, 
  LocateFixed,
  Compass
} from 'lucide-react';
import { FavoriteVenueItem } from '../../types';
import { GOOGLE_MAPS_VENUES } from '../../data/venuesData';
import { UserGeoLocation } from '../../services/geoService';
import { sounds } from '../../services/soundService';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { authService } from '../../services/authService';

interface FavoriteVenuesSectionProps {
  userLocation: UserGeoLocation;
  onVenueListChange?: (venues: FavoriteVenueItem[]) => void;
}

const STORAGE_KEY = 'user_favorite_venues_list_v2';

const DEFAULT_FAVORITE_VENUES: FavoriteVenueItem[] = [
  {
    id: 'fav-1',
    name: 'Squat 17b Yard Cafe',
    area: 'Шевченківський, вул. Терещенківська, 17б',
    category: 'Арт-простір & Бар',
    lat: 50.4418,
    lng: 30.5152,
    comment: 'Затишний дворик, вечори живої музики та сухий сидр',
    createdAt: '2026-09-01',
  },
  {
    id: 'fav-2',
    name: 'Varvar Bar Podil',
    area: 'Поділ, вул. Хорива, 25',
    category: 'Крафтове пиво',
    lat: 50.4674,
    lng: 30.5146,
    comment: 'Найкращий свіжий DIPA та крафтові бургери',
    createdAt: '2026-09-03',
  },
  {
    id: 'fav-3',
    name: 'Win Bar',
    area: 'Поділ, вул. Григорія Сковороди, 4',
    category: 'Винний бар',
    lat: 50.4665,
    lng: 30.5192,
    comment: 'Камерна винна атмосфера та розмови про життя',
    createdAt: '2026-09-05',
  },
];

const CATEGORY_OPTIONS = [
  'Крафтове пиво',
  'Коктейль-бар',
  'Винний бар',
  'Паб / Лагер',
  'Сидерія',
  'Арт-простір & Бар',
  'Шоти / Настоянки',
  'Кав’ярня / Лаунж',
];

export const FavoriteVenuesSection: React.FC<FavoriteVenuesSectionProps> = ({
  userLocation,
  onVenueListChange,
}) => {
  const [venues, setVenues] = useState<FavoriteVenueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_FAVORITE_VENUES;
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORY_OPTIONS[0]);
  const [formLat, setFormLat] = useState<string>('50.4501');
  const [formLng, setFormLng] = useState<string>('30.5234');
  const [formComment, setFormComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(venues));
    } catch {
      // storage unavailable
    }
    onVenueListChange?.(venues);
  }, [venues, onVenueListChange]);

  const openAddForm = () => {
    sounds.playTap();
    setEditingId(null);
    setFormName('');
    setFormArea(userLocation.locationName || 'Київ');
    setFormCategory(CATEGORY_OPTIONS[0]);
    setFormLat(userLocation.lat.toFixed(4));
    setFormLng(userLocation.lng.toFixed(4));
    setFormComment('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: FavoriteVenueItem) => {
    sounds.playTap();
    setEditingId(item.id);
    setFormName(item.name);
    setFormArea(item.area);
    setFormCategory(item.category);
    setFormLat(item.lat.toString());
    setFormLng(item.lng.toString());
    setFormComment(item.comment || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleApplyPresetVenue = (presetName: string) => {
    const found = GOOGLE_MAPS_VENUES.find((v) => v.name === presetName);
    if (found) {
      sounds.playTap();
      setFormName(found.name);
      setFormArea(`${found.cityName}, ${found.district} (${found.address})`);
      setFormCategory(found.categoryLabel || CATEGORY_OPTIONS[0]);
      setFormLat(found.lat.toFixed(4));
      setFormLng(found.lng.toFixed(4));
      setFormComment(`Рейтинг Google: ⭐${found.rating} (${found.reviewCount} відгуків)`);
    }
  };

  const handleUseCurrentCoordinates = () => {
    sounds.playSwoosh();
    setFormLat(userLocation.lat.toFixed(4));
    setFormLng(userLocation.lng.toFixed(4));
    if (!formArea) {
      setFormArea(userLocation.locationName);
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Введіть назву закладу');
      return;
    }

    const latNum = parseFloat(formLat);
    const lngNum = parseFloat(formLng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setFormError('Введіть коректні числові координати (широту та довготу)');
      return;
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setFormError('Координати поза межами допустимого діапазону');
      return;
    }

    sounds.playClink();

    if (editingId) {
      const updatedItem: FavoriteVenueItem = {
        id: editingId,
        name: formName.trim(),
        area: formArea.trim() || 'Київ',
        category: formCategory,
        lat: latNum,
        lng: lngNum,
        comment: formComment.trim(),
      };
      setVenues((prev) =>
        prev.map((item) => (item.id === editingId ? updatedItem : item))
      );
      const user = authService.getStoredUser();
      if (user?.id) {
        firestoreSyncService.saveFavoriteVenue(user.id, updatedItem);
      }
    } else {
      const newItem: FavoriteVenueItem = {
        id: `fav-${Date.now()}`,
        name: formName.trim(),
        area: formArea.trim() || 'Київ',
        category: formCategory,
        lat: latNum,
        lng: lngNum,
        comment: formComment.trim(),
        createdAt: new Date().toISOString().split('T')[0],
      };
      setVenues((prev) => [newItem, ...prev]);
      const user = authService.getStoredUser();
      if (user?.id) {
        firestoreSyncService.saveFavoriteVenue(user.id, newItem);
      }
    }

    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    sounds.playTap();
    setVenues((prev) => prev.filter((v) => v.id !== id));
    const user = authService.getStoredUser();
    if (user?.id) {
      firestoreSyncService.removeFavoriteVenue(user.id, id);
    }
    if (editingId === id) {
      setIsFormOpen(false);
      setEditingId(null);
    }
  };

  return (
    <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 space-y-3.5 shadow-xl relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 fill-amber-400/30" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
              <span>Улюблені заклади</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                {venues.length}
              </span>
            </h4>
            <p className="text-[10px] text-neutral-400">
              Список із точними координатами та нотатками
            </p>
          </div>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            id="add-favorite-venue-btn"
            onClick={openAddForm}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Додати</span>
          </button>
        )}
      </div>

      {/* Add / Edit Form Modal/Drawer in-place */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveForm}
          className="bg-neutral-950 rounded-2xl border border-amber-500/30 p-3.5 space-y-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              {editingId ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingId ? 'Редагувати заклад' : 'Новий улюблений заклад'}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Preset Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Швидкий вибір із закладів Києва:</span>
            </label>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleApplyPresetVenue(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
            >
              <option value="" disabled>
                Оберіть заклад для автозаповнення...
              </option>
              {GOOGLE_MAPS_VENUES.slice(0, 15).map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name} ({v.district})
                </option>
              ))}
            </select>
          </div>

          {/* Venue Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">
                Назва закладу *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="напр. Punkcraft, Loggerhead"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">
                Категорія
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Area / Address */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">
              Район / Адреса
            </label>
            <input
              type="text"
              value={formArea}
              onChange={(e) => setFormArea(e.target.value)}
              placeholder="напр. Поділ, вул. Ігорівська, 14"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Coordinates inputs with quick GPS button */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-400" />
                <span>Географічні координати (Широта, Довгота) *</span>
              </label>
              <button
                type="button"
                onClick={handleUseCurrentCoordinates}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                title="Підставити поточну геолокацію профілю"
              >
                <LocateFixed className="w-3 h-3" />
                <span>Моя геопозиція</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  required
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  placeholder="Широта (Lat) напр. 50.4501"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-amber-300 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  placeholder="Довгота (Lng) напр. 30.5234"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-amber-300 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Comment / Note */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">
              Нотатка / Що замовляти
            </label>
            <input
              type="text"
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="напр. Чудовий IPA на крані, спокійна тераса"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {formError && (
            <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/40 rounded-lg p-2">
              {formError}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingId ? 'Оновити заклад' : 'Додати до списку'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition"
            >
              Скасувати
            </button>
          </div>
        </form>
      )}

      {/* Venues List */}
      <div className="space-y-2">
        {venues.map((venue) => {
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
          return (
            <div
              key={venue.id}
              className="bg-neutral-950 rounded-2xl border border-neutral-800/90 hover:border-neutral-700 p-3 transition space-y-2 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="text-xs font-bold text-white leading-tight">
                      {venue.name}
                    </h5>
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-semibold">
                      {venue.category}
                    </span>
                  </div>

                  <p className="text-[10px] text-neutral-400 truncate">
                    {venue.area}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditForm(venue)}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 transition"
                    title="Редагувати заклад"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(venue.id)}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-400 transition"
                    title="Видалити зі списку"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Coordinates & Google Maps Link */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[10px]">
                <div className="flex items-center gap-1 font-mono text-neutral-400">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    {venue.lat.toFixed(4)}°N, {venue.lng.toFixed(4)}°E
                  </span>
                </div>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition"
                  title="Відкрити точку в Google Maps"
                >
                  <span>На мапі</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {venue.comment && (
                <div className="text-[10px] text-neutral-300 bg-neutral-900/60 rounded-lg px-2 py-1 italic border border-neutral-850">
                  💬 «{venue.comment}»
                </div>
              )}
            </div>
          );
        })}

        {venues.length === 0 && (
          <div className="text-center py-6 border border-dashed border-neutral-800 rounded-2xl p-4 space-y-2">
            <Heart className="w-6 h-6 text-neutral-600 mx-auto" />
            <p className="text-xs text-neutral-400">
              Список улюблених закладів порожній
            </p>
            <button
              type="button"
              onClick={openAddForm}
              className="text-xs text-amber-400 font-bold hover:underline"
            >
              + Додати перший заклад з координатами
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
