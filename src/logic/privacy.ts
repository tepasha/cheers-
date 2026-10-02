/**
 * Public coordinates are rounded to a 0.0002° grid (about 22 m north-south, 14 m east-west at Kyiv's latitude).
 * That is the decided precision of "people nearby". It is precise enough to tell which building someone is in, so
 * it is also what the privacy policy and the store data declarations must say (docs/store/).
 */
export const PUBLIC_COORD_PRECISION = 5000;

export const coarseCoordinate = (n: number): number => Math.round(n * PUBLIC_COORD_PRECISION) / PUBLIC_COORD_PRECISION;
