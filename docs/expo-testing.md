# Тестові версії через Expo

Кожен push у `main` запускає [Preview (main)](https://github.com/tepasha/cheers-/actions/workflows/preview.yml): перевірки коду, staging-бекенд, Android APK на EAS Build, потім оновлення EAS Update у канал `preview`. Прапорець `PREVIEW_BUILDS` більше не потрібний. Конвеєр виконується послідовно, щоб старий коміт не перекрив нове оновлення.

## Одноразове підключення

1. GitHub → Settings → Secrets and variables → Actions: додайте секрет `EXPO_TOKEN` з Expo access token акаунта `tepasha`.
2. GitHub → Settings → Environments → `staging`: задайте `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`. Налаштуйте Workload Identity Federation для деплою Firebase за [DEPLOY.md](../DEPLOY.md).
3. Expo → [budmo-app](https://expo.dev/accounts/tepasha/projects/budmo-app) → Environment variables → `preview`: задайте Firebase/Google, AdMob, legal URL і Sentry змінні, перелічені в [DEPLOY.md](../DEPLOY.md). `FIREBASE_PROJECT_ID` та `FIREBASE_FIRESTORE_DATABASE_ID` мають відповідати GitHub `staging`. Для CI й OTA використовуйте Plain text або Sensitive; файл `GOOGLE_SERVICES_JSON` також має бути доступний CI.
4. Налаштуйте Android signing credentials в EAS (`eas credentials --platform android`): автоматичний запуск працює без інтерактивних запитів.
5. Закомітьте зміни та зробіть push у `main`, або натисніть **Run workflow** в Preview (main).

Неповна конфігурація зупиняє викатку з конкретною помилкою; тестовий клієнт не переключається автоматично на production Firebase.

## Встановлення та оновлення

- Відкрийте успішний Android job → Summary → посилання **відкрити в EAS**, або [список збірок Expo](https://expo.dev/accounts/tepasha/projects/budmo-app/builds). Встановіть APK на Android.
- Після наступного успішного push JS і ресурси завантажуються через канал `preview`. Закрийте й повторно відкрийте застосунок, щоб застосувати завантажене оновлення.
- Якщо змінилися нативні залежності чи конфігурація, встановіть новий APK: runtime fingerprint не дозволяє старій збірці отримати несумісне оновлення.
- Для iPhone зареєструйте пристрій в EAS і запустіть iOS build вручну з профілем `preview`, `submit=false`. Потрібні Apple signing credentials і змінні App Store Connect з [DEPLOY.md](../DEPLOY.md). Сумісна iOS preview-збірка отримує той самий канал оновлень.
- Expo Go не підтримує всі нативні модулі цього проєкту; для перевірки Google sign-in, реклами й push використовуйте встановлену preview-збірку.

## Продакшн лише по кнопці

Push у будь-яку гілку, тег або розклад не запускає production. Усі production workflow перевіряють, що вихідна подія — `workflow_dispatch`.

- Повний реліз: [Production release (manual)](https://github.com/tepasha/cheers-/actions/workflows/release.yml) → **Run workflow**, гілка `main` або release-тег, що вказує на коміт у `main`. Збережені перевірки `STORE_RELEASES`, ключів сторів та схвалення GitHub Environment `production`.
- JS-оновлення: [OTA update](https://github.com/tepasha/cheers-/actions/workflows/ota.yml) → **Run workflow** → `channel=production`.
- Публікація протестованої збірки користувачам: [Promote to production](https://github.com/tepasha/cheers-/actions/workflows/promote.yml) → **Run workflow**. App Store review запускається в App Store Connect.

Документація Expo: [оновлення через GitHub Actions](https://docs.expo.dev/eas-update/github-actions/), [змінні середовища](https://docs.expo.dev/eas/environment-variables/), [сумісність runtime](https://docs.expo.dev/eas-update/runtime-versions/).
