import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { INITIAL_USER_LOCATION, UserGeoLocation } from '../../services/geoService';

interface LocationState {
  current: UserGeoLocation;
}

const locationSlice = createSlice({
  name: 'location',
  initialState: { current: INITIAL_USER_LOCATION } as LocationState,
  reducers: {
    locationUpdated(state, action: PayloadAction<UserGeoLocation>) {
      state.current = action.payload;
    },
  },
});

export const { locationUpdated } = locationSlice.actions;
export default locationSlice.reducer;
