import type { ExpoMessage, ExpoTicket } from './push';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends one batch (up to 100) to the Expo Push service and returns one ticket per message, in order.
 * `accessToken` is optional: set it when "enhanced push security" is enabled for the Expo project.
 */
export async function sendToExpo(
  messages: ExpoMessage[],
  options: { url?: string; accessToken?: string; fetchImpl?: typeof fetch } = {}
): Promise<ExpoTicket[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch(options.url ?? EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { data?: ExpoTicket[]; errors?: unknown };
  if (!Array.isArray(payload.data) || payload.data.length !== messages.length) {
    // Without one ticket per message we cannot tell which device failed, so treat the whole batch as failed
    throw new Error('Expo push response did not contain one ticket per message');
  }
  return payload.data;
}
