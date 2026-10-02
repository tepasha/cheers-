import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';
import { FavoriteVenueItem } from '../../types';

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: { items: [] as FavoriteVenueItem[] },
  reducers: {
    favoriteSaved(state, action: PayloadAction<FavoriteVenueItem>) {
      const idx = state.items.findIndex((v) => v.id === action.payload.id);
      if (idx === -1) state.items.unshift(action.payload);
      else state.items[idx] = action.payload;
    },
    favoriteRemoved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((v) => v.id !== action.payload);
    },
    favoritesReplaced(state, action: PayloadAction<FavoriteVenueItem[]>) {
      state.items = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => ({ items: [] as FavoriteVenueItem[] }));
  },
});

export const { favoriteSaved, favoriteRemoved, favoritesReplaced } = favoritesSlice.actions;
export default favoritesSlice.reducer;
