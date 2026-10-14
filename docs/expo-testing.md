# Тестові версії через Expo

Кожен push у гілку `stage` автоматично, без схвалень, запускає [Preview (stage)](https://github.com/tepasha/cheers-/actions/workflows/preview.yml): перевірки коду, staging-бекенд, Android APK на EAS Build (він же з'являється в [GitHub Releases](https://github.com/tepasha/cheers-/releases) як pre-release), потім оновлення EAS Update у канал `preview` і його копія для Expo Go. Усе лише в тестовому оточенні, і кожен крок виконується на кожен push. Якщо GitHub Environment `staging` не налаштований, конвеєр падає на кроці бекенду. Push у `main` запускає тільки CI. Прапорець `PREVIEW_BUILDS` більше не потрібний. Конвеєр виконується послідовно, щоб старий коміт не перекрив нове оновлення.

## Одноразове підключення

1. GitHub → Settings → Secrets and variables → Actions: додайте секрет `EXPO_TOKEN` з Expo access token акаунта `tepasha`.
2. GitHub → Settings → Environments → `staging` (без reviewers, щоб деплой ішов автоматично): задайте `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`. Налаштуйте Workload Identity Federation для деплою Firebase за [DEPLOY.md](../DEPLOY.md).
3. Expo → [budmo-app](https://expo.dev/accounts/tepasha/projects/budmo-app) → Environment variables → `preview`: задайте Firebase/Google змінні, перелічені в [DEPLOY.md](../DEPLOY.md). Legal URL, `SUPPORT_EMAIL`, `SENTRY_*` та реальні AdMob app id для тестового APK й preview-OTA необов'язкові. Без них посилання й email не показуються, моніторинг без DSN вимкнений, source maps без credentials не завантажуються, а AdMob використовує тестові app id. `FIREBASE_PROJECT_ID` та `FIREBASE_FIRESTORE_DATABASE_ID` мають указувати на staging-проєкт: на гілці `stage` CI це не перевіряє. Для CI й OTA використовуйте Plain text або Sensitive; файл `GOOGLE_SERVICES_JSON` також має бути доступний CI.
4. Налаштуйте Android signing credentials в EAS (`eas credentials --platform android`): автоматичний запуск працює без інтерактивних запитів.
5. Злийте зміни в гілку `stage` і зробіть push, або натисніть **Run workflow** в Preview (stage).

Неповна конфігурація зупиняє викатку з конкретною помилкою; тестовий клієнт не переключається автоматично на production Firebase.

## Встановлення та оновлення

- **APK з GitHub:** [Releases](https://github.com/tepasha/cheers-/releases) → найновіший pre-release `Stage #<номер> · <коміт>` → Assets → `budmo-stage-<номер>.apk`. Зберігаються 5 останніх; у Releases вони не позначаються як latest. Репозиторій публічний, тож APK (staging-бекенд) може завантажити будь-хто.
- Або відкрийте успішний Android job → Summary → посилання **відкрити в EAS**, або [список збірок Expo](https://expo.dev/accounts/tepasha/projects/budmo-app/builds). Встановіть APK на Android.
- Після наступного успішного push JS і ресурси завантажуються через канал `preview`. Закрийте й повторно відкрийте застосунок, щоб застосувати завантажене оновлення.
- Якщо змінилися нативні залежності чи конфігурація, встановіть новий APK: runtime fingerprint не дозволяє старій збірці отримати несумісне оновлення.
- iOS вимкнено з деплою: CI не збирає iOS і публікує OTA лише для Android.
- **Expo Go:** кожне preview-оновлення публікується ще й копією з runtime `exposdk:<SDK>.0.0` (повідомлення `Expo Go · <коміт>`), бо Expo Go відкриває лише такі. В Expo Go (тієї ж версії SDK, увійдіть в акаунт `tepasha`) → проєкт `budmo-app` → гілка `preview` → оновлення `Expo Go · …`. Оновлення без префікса призначені для APK і в Expo Go лишаються «Not compatible», так і має бути.
- В Expo Go немає частини нативних модулів проєкту: реклама не показується, вхід через Google повертає помилку, push-сповіщення на Android не працюють. Їх перевіряйте у встановленому APK.
- Локально (`npm start` → QR у Expo Go) працює так само.

## Продакшн лише по кнопці

Push у будь-яку гілку, тег або розклад не запускає production. Усі production workflow перевіряють, що вихідна подія — `workflow_dispatch`.

- Повний реліз: [Production release (manual)](https://github.com/tepasha/cheers-/actions/workflows/release.yml) → **Run workflow**, гілка `main` або release-тег, що вказує на коміт у `main`. Збережені перевірки `STORE_RELEASES`, ключів сторів та схвалення GitHub Environment `production`.
- JS-оновлення: [OTA update](https://github.com/tepasha/cheers-/actions/workflows/ota.yml) → **Run workflow** (лише production).
- Публікація протестованої збірки користувачам: [Promote to production](https://github.com/tepasha/cheers-/actions/workflows/promote.yml) → **Run workflow**. App Store review запускається в App Store Connect.

Документація Expo: [оновлення через GitHub Actions](https://docs.expo.dev/eas-update/github-actions/), [змінні середовища](https://docs.expo.dev/eas/environment-variables/), [сумісність runtime](https://docs.expo.dev/eas-update/runtime-versions/).
