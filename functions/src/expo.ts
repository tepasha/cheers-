import type { ExpoMessage, ExpoTicket } from './push';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends one batch (up to 100) to the Expo Push service and returns one ticket per message, in order.
 * `accessToken` is optional: set it when "enhanced push security" is enabled for the Expo project.
 */
export async function sendToExpo(
  messages: ExpoMessage[],
  options: { url?: string; accessToken?: string; fetchImpl?: typeof fetch; wait?: (ms: number) => Promise<void> } = {}
): Promise<ExpoTicket[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await doFetch(options.url ?? EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(10000),
      });
      if (response.ok || (response.status !== 429 && response.status < 500) || attempt === 2) break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await wait(250 * 2 ** attempt);
  }

  if (!response?.ok) {
    throw new Error(`Expo push request failed with HTTP ${response?.status ?? 'unavailable'}`);
  }

  const payload = (await response.json()) as { data?: ExpoTicket[]; errors?: unknown };
  if (!Array.isArray(payload.data) || payload.data.length !== messages.length) {
    // Without one ticket per message we cannot tell which device failed, so treat the whole batch as failed
    throw new Error('Expo push response did not contain one ticket per message');
  }
  return payload.data;
}
