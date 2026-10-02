import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AppLanguage, GroupMeetup } from '../types';
import { generateIcsContent } from '../logic/meetups';

/** Writes the meetup as an .ics file and opens the OS share sheet so the user can add it to a calendar */
export async function addMeetupToCalendar(meetup: GroupMeetup, lang: AppLanguage = 'uk'): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  const safeName = meetup.title.replace(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ0-9]/g, '_').slice(0, 40) || 'meetup';
  const file = new File(Paths.cache, `${safeName}.ics`);
  file.create({ overwrite: true });
  file.write(generateIcsContent(meetup, new Date(), lang));

  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: meetup.title });
  return true;
}
