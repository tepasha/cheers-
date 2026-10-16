import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { holdDemand, type Demand } from '../services/demand';

/** Holds the demand (services/demand.ts) while the screen is focused */
export function useFocusDemand(demand: Demand): void {
  useFocusEffect(useCallback(() => holdDemand(demand), [demand]));
}
