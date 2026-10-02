/**
 * Tactile feedback. The web build synthesised sounds with the Web Audio API, which does
 * not exist in React Native; haptics give the same "something happened" cue natively.
 * Every call is fire-and-forget and swallows errors (e.g. simulators without a taptic engine).
 */
import * as Haptics from 'expo-haptics';

type Feedback = () => Promise<void>;

const run = (fn: Feedback) => () => {
  fn().catch(() => {});
};

const impact = (style: Haptics.ImpactFeedbackStyle) => () => Haptics.impactAsync(style);
const notification = (type: Haptics.NotificationFeedbackType) => () => Haptics.notificationAsync(type);

export const sounds = {
  playClink: run(impact(Haptics.ImpactFeedbackStyle.Medium)),
  playTap: run(impact(Haptics.ImpactFeedbackStyle.Light)),
  playSwoosh: run(impact(Haptics.ImpactFeedbackStyle.Light)),
  playPop: run(impact(Haptics.ImpactFeedbackStyle.Soft)),
  playMessageSent: run(impact(Haptics.ImpactFeedbackStyle.Rigid)),
  playMatchCheer: run(notification(Haptics.NotificationFeedbackType.Success)),
  playSuccess: run(notification(Haptics.NotificationFeedbackType.Success)),
  playLevelUp: run(notification(Haptics.NotificationFeedbackType.Success)),
  playPushNotification: run(notification(Haptics.NotificationFeedbackType.Warning)),
  playAlert: run(notification(Haptics.NotificationFeedbackType.Error)),
};
