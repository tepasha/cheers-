import { describe, expect, it } from 'vitest';
import { distanceBetween } from 'geofire-common';
import { cellCenter, feedCell, feedCellOf, feedCells, nextFeedCell } from '@/logic/feedArea';
import { feedCellOf as serverFeedCellOf } from '../../../functions/src/feedArea';
import { buildMeetup } from '@/logic/meetups';

const KYIV = { lat: 50.45, lng: 30.52 };
const LVIV = { lat: 49.84, lng: 24.03 };
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => distanceBetween([a.lat, a.lng], [b.lat, b.lng]);

describe('feed area cells', () => {
  it('a cell is 4 geohash characters, the same on the client and the server', () => {
    expect(feedCell(KYIV.lat, KYIV.lng)).toHaveLength(4);
    for (let i = 0; i < 200; i++) {
      const lat = 44 + ((i * 7.31) % 9);
      const lng = 22 + ((i * 13.7) % 18);
      expect(serverFeedCellOf(lat, lng)).toBe(feedCellOf(lat, lng));
    }
    expect(feedCellOf(undefined, 30)).toBeUndefined();
    expect(feedCellOf(Number.NaN, 30)).toBeUndefined();
    expect(serverFeedCellOf('50', 30)).toBeUndefined();
  });

  it('the area is the cell and its 8 neighbours: everything within ~20 km, nothing from another city', () => {
    const cells = feedCells(feedCell(KYIV.lat, KYIV.lng));
    expect(new Set(cells).size).toBe(9);
    expect(cells).toContain(feedCell(KYIV.lat, KYIV.lng));
    expect(cells).not.toContain(feedCell(LVIV.lat, LVIV.lng));
    // points 18 km away in every direction are inside the area
    for (const [dLat, dLng] of [[0.162, 0], [-0.162, 0], [0, 0.254], [0, -0.254], [0.12, 0.18], [-0.12, -0.18]]) {
      const p = { lat: KYIV.lat + dLat, lng: KYIV.lng + dLng };
      expect(km(KYIV, p)).toBeLessThan(20);
      expect(cells).toContain(feedCell(p.lat, p.lng));
    }
  });

  it('decodes a cell back to its centre', () => {
    const cell = feedCell(KYIV.lat, KYIV.lng);
    const c = cellCenter(cell);
    expect(feedCell(c.lat, c.lng)).toBe(cell);
    expect(km(c, KYIV)).toBeLessThan(20);
  });

  it('keeps listening around the old cell until the person is half a cell past its edge', () => {
    const start = feedCell(KYIV.lat, KYIV.lng);
    const c = cellCenter(start);
    const cellLat = 180 / 1024;
    const justOver = { lat: c.lat + cellLat * 0.6, lng: c.lng }; // in the next cell, 0.1 cell past the edge
    expect(feedCell(justOver.lat, justOver.lng)).not.toBe(start);
    expect(nextFeedCell(start, justOver)).toBe(start);
    const wellOver = { lat: c.lat + cellLat * 1.05, lng: c.lng };
    expect(nextFeedCell(start, wellOver)).toBe(feedCell(wellOver.lat, wellOver.lng));
    expect(nextFeedCell(null, KYIV)).toBe(start);
    expect(nextFeedCell(start, LVIV)).toBe(feedCell(LVIV.lat, LVIV.lng));
  });
});

describe('a meetup is placed in an area', () => {
  const input = {
    title: 'Квіз', description: '', venueName: 'Bar', venueAddress: '', scheduledDate: '', scheduledTime: '', maxParticipants: 6,
    creatorId: 'alice', creatorName: 'Alice', creatorAvatar: '',
  };

  it('by the venue when it has coordinates, else by where the creator is, else nowhere', () => {
    expect(buildMeetup({ ...input, lat: LVIV.lat, lng: LVIV.lng, area: KYIV }).geo).toBe(feedCell(LVIV.lat, LVIV.lng));
    const placed = buildMeetup({ ...input, area: KYIV });
    expect(placed.geo).toBe(feedCell(KYIV.lat, KYIV.lng));
    expect(placed).not.toHaveProperty('area'); // only the ~20 km cell is kept, not the position
    expect(buildMeetup(input).geo).toBeUndefined();
  });
});
