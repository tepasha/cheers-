# План деплою та автодеплою (App Store + Google Play)

Стан на зараз: збірки `build-ios.yml` / `build-android.yml` стартують від тега `v*` або вручну й викликають EAS Build з автовідправкою. CI (`ci-check.yml`) окремо ганяє lint, тести, правила, бандл. Нижче: що з цього лишається, чого бракує і в якому порядку це робити.

## 1. Прогалини, знайдені в поточній схемі

| # | Прогалина | Наслідок |
|---|-----------|----------|
| 1 | Немає `extra.eas.projectId` (`eas init` не запускався) | EAS Build, Submit, Update і push не працюють |
| 2 | `.env` не потрапляє в хмарні збірки EAS | збірка без ключа Google Maps; застосунок падає на старті (Firebase не налаштовано) |
| 3 | Tag-збірка не залежить від CI: тег можна поставити на зламаний коміт | у стор їде те, що не пройшло тести та правила |
| 4 | `eas-version: latest` | збірка змінюється без змін у репозиторії |
| 5 | Немає OTA (`expo-updates`, `runtimeVersion`) | кожна правка тексту чи багу — повна збірка й рев'ю стору |
| 6 | Cloud Function і правила Firestore не деплояться з CI | клієнт і сервер розходяться: нова збірка чекає правила, яких немає |
| 7 | Немає FCM-ключа (Android) і `google-services.json` | push на Android не працює |
| 8 | Версія живе в `app.json` (`1.0.0`), тег не пов'язаний з нею | тег `v1.2.0` може зібрати 1.0.0 |
| 9 | Немає middleware-кроку «схвалення» перед production | один тег одразу відправляє в Play/TestFlight |
| 10 | Немає політики відкату | зламаний реліз виправляється лише новим релізом |

## 2. Цільова схема

```
PR                 → CI (lint, unit, rules, bundle, functions build)           [є]
merge у main       → CI + preview-збірки (internal) + EAS Update (канал preview)
                     + deploy правил/functions у STAGING-проєкт Firebase
тег vX.Y.Z         → CI як gate → production-збірки → submit:
                       iOS      → TestFlight (автоматично)
                       Android  → Play internal track (автоматично)
ручне схвалення    → «Promote»: TestFlight → App Store review, Play internal → production (staged 10%→50%→100%)
                     + deploy правил/functions у PRODUCTION
хотфікс (тільки JS)→ EAS Update у канал production (без рев'ю стору)
```

Ключова ідея: **усе, що можна, автоматично доходить до тестового треку; вихід до людей лише після ручного схвалення** (GitHub Environment `production` з обов'язковим reviewer).

## 3. Кроки (в порядку виконання)

### Етап 0. Одноразове налаштування (руками, код цього не зробить)

1. **EAS:** `npx eas-cli init` → `projectId` у `app.json`; створити `EXPO_TOKEN` (robot-токен) і додати в GitHub Secrets.
2. **EAS env** (замість `.env` у хмарі): `eas env:create` для середовищ `preview` і `production`: `FIREBASE_*`, `GOOGLE_MAPS_API_KEY`. Бажано **окремий Firebase-проєкт для staging**, щоб preview-збірки не писали у бойову базу.
3. **Apple:** Apple Developer Program (платно), створити запис застосунку в App Store Connect (`com.budmo.app`), App Store Connect API Key (роль App Manager) → секрети `APP_STORE_CONNECT_API_KEY_BASE64`, `APP_STORE_CONNECT_KEY_ID`, змінні `ASC_APP_ID`, `APPLE_TEAM_ID`. Ключ APNs і підписання EAS створить сам під час першої збірки (`eas credentials`).
4. **Google Play:** Play Console (разова плата), створити застосунок. **Перший AAB треба завантажити вручну**: API не створює застосунок і не приймає першу версію. Далі сервісний акаунт з доступом до Play API → `GOOGLE_SERVICE_ACCOUNT_BASE64`. Увімкнути Play App Signing (за замовчуванням; ключ завантаження тримає EAS).
5. **FCM:** проєкт Firebase Cloud Messaging V1, `google-services.json` у `android.googleServicesFile`, ключ сервісного акаунта в EAS (`eas credentials`).
6. **Firebase:** тариф Blaze (для functions), увімкнути Email/Password, App Check; сервісний акаунт для деплою правил/functions з CI (краще Workload Identity Federation, а не довгоживучий JSON-ключ).
7. **Ключ Google Maps:** обмежити за `com.budmo.app` та SHA-1 (і підписувальний ключ Play, і ключ завантаження).

### Етап 1. Зробити існуючі workflow надійними (код, ~півдня)

- Перенести перевірки у **reusable workflow** (`workflow_call`) і зробити `needs: ci` для обох збірок. Тег без зеленого CI нічого не збирає.
- Закріпити `eas-version` (наприклад `16.x`, ту, що локально), `expo-github-action` за SHA.
- Додати тригер **main → preview-збірки** (`--profile preview`, без submit) і concurrency-групи, щоб не плодити паралельні збірки.
- Перевірка версії: крок «тег `vX.Y.Z` == `expo.version` в `app.json`», інакше падіння. `appVersionSource: remote` + `autoIncrement` уже піклуються про `buildNumber`/`versionCode`.
- GitHub **Environment `production`** із required reviewers; production-job прив'язати до нього.
- Прибрати `google-service-account.json` із диска після submit (або передавати через EAS credentials, не файлом).

### Етап 2. Серверна частина в CI (~півдня)

- Workflow `deploy-backend.yml`: `firebase deploy --only firestore:rules,functions` (pinned `firebase-tools@15.32.1`), staging на main, production після схвалення.
- **Порядок релізу:** спочатку backend (правила й функції сумісні зі старою **і** новою збіркою), потім клієнт. Правила, що ламають стару збірку (як формат `devices` чи `enc:v2`), вводити лише додаючи, а не замінюючи. Старі клієнти лишаються в обігу тижнями.
- Перед деплоєм прогнати `npm run test:rules` (вже в CI).

### Етап 3. OTA-оновлення (~півдня)

- `npx expo install expo-updates`, `runtimeVersion: { policy: "appVersion" }`, канали `preview` і `production` в `eas.json`, `updates.url` з projectId.
- Workflow `ota.yml`: на main → `eas update --channel preview`; на ручний запуск → `--channel production`. OTA лише для JS/ресурсів; усе нативне (нові модулі, permissions, `app.config.ts` ключі) вимагає збірки. Крок CI: порівняти fingerprint (`npx expo-updates fingerprint:generate`) із попереднім релізом і **блокувати OTA, якщо нативна частина змінилась**.
- Це і є відкат: `eas update:rollback` / republish попередньої групи.

### Етап 4. Метадані й відповідність вимогам стору (найдовше за календарем)

Для обох сторів потрібні матеріали, яких немає в репозиторії:

- **Політика конфіденційності** за публічним URL, умови користування, контакт підтримки.
- **Вікова категорія 18+** (застосунок про алкоголь і зустрічі). Налаштувати в обох консолях.
- **Apple Guideline 1.2 (UGC):** є скарги, блокування, видалення акаунта (вимога 5.1.1(v) виконується). Додати в застосунок посилання на правила та контакт модерації й описати це у Review Notes.
- **Тестовий акаунт для рев'ю Apple/Google:** вхід вимагає підтвердженого email, тож потрібен готовий верифікований акаунт у production-базі й інструкція в Review Notes. Без цього рев'ю відхилить з «не змогли ввійти».
- **Privacy labels (Apple) та Data safety (Google):** збираються email, ім'я, дата народження, точна/приблизна геолокація, ідентифікатори пристрою (push), контент чатів. Декларація має збігатися зі SECURITY.md.
- **Геолокація:** обґрунтування, чому «лише під час використання» (вже так), фонової немає.
- **Скріншоти** (iPhone 6.9"/6.5", Android телефон), іконка, опис 4 мовами (uk/en/pl/de). Для Apple можна тримати в `store.config.json` і заливати через `eas metadata:push`.
- **Google Play:** для нових особистих акаунтів розробника діє вимога закритого тестування (кількість тестерів і тривалість; точні числа перевірте в Play Console, вони змінювались). Закласти тижні на це **до** першого production-релізу.
- **Експортне шифрування:** `ITSAppUsesNonExemptEncryption: false` вже стоїть; перевірте, що воно відповідає дійсності для AES-GCM у застосунку (шифрування застосовується лише для власних даних; рішення за вами/юристом).

### Етап 5. Операційна готовність

- **Crash/error моніторинг:** Sentry (`sentry-expo` / `@sentry/react-native`) із завантаженням sourcemaps у CI. Зараз є лише аналітика.
- Staged rollout у Play (10% → 50% → 100%), phased release в App Store; зупинка розгортання при зростанні крашів.
- Календар: ротація ключів APNs/App Store Connect/сервісних акаунтів, щорічне оновлення сертифікатів, вимоги `targetSdk` Google (щорічно) і мінімальної версії Xcode/SDK Apple (щорічно). Оновлення Expo SDK планувати 2–3 рази на рік.

## 3а. Що вже зроблено в коді (до реєстрації в сторах)

| Що | Де |
|----|----|
| CI як gate для всіх релізів (reusable), actions закріплені за SHA, `eas-cli` закріплено (24.8.0), перевірка нативних проєктів `expo prebuild` | [ci-check.yml](.github/workflows/ci-check.yml) |
| Тег `vX.Y.Z` → CI → перевірка версії → backend у production (з схваленням) → Android AAB у Play internal + iOS у TestFlight | [release.yml](.github/workflows/release.yml) |
| Merge у `main` → CI → backend у staging (лише якщо змінився) → (після змінної `PREVIEW_BUILDS=true`) Android preview + OTA | [preview.yml](.github/workflows/preview.yml) |
| Деплой правил і functions (Workload Identity, окрема база на середовище) | [deploy-backend.yml](.github/workflows/deploy-backend.yml) |
| OTA через EAS Update; `runtimeVersion` = нативний fingerprint, тож оновлення не дійде до несумісної збірки | [ota.yml](.github/workflows/ota.yml), [app.config.ts](app.config.ts) |
| Ручне просування: Play production зі staged rollout (за id збірки), App Store: метадані | [promote.yml](.github/workflows/promote.yml) |
| Перевірки релізу: тег = версія, `projectId`, змінні, плейсхолдери сторінки | [scripts/release-check.mjs](scripts/release-check.mjs) |
| Листинг App Store 4 мовами (валідний за `eas metadata:lint`), вікова анкета, Review Notes | [store.config.json](store.config.json) |
| Посилання на умови й політику (реєстрація, профіль), застереження про заборонений контент | [LegalLinks.tsx](src/components/LegalLinks.tsx) |
| Чернетки політики, умов, декларації даних | [docs/store/](docs/store/) |

Знахідки `expo prebuild`: прибрано зайві дозволи Android (`READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`: застосунок не пише у спільне сховище; налагоджувальні збірки зберігають `SYSTEM_ALERT_WINDOW` у debug-маніфесті), додано `expo-system-ui` (інакше `userInterfaceStyle` на Android ігнорувався). iOS-проєкт на Windows не генерується; його перевіряє CI на Linux.

Поки немає `EXPO_TOKEN` і `projectId`: збірки за тегом зупиняться на кроці `release-check --project` з зрозумілим повідомленням; `preview.yml` нічого не збирає, доки не задана змінна `PREVIEW_BUILDS`.

### Налаштування GitHub (Settings → Environments / Variables / Secrets)

| Environment | Reviewers | Variables |
|-------------|-----------|-----------|
| `staging` | не потрібні | `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` (порожні: деплой у staging пропускається) |
| `production` | **так** (backend і OTA для користувачів) | ті самі чотири змінні для бойового проєкту |
| `store-release` | **так** (promote) | `PRIVACY_POLICY_URL`, `TERMS_URL` |

Repository variables: `ASC_APP_ID`, `APPLE_TEAM_ID`, `PREVIEW_BUILDS` (`true`, коли готові EAS-змінні). Secrets: `EXPO_TOKEN`, `APP_STORE_CONNECT_API_KEY_BASE64`, `APP_STORE_CONNECT_KEY_ID`, `GOOGLE_SERVICE_ACCOUNT_BASE64`, опційно `EXPO_ACCESS_TOKEN`. EAS env (`preview`, `production`): `FIREBASE_*`, `GOOGLE_MAPS_API_KEY`, `PRIVACY_POLICY_URL`, `TERMS_URL`, файл `GOOGLE_SERVICES_JSON`.

**Не перевірено, бо потребує ваших акаунтів:** реальний запуск workflow (я перевірив лише синтаксис YAML і локальні скрипти), `eas build/submit/update`, Workload Identity, `eas metadata:push`.

## 4. Інвентар секретів

| Де | Що |
|----|----|
| GitHub Secrets | `EXPO_TOKEN`, `APP_STORE_CONNECT_API_KEY_BASE64`, `APP_STORE_CONNECT_KEY_ID`, `GOOGLE_SERVICE_ACCOUNT_BASE64`, (опційно) `FIREBASE_SERVICE_ACCOUNT` або WIF |
| GitHub Variables | `ASC_APP_ID`, `APPLE_TEAM_ID` |
| EAS env (preview/production) | `FIREBASE_*`, `GOOGLE_MAPS_API_KEY` |
| EAS credentials | keystore Android, сертифікати/профілі iOS, ключ APNs, FCM V1 |
| Firebase params | `FIRESTORE_DATABASE_ID`, `EXPO_ACCESS_TOKEN` (опційно) |

## 5. Ризики й чесні обмеження

- **Рев'ю Apple/Google не автоматизується**: час очікування й можливі відмови поза вашим контролем. Закладайте запас у кілька днів на перший реліз.
- **Перший Android-реліз і закритий тест** визначають календар більше, ніж код.
- **Збірки на `ubuntu-latest` не потребують macOS:** iOS будується в хмарі EAS. Ліміти безкоштовного плану EAS (черга, число збірок) варто звірити з очікуваною частотою релізів.
- **Правила, що змінюють формат даних** (на кшталт `enc:v2` чи `devices`), роблять старі збірки нечитабельними; тому backend першим і лише додавально.
- Мінімум для першого релізу без OTA/Sentry: етапи 0, 1 (gate + pin + approval), 2 і потрібна частина 4. Етапи 3 і 5 можна додати наступним кроком, але Sentry краще мати **до** публічного релізу.

## 6. Оцінка

| Етап | Робота | Залежить від |
|------|--------|--------------|
| 0 | 1–2 дні (акаунти, ключі) | оплата акаунтів, верифікація Apple (бувають дні) |
| 1 | ~0,5 дня | етап 0 |
| 2 | ~0,5 дня | етап 0 (Blaze, сервісний акаунт) |
| 3 | ~0,5 дня | етап 0 |
| 4 | 2–5 днів (матеріали) + очікування рев'ю | політика, скріншоти, тестовий акаунт |
| 5 | ~0,5–1 день | — |
