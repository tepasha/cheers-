import { createAction } from '@reduxjs/toolkit';

/**
 * Wipes everything that belongs to the previous account (chats, friends, favorites, blocks…).
 * Dispatched when a *different* person signs in on this device; signing back in as the same
 * person (e.g. after the 36h session expired) keeps their local data.
 */
export const personalDataReset = createAction('app/personalDataReset');
