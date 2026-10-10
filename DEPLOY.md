# Деплой і релізи (App Store + Google Play)

Автоматичне тестування та ручний production: [інструкція Expo](docs/expo-testing.md). Push у гілку `stage` автоматично деплоїть staging-бекенд, збирає Android preview APK і публікує preview-OTA (лише тестове оточення); push у `main` запускає тільки CI. Production запускається тільки через **Run workflow**; створення тегу нічого не викочує.

> **iOS вимкнено з деплою.** CI збирає, відправляє й оновлює (OTA, `eas update --platform android`) лише Android; `build-ios.yml` видалено, а release.yml і promote.yml не мають iOS-кроків і не вимагають ключів Apple. Пункти про Apple нижче лишаються довідкою на випадок повернення iOS (відновіть `build-ios.yml` з історії git).

## Зміни для першого публічного релізу — 2026-10-07

Цей розділ має пріоритет над історичним планом нижче. Код містить нові callable functions, серверні вікові claims, квоти публікації, приватний пошук, outbox, Sentry та модераторську чергу. Старі dev збірки не сумісні з новими rules: для першого релізу спочатку розгорніть backend у staging, виконайте onboarding тестових акаунтів, потім зберіть нові нативні binaries. Для вже публічних версій потрібний окремий план міграції.

- У EAS `production` додайте `SUPPORT_EMAIL`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` і реальні `PRIVACY_POLICY_URL`, `TERMS_URL`. У `preview` ці змінні та `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` необов'язкові: відсутні посилання й контакт не показуються, без DSN моніторинг вимкнений, без upload credentials завантаження source maps пропускається, без AdMob app id використовуються тестові ID Google. Firebase/Google, файл `GOOGLE_SERVICES_JSON` для Android і перевірка staging-бекенду залишаються обов'язковими. CI передає `--profile preview` у `release-check --env`; без `--profile` діють вимоги production. Upload token має мінімальні права на source maps; не додавайте його до `extra` або git. Для `eas env:exec` потрібна видимість Sensitive. `SUPPORT_URL` необов'язковий.
- Functions використовують Node 22. Локальні та CI emulator тести потребують **Java 21+**. Розгорніть **rules, indexes і functions** у ту саму іменовану базу; indexes містять `devices(uid, updatedAt)` і collection-group `friends(friendId)` для push та видалення.
- Потрібні callable `completeOnboarding`, `discoverNearby`, `publicUserProfile`, `deleteMyAccount`; triggers `onChatMessage`, `onAbuseReport`; scheduler `cleanupExpiredContent`, `reconcilePushReceipts`, `monitorModerationQueue`. Blaze та Cloud Scheduler обов'язкові для очищення й receipts.
- Налаштуйте Sentry проєкт, перевірте source-map upload, тестову JS помилку та окремий native crash на staging пристроях. Встановіть строк зберігання reports, доступ команди та alerts; додайте diagnostics до store disclosure.
- Призначте оператора модерації й канал повідомлень. Cloud Monitoring має реагувати на `moderation.report.pending`, `moderation.report.overdue`, помилки functions, збільшення quota відмов та бюджет. Перевірка черги: `node functions/scripts/moderate-reports.mjs <project> <database> list`; перегляд: `inspect <reportId>`. `dismiss` / `ban` вимагають конкретного reportId й `--execute`. Працюйте через окремий ADC акаунт з мінімальними правами; не через публічний клієнт.
- Ban створює серверний `bannedUsers` marker: нові rules/callables відмовляють спільним діям навіть зі старим ID token. Групи мають максимум 9 людей для ліміту читань rules. Нативний App Check ще не інтегрований; перед масштабуванням узгодьте атестацію та операційний захист від масових акаунтів.
- Заповніть юридичного власника, контакти, сторінку видалення, країни доступності та реальний reviewer акаунт. У `store.config.json` залишені явні `REPLACE_ME`, щоб випадково не опублікувати чужі контакти. Заяви про наскрізне шифрування, точність до будівлі або автоматичний бан за скаргами використовувати не можна.
- Export compliance для застосунку з AES визначає власник. Для iOS задайте `EXPORT_ENCRYPTION_CLASSIFICATION=exempt` або `non-exempt` лише після перевірки; конфігурація формує відповідний `ITSAppUsesNonExemptEncryption`. Неперевірене автоматичне `false` видалене. За потреби завантажте документи в App Store Connect. Джерело: [Apple export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/). Перевірте також анкети дитячої безпеки/UGC, [декларацію даних](docs/store/data-disclosure.md), privacy manifests і права foreground location.

Перед публікацією проведіть smoke test на фізичних Android та iOS: email/Google/Apple і повторний вхід, DOB/consent, opt-in GPS і відкликання дозволу, два акаунти на одному телефоні, DM/група/пропозиція, offline/restart/retry, повний столик та зустріч, скарга/блокування, push у foreground/background/killed, tap після cold start, видалення акаунта й Sentry. На Windows генерація iOS конфігурації або JS export не є Xcode build.

Документ описує конвеєр так, як його виконують workflow у [.github/workflows/](.github/workflows/): що запускає кожну подію, у якому порядку, що потрібно налаштувати один раз і що робити руками на кожному релізі. Поточний стан (зроблено / ще ні) зібрано в одному місці, у [таблиці 3а](#3а-стан-єдина-таблиця).

## 1. Історія

Перша версія плану перелічувала прогалини попередньої схеми: projectId, EAS-змінні, CI gates, OTA, деплой, зв'язок тегу з версією та відкат. Вони реалізовані. Поточні release умови й інтеграція Sentry описані на початку документа; App Check та зовнішні налаштування лишаються окремими пунктами.

## 2. Як працює конвеєр

```
PR, push у main/develop → ci-check.yml: release-check, lint + tsc, unit-тести, Metro-бандл, expo prebuild,
                          збірка functions; окремий job: правила Firestore + контракт клієнта на емуляторі

push у stage (preview.yml), усе автоматично, лише тестове оточення
  → CI
  → backend у STAGING (deploy-backend.yml, на КОЖЕН push; якщо Environment `staging` не налаштовано,
    деплой пропускається з ::notice::)
  → Android preview APK (EAS, internal) → EAS Update у канал `preview`
    (порівняння EAS `preview` з GitHub `staging` пропущене)

кнопка Run workflow (release.yml, main або release-тег)
  → CI
  → verify: версії в app.json і package.json збігаються, коміт є в main, є projectId,
            STORE_RELEASES = 'true', є `EXPO_TOKEN` і ключ Play, EAS-середовище `production` повне (Android)
  → backend у PRODUCTION (чекає схвалення Environment `production`)
  → Android AAB → Play internal track

вручну promote.yml (чекає схвалення Environment `store-release`; backend НЕ чіпає)
  Android: та сама збірка з internal → production, staged rollout 0.1 → 0.5 → 1 (нічого не завантажує вдруге)

вручну ota.yml, канал production  → CI → схвалення `production` → EAS Update (лише JS і ресурси)
вручну deploy-backend.yml         → CI → staging, або production (схвалення)
вручну build-android/ios.yml      → CI → preview (лише проти staging-бекенду) або production
```

Головне:

- **Production-бекенд змінюється після ручного запуску release.yml, а не на promote.** Після схвалення `production` правила й functions замінюються, і лише потім стартують збірки; `promote.yml` бекенд не чіпає. Push і створення тегу не запускають цей конвеєр.
- **Щоб ручний запуск не дав пів-релізу** (бекенд оновлено, а збірки впали на відсутньому ключі), verify-job `release.yml` зупиняє реліз до будь-якого деплою, якщо змінна репозиторію `STORE_RELEASES` не `true`, якщо бракує `EXPO_TOKEN` чи `GOOGLE_SERVICE_ACCOUNT_BASE64`, або якщо EAS-середовище `production` неповне для Android. Ставте `STORE_RELEASES=true` лише після Android-частини етапу 0 (зокрема першого AAB у Play, якого CI перевірити не може).
- **Усе, що веде в production** (OTA-канал production, production-збірки, backend у production, promote), потребує події `workflow_dispatch` з `main` або тегу `vX.Y.Z`, коміт якого є в `main` (`release-check.mjs --release-ref`). Перевірку тригера проходять і reusable workflow. CI виконується один раз у батьківському конвеєрі; окремий ручний запуск також запускає весь CI.
- **Preview-клієнти говорять лише зі staging-бекендом:** preview-збірки й preview-OTA порівнюють Firebase-проєкт і базу EAS-середовища `preview` зі змінними GitHub Environment `staging`; production-OTA порівнює EAS `production` з GitHub `production`.
- **Порядок для цього першого релізу: staging backend, нові binaries, перевірка, production.** Нові age claims і квоти несумісні зі старими dev збірками. Для наступних публічних версій підтримуйте сумісність або готуйте окрему міграцію до посилення rules.

## 3. Кроки

### Етап 0. Одноразове налаштування (руками, код цього не зробить)

Повний упорядкований чек-лист цих кроків разом з кроками з README є в кінці розділу (0.1). Номери кроків 3 і 4 згадують повідомлення CI, тож вони сталі.

1. **EAS:** `projectId` уже в `app.json` (`extra.eas.projectId`, для форку: `npx eas-cli init`). Створіть robot-токен Expo і додайте його як секрет репозиторію `EXPO_TOKEN`.
2. **EAS env** (замість `.env` у хмарі): `eas env:create` для середовищ `preview` і `production` (за потреби й `development`): `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_FIRESTORE_DATABASE_ID` (іменована база, не `(default)`), `GOOGLE_WEB_CLIENT_ID` (або `FIREBASE_OAUTH_CLIENT_ID`), `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_MAPS_API_KEY`, `ADMOB_ANDROID_APP_ID`, `ADMOB_IOS_APP_ID`, `PRIVACY_POLICY_URL`, `TERMS_URL` (публічні https-сторінки) і файлова змінна `GOOGLE_SERVICES_JSON` (`eas env:create --type file`). **Видимість лише Plain text або Sensitive, не Secret:** `eas update` і `eas env:exec` Secret-змінних не бачать, тож OTA-оновлення вийшло б без них, хоча збірка їх мала. У production усі ці змінні обов'язкові; у preview legal URL, `SUPPORT_EMAIL`, `SENTRY_*` та реальні AdMob app id необов'язкові. `build-*.yml` перед `eas build` та `ota.yml` перед `eas update` запускають `release-check.mjs --env --profile <profile>`, `promote.yml` і verify-job `release.yml` застосовують production-вимоги, а `app.config.ts` на EAS-воркері повторює перевірку відповідного профілю (так ловиться й ручний `eas build`).
   - **Кожне EAS-середовище вказує на бекенд свого каналу:** `FIREBASE_PROJECT_ID` і `FIREBASE_FIRESTORE_DATABASE_ID` у EAS `preview` мають дорівнювати змінним `FIREBASE_PROJECT_ID` і `FIRESTORE_DATABASE_ID` GitHub Environment `staging`, а в EAS `production` – змінним GitHub Environment `production` (саме туди `deploy-backend.yml` деплоїть правила й functions). Інакше preview-тестери писали б у бойову базу або тестували проти правил, задеплоєних деінде. CI це перевіряє (`release-check.mjs --backend` через `eas env:exec`). Якщо в `staging` цих змінних немає, деплой бекенду в staging пропускається, а preview-клієнти не збираються й не публікуються (job падає з `::error::`). Найкраще – **окремий Firebase-проєкт для staging**; решта EAS-змінних `preview` (`FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `GOOGLE_SERVICES_JSON`, OAuth client id) мають бути з того самого staging-проєкту.
3. **Apple:** Apple Developer Program (платно), запис застосунку в App Store Connect (`com.budmo.app`), App Store Connect API Key (Users and Access → Integrations → App Store Connect API, **командний** ключ з роллю App Manager) → секрети репозиторію `APP_STORE_CONNECT_API_KEY_BASE64` (`base64 -w0 AuthKey_<id>.p8`), `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID` (Issuer ID, UUID над списком ключів), змінні репозиторію `ASC_APP_ID` (числовий Apple ID застосунку), `APPLE_TEAM_ID`. Ключ і `APPLE_TEAM_ID` потрібні **кожній** iOS-збірці в CI (EAS створює й ремонтує нею профіль підписання), `ASC_APP_ID` – відправці в TestFlight. CI передає ключ у EAS через `EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID` (збірка, `eas submit`, `eas metadata:push`) і падає з `::error::`, якщо чогось бракує. **Сертифікат дистрибуції один раз створіть інтерактивно:** eas-cli 24.8.0 у `--non-interactive` його не створює навіть з ключем (`npx eas-cli credentials -p ios` → production → Build Credentials, або перша `npx eas-cli build -p ios --profile production` з власного комп'ютера). Ключ APNs (push) так само додається через `eas credentials`. Для входу через Apple: Identifiers → `com.budmo.app` → capability «Sign In with Apple» (див. README).
4. **Google Play:** Play Console (разова плата), створити застосунок. Увімкнути Play App Signing (за замовчуванням; ключ завантаження тримає EAS, у `--non-interactive` EAS створює його сам на першій збірці). **Перший AAB треба завантажити вручну**: API не приймає першу версію нового застосунку. Порядок: запустіть `build-android.yml` вручну з `main` (`profile: production`, `submit` вимкнено), завантажте AAB зі сторінки збірки в EAS і викладіть його в Play Console → Testing → Internal testing. Далі сервісний акаунт з доступом до Play API (Play Console → Users and permissions: запросити email сервісного акаунта з правами на випуск у тестові треки **і** в production) → секрет репозиторію `GOOGLE_SERVICE_ACCOUNT_BASE64` (`base64 -w0 key.json`). Цей секрет обовʼязковий і для відправки tag-збірки в internal track, і для `promote.yml`: `eas.json` прямо вказує файл ключа (`serviceAccountKeyPath`), тож ключ, збережений в EAS, CI не використовує, а без секрету job падає з `::error::` ще до старту хмарної збірки. SHA-1 і SHA-256 ключа Play App Signing додайте до Android-застосунку у Firebase (вхід через Google) і до обмеження ключа карт.
5. **FCM (push на Android):** Firebase Cloud Messaging API (V1) у проєкті; `google-services.json` того ж проєкту як файлова EAS-змінна `GOOGLE_SERVICES_JSON` (крок 2); ключ сервісного акаунта FCM V1 у EAS (`npx eas-cli credentials -p android` → production → «Google Service Account Key for Push Notifications (FCM V1)»).
6. **Firebase:** тариф Blaze (для functions), увімкнути Email/Password (і Google, Apple), App Check (коли зʼявиться провайдер); сервісний акаунт для деплою правил/functions з CI через Workload Identity Federation (довгоживучого JSON-ключа в GitHub немає) для кожного проєкту (staging і production). Ключ `FIREBASE_API_KEY` обмежувати лише за API, не за Android/iOS-застосунком (див. [SECURITY.md](SECURITY.md), «Розгортання», крок 4): Firebase JS SDK не надсилає заголовків застосунку, і таке обмеження зламає вхід усім.
   - **Перший деплой functions і політика очищення образів.** firebase-tools 15.32.1 у `--non-interactive` завершується з помилкою, якщо в репозиторії образів `gcf-artifacts` немає cleanup policy, а сам репозиторій зʼявляється лише під час першого деплою (заздалегідь політику не поставити). `deploy-backend.yml` це обробляє сам: ставить політику на 7 днів (`functions:artifacts:setpolicy --location us-central1 --days 7 --force`) і деплоїть удруге. Для цього сервісному акаунту деплою потрібні `artifactregistry.repositories.update` і `artifactregistry.versions.delete` (наприклад, роль Artifact Registry Administrator на проєкті). Якщо не хочете давати ці права, один раз після першого (червоного) деплою виконайте те саме вручну з власного акаунта і перезапустіть job:
     ```bash
     npx firebase-tools@15.32.1 functions:artifacts:setpolicy --project <project-id> --location us-central1 --days 7
     ```
   - **Видалення чи перейменування функції.** CI деплоїть без `--force`, тому функцію, якої вже немає в коді, він не видалить, а зупиниться («deletion cannot proceed in non-interactive mode»). Видаляйте її явно перед релізом: `npx firebase-tools@15.32.1 functions:delete <name> --region us-central1 --project <project-id>` (для обох проєктів). При перейменуванні спершу задеплойте нову функцію, потім видаліть стару, щоб не втратити події.
   - **Параметри functions** пише CI у `functions/.env.<project-id>`: `FIRESTORE_DATABASE_ID` зі змінної середовища (обовʼязковий, значення за замовчуванням немає) і `EXPO_ACCESS_TOKEN` із секрету, лише якщо він є. Для ручного деплою див. «Бекенд вручну» нижче.
7. **Ключ Google Maps:** обмежити за `com.budmo.app` та SHA-1 (і ключ Play App Signing, і ключ завантаження).
8. **GitHub:** середовища `staging`, `production`, `store-release` з reviewers, правилами гілок і змінними за [таблицею нижче](#налаштування-github-settings--environments--variables--secrets). Preview автоматично запускається після push у `stage`, коли готове EAS `preview`; `staging` без reviewers, щоб нічого не чекало схвалення. **Останнім**, коли зроблено кроки 1–7 і перший AAB уже в Play: `STORE_RELEASES=true`; до того ручний production-реліз зупиняється на verify, нічого не деплоївши.

#### Файлова конфігурація перед build / update

Перед ручним Android build або OTA завантажте файлові змінні саме того EAS-середовища, яке використовуєте:

```sh
npx eas-cli env:pull preview --path .env.local --non-interactive
npx eas-cli build --platform android --profile preview
```

Для production замініть `preview` на `production`; перед `eas update --environment <середовище>` також повторіть `env:pull`. `GOOGLE_SERVICES_JSON` має бути файловою змінною з видимістю Sensitive. CLI без `env:pull` отримує лише ім'я файла, а EAS-воркер — його вміст: це спричиняє runtime fingerprint mismatch у фазі Configure expo-updates. `env:pull` записує файл у `.eas/.env/GOOGLE_SERVICES_JSON`; `app.config.ts` використовує цю локальну копію, коли шлях зі змінної не існує, зокрема з `EXPO_NO_DOTENV=1`. На воркері використовується лише інжектований файл. CI завантажує файли перед Android build і OTA автоматично; `.eas/` та `.env.local` ігноруються git і не потрапляють до build archive. Вміст google-services.json залишається частиною fingerprint, тому його зміна потребує нової нативної збірки.

#### 0.1. Упорядкований чек-лист одноразових кроків

1. Firebase production-проєкт на Blaze; (рекомендовано) окремий staging-проєкт з іменованою базою. Authentication: Email/Password увімкнено, Anonymous вимкнено, Google і Apple увімкнено, шаблон листа, Authorized domains ([SECURITY.md](SECURITY.md), кроки 1–3; README).
2. Google Cloud для кожного проєкту: Workload Identity provider і сервісний акаунт деплою (правила, functions, плюс `artifactregistry.repositories.update` / `artifactregistry.versions.delete`).
3. Ключі в Google Cloud → Credentials: `FIREBASE_API_KEY` лише за API (Identity Toolkit, Token Service, Cloud Firestore), Application restrictions = None; ключ карт за пакетом і SHA-1. OAuth clients: web, iOS; SHA-1/SHA-256 Android-ключів у Firebase.
4. Опублікувати https-сторінки: політика конфіденційності, умови, видалення акаунта ([docs/store/](docs/store/)).
5. Expo: `EXPO_TOKEN` у секрети репозиторію; EAS-змінні `preview` (staging-проєкт) і `production` (бойовий), видимість Plain text / Sensitive; FCM V1 і APNs у `eas credentials`; за потреби секрет `EXPO_ACCESS_TOKEN`.
6. GitHub Environments `staging` і `production`: чотири змінні кожному, `FIRESTORE_DATABASE_ID` у `production` = `ai-studio-df109a92-91f7-44f7-944f-c92e7aa387b8`; ті самі змінні на рівні репозиторію видалити. Reviewers і правила гілок для `production` і `store-release`.
7. Перший деплой бекенду: staging (push у `stage` або `deploy-backend.yml`), production (`deploy-backend.yml` вручну з `main`); якщо CI не має прав на cleanup policy, `functions:artifacts:setpolicy` вручну й перезапуск.
8. Preview автоматично запускається після push у `stage`; прапорець `PREVIEW_BUILDS` не потрібний.
9. Apple: запис застосунку, capability Sign In with Apple, командний ключ API → три секрети, змінні `APPLE_TEAM_ID`, `ASC_APP_ID`; сертифікат дистрибуції інтерактивно (`npx eas-cli credentials -p ios`).
10. Google Play: застосунок, перший production-AAB вручну в internal testing, сервісний акаунт з правами випуску → `GOOGLE_SERVICE_ACCOUNT_BASE64`; SHA ключа Play App Signing у Firebase і в обмеження ключа карт.
11. `STORE_RELEASES=true`, далі перший реліз за розділом «Реліз» нижче.

### Реліз (кнопка Run workflow)

1. Підніміть версію однаково в `app.json` (`expo.version`) і `package.json`; `buildNumber` / `versionCode` EAS веде сам (`appVersionSource: remote`, `autoIncrement`). Злийте коміт у `stage` і дочекайтесь зеленого `preview.yml` (staging-бекенд і preview-клієнти цього коміту), потім злийте в `main`.
2. GitHub → Actions → **Production release (manual)** → **Run workflow**, оберіть `main`. За потреби спочатку створіть тег `vX.Y.Z` на коміті в `main` та виберіть його при ручному запуску; сам push тегу не запускає реліз. Локальна перевірка версії тегу: `node scripts/release-check.mjs --tag vX.Y.Z --project`.
3. `release.yml`: CI → verify → **схваліть `production`** (це деплой правил і functions у бойовий проєкт) → збірка й відправка в Play internal. Id збірки є в підсумку job.
4. Якщо збірка чи відправка впала вже після деплою бекенду, зупиніть публікацію й перевірте сумісність активних клієнтів. Цей перший реліз змінює контракт rules; старі dev клієнти не підтримуються. Після усунення причини повторіть невдалий job. Для наступних публічних релізів план сумісності та відкату потрібен до деплою.
5. Перевірте збірку в internal testing, далі promote.

### Promote (вихід до користувачів)

- **Android:** `promote.yml`, `build_id` – EAS-id production-збірки з тегу, `rollout: 0.1`. Пізніше той самий `build_id` з `0.5`, потім `1` (= 100%, `completed`). Workflow бере versionCode і пакет з EAS, приймає лише завершену production store-збірку з коміту в `main` і переводить її з internal у production через Play Developer API ([scripts/play-promote.mjs](scripts/play-promote.mjs)), нічого не завантажуючи вдруге. Зменшити частку не можна: зупиняйте розгортання в Play Console (Halt). Якщо в Play увімкнено Managed publishing або коміт відхилено з «changesNotSentForReview», опублікуйте зміну в Play Console.
- **iOS:** не деплоїться. Раніше `promote.yml`, `platform: ios` заливав листинг ([store.config.json](store.config.json)) через `eas metadata:push` після перевірки `--store` (немає `REPLACE_ME`, юридичні посилання https з EAS `production`). Збірку для рев'ю, «Submit for Review» і phased release обираєте в App Store Connect: EAS цього не робить.

### OTA-оновлення

- **Що це:** EAS Update доставляє JS і ресурси без рев'ю стору. `runtimeVersion` = нативний **fingerprint** (`runtimeVersion: { policy: 'fingerprint' }` у [app.config.ts](app.config.ts)): оновлення доходить лише до збірок з тим самим нативним кодом. **Не перемикайте на `appVersion`:** тоді оновлення діставалося б збірок тієї самої версії з іншим нативним кодом і падало б у них. `extra` (EAS-змінні) і версія у fingerprint не входять ([fingerprint.config.js](fingerprint.config.js)): кожне оновлення несе їх у маніфесті. Будь-яка нативна зміна (залежності, плагіни, ключ карт, iOS client id, `google-services.json`, `eas.json`) потребує store-збірки.
- **preview:** автоматично на кожен push у `stage`, після staging-деплою та успішної Android preview-збірки.
- **production:** `ota.yml` вручну з `main` або тегу, `channel: production`, після CI і схвалення `production`. Перед публікацією workflow перевіряє повноту EAS `production`, що вона вказує на бекенд GitHub `production`, і що для **кожної** платформи є завершена production-збірка з тим самим runtime (інакше падає: оновлення нікому б не дійшло; спершу store-збірка). Після публікації перевіряє фактичний runtime ще раз.
- **Відкат:** `npx eas-cli update:rollback` (публікує попередню групу оновлень каналу, а якщо її немає, повертає вбудований у збірку бандл) або новий OTA з виправленням.

### Бекенд вручну

- **Через CI (рекомендовано):** `deploy-backend.yml` → `staging` або `production`. Ручний запуск ганяє весь CI (включно з правилами на емуляторі), production лише з `main` або тегу й після схвалення, і лише якщо `FIRESTORE_DATABASE_ID` середовища дорівнює базі з `firebase.json`.
- **З власного комп'ютера:** `firebase.json` називає базу production-проєкту; для іншого проєкту тимчасово замініть у ньому `database` (CI робить це сам). Правила: `npx firebase-tools@15.32.1 deploy --only firestore:rules --project <project-id>`. Functions: спершу `functions/.env.<project-id>` з `FIRESTORE_DATABASE_ID` (див. README, розділ про push), потім `npx firebase-tools@15.32.1 deploy --only functions --project <project-id>`.
- Перед деплоєм правил: `npm run test:rules`.

### Реклама (Google AdMob)

Де показується: смужка 320×50 над таб-баром на всіх вкладках, крім Карти; у «Кличах» слот 320×100 після кожних 10 карток («Зараз») і кожних 5 («Заплановані»). Список, коротший за інтервал, реклами не має. Чати, модальні вікна, SOS і онбординг без реклами. Код: [src/services/ads.ts](src/services/ads.ts), [src/components/AdBanner.tsx](src/components/AdBanner.tsx), [src/logic/ads.ts](src/logic/ads.ts).

1. [AdMob](https://apps.admob.com): створіть два застосунки (Android `com.budmo.app`, iOS `com.budmo.app`) і в кожному два банерні блоки: `banner` (смужка) та `inline` (слоти в списку). Ідентифікатори застосунків → `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` (обов'язкові в production; у preview можна залишити порожніми для тестових ID Google), блоки → `ADMOB_*_BANNER_ID` / `ADMOB_*_INLINE_ID` **лише в production**: без них збірка показує тестову рекламу Google, і тестувальники не клікають живу (за це AdMob блокує акаунт).
2. AdMob → Privacy & messaging: опублікуйте повідомлення GDPR (EEA/UK). Без нього `gatherConsent` не покаже форму, і в ЄС реклама буде обмеженою. Кнопка «Налаштування реклами» в Профілі з'являється автоматично, коли Google її вимагає.
3. AdMob → Blocking controls: заблокуйте категорії «Алкоголь», «Азартні ігри», «Знайомства» та інші чутливі; рейтинг контенту — не вище T/MA за рішенням власника.
4. Опублікуйте `app-ads.txt` на домені розробника, вказаному в сторінках магазинів.
5. Реклама неперсоналізована (`requestNonPersonalizedAdsOnly`), без ATT. Персоналізація дала б більший дохід, але потребує запиту ATT на iOS, `NSUserTrackingUsageDescription` і декларації трекінгу в обох магазинах.
6. Нативний модуль: потрібна нова збірка (не OTA). Ідентифікатори застосунків входять у fingerprint, блоки — ні (їх можна міняти OTA).

### Етап 4. Метадані й відповідність вимогам стору (найдовше за календарем)

Для обох сторів потрібні матеріали, яких немає в репозиторії:

- **Політика конфіденційності** за публічним URL, умови користування, сторінка видалення акаунта, контакт підтримки (чернетки в [docs/store/](docs/store/)).
- **Вікова категорія 18+** (застосунок про алкоголь і зустрічі; у застосунку поріг 21). Налаштувати в обох консолях.
- **Apple Guideline 1.2 (UGC):** є скарги, блокування, видалення акаунта (вимога 5.1.1(v) виконується). Додати в застосунок посилання на правила та контакт модерації й описати це у Review Notes.
- **Тестовий акаунт для рев'ю Apple/Google:** вхід вимагає підтвердженого email, тож потрібен готовий верифікований акаунт у production-базі й інструкція в Review Notes (поля `REPLACE_ME` у `store.config.json`; `promote.yml` для iOS без них не пройде).
- **Privacy labels (Apple) та Data safety (Google):** збираються email, ім'я, дата народження, точна/приблизна геолокація, ідентифікатори пристрою (push), контент чатів. Декларація має збігатися зі SECURITY.md і [docs/store/data-disclosure.md](docs/store/data-disclosure.md).
- **Геолокація:** обґрунтування, чому «лише під час використання» (вже так), фонової немає.
- **Скріншоти** (iPhone 6.9"/6.5", Android телефон), іконка, опис 4 мовами (uk/en/pl/de). Для Apple листинг у `store.config.json`, заливає `promote.yml` (`eas metadata:push`).
- **Google Play:** для нових особистих акаунтів розробника діє вимога закритого тестування (кількість тестерів і тривалість; точні числа перевірте в Play Console, вони змінювались). Закласти тижні на це **до** першого production-релізу.
- **Експортне шифрування:** `ITSAppUsesNonExemptEncryption: false` вже стоїть; перевірте, що воно відповідає дійсності для AES-GCM у застосунку (шифрування застосовується лише для власних даних; рішення за вами/юристом).

### Етап 5. Операційна готовність

- **Crash/error моніторинг:** Sentry (`@sentry/react-native`) інтегрований із sourcemaps; налаштуйте release environment та перевірте на staging пристроях, як описано на початку документа.
- Phased release в App Store (налаштовується в App Store Connect) і зупинка Play-розгортання при зростанні крашів.
- Календар: ротація ключів APNs/App Store Connect/сервісних акаунтів, щорічне оновлення сертифікатів, вимоги `targetSdk` Google (щорічно) і мінімальної версії Xcode/SDK Apple (щорічно). Оновлення Expo SDK планувати 2–3 рази на рік. Після оновлення `firebase-tools` перевірте текст помилки cleanup policy, на який спирається `deploy-backend.yml`.

## 3а. Стан (єдина таблиця)

| Що | Стан | Де |
|----|------|----|
| CI (lint, тести, правила в емуляторі, бандл, prebuild, functions) як reusable gate для всіх релізів; actions закріплені за SHA, `eas-cli` 24.8.0, `firebase-tools` 15.32.1 | зроблено | [ci-check.yml](.github/workflows/ci-check.yml) |
| Обійти gate не можна: ручний запуск `ota.yml`, `build-*.yml`, `deploy-backend.yml`, `promote.yml` спершу ганяє `ci-check.yml`. Усе production лише з `main` або тегу на коміті з `main` (`--release-ref`); `promote.yml` (Android) приймає лише production-збірку з коміту в `main` (`--on-main`) | зроблено | усі workflow, [scripts/release-check.mjs](scripts/release-check.mjs) |
| Run workflow → CI → verify (версія, `main`, `projectId`, `STORE_RELEASES`, секрети сторів, EAS `production`) → backend у production (схвалення) → Play internal (лише Android). Push і теги не запускають production | зроблено | [release.yml](.github/workflows/release.yml) |
| Push у `stage` → CI → backend у staging → Android preview → preview-OTA, усе автоматично (без порівняння EAS `preview` з GitHub `staging`); push у `main` – лише CI | зроблено | [preview.yml](.github/workflows/preview.yml) |
| Деплой правил і functions (Workload Identity, база на середовище, production-база = `firebase.json`, автоматична cleanup policy на першому деплої, без `--force`) | зроблено | [deploy-backend.yml](.github/workflows/deploy-backend.yml) |
| Збірки: перевірка EAS-змінних до старту (`--env`), ключі сторів перевіряються до хмарної збірки, `eas.json` до збірки не змінюється, відправка окремим кроком після збірки | зроблено | [build-android.yml](.github/workflows/build-android.yml), [build-ios.yml](.github/workflows/build-ios.yml), [app.config.ts](app.config.ts) |
| OTA через EAS Update; runtime = fingerprint (без `extra` і версії); перед і після публікації перевірка, що є збірка каналу з тим самим runtime (production: інакше падає) | зроблено | [ota.yml](.github/workflows/ota.yml), [fingerprint.config.js](fingerprint.config.js) |
| Promote: Play internal → production зі staged rollout без повторного завантаження (iOS не деплоїться) | зроблено | [promote.yml](.github/workflows/promote.yml), [scripts/play-promote.mjs](scripts/play-promote.mjs) |
| Відкат OTA (`eas update:rollback`) | вручну, за потреби | розділ «OTA-оновлення» |
| Листинг App Store 4 мовами (валідний за `eas metadata:lint`), вікова анкета, Review Notes | є, з `REPLACE_ME` для тестового акаунта | [store.config.json](store.config.json) |
| Посилання на умови й політику (реєстрація, профіль), застереження про заборонений контент | зроблено | [LegalLinks.tsx](src/components/LegalLinks.tsx) |
| Чернетки політики, умов, декларації даних, сторінки видалення акаунта | чернетки, треба опублікувати | [docs/store/](docs/store/) |
| Етап 0 (акаунти, ключі, змінні, перший AAB, сертифікат iOS) | **руками, ще не зроблено** | розділ 3, етап 0 |
| App Check (провайдер у застосунку, enforce у Firestore) | **ще не зроблено** | [SECURITY.md](SECURITY.md), «Захист від зловживань і модерація» |
| Sentry / crash-моніторинг | інтегровано; налаштування й device test перед релізом | розділ змін 2026-10-07 |
| Перевірка, що runtime, вбудований у першу production-збірку Android, збігається з тим, що обчислює `ota.yml` (`eas fingerprint:compare`) | **перевірити після першої збірки** | [ota.yml](.github/workflows/ota.yml) |

Знахідки `expo prebuild`: прибрано зайві дозволи Android (`READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`: застосунок не пише у спільне сховище; налагоджувальні збірки зберігають `SYSTEM_ALERT_WINDOW` у debug-маніфесті), додано `expo-system-ui` (інакше `userInterfaceStyle` на Android ігнорувався). iOS-проєкт на Windows не генерується; його перевіряє CI на Linux.

Поки `STORE_RELEASES` не `true`, ручний production-реліз зупиняється на verify з `::error::` і нічого не деплоїть і не збирає. `preview.yml` (гілка `stage`) автоматично деплоїть staging-бекенд, збирає APK та публікує OTA; без обов'язкової Firebase/Google конфігурації EAS `preview` викатка зупиняється з поясненням.

### Налаштування GitHub (Settings → Environments / Variables / Secrets)

| Environment | Reviewers | Deployment branches and tags | Variables |
|-------------|-----------|------------------------------|-----------|
| `staging` | не потрібні | без обмежень (preview можна зібрати з будь-якої гілки, після CI) | `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` (порожні: деплой у staging пропускається, а preview-збірки й preview-OTA відмовляються збиратися). `FIREBASE_PROJECT_ID` / `FIRESTORE_DATABASE_ID` мають збігатися з EAS `preview` |
| `production` | **так** (ручний backend-реліз, production-OTA) | **Selected branches and tags:** гілка `main` і тег `v*` | ті самі чотири змінні для бойового проєкту; `FIRESTORE_DATABASE_ID` = база з `firebase.json` (`ai-studio-df109a92-91f7-44f7-944f-c92e7aa387b8`), той самий `FIREBASE_FIRESTORE_DATABASE_ID`, що в EAS `production` |
| `store-release` | **так** (promote) | **Selected branches and tags:** гілка `main` і тег `v*` | (немає: юридичні посилання promote бере з EAS-середовища `production`; старі `PRIVACY_POLICY_URL` / `TERMS_URL` тут можна видалити) |

Обмеження гілок у середовищах дублює перевірку `release-check.mjs --release-ref` у самих workflow (та ще й відкидає тег, поставлений на коміт поза `main`). Дозвіл на тег `v*` потрібний лише для ручних запусків з існуючого release-тегу.

**Workload Identity Provider:** `GCP_WORKLOAD_IDENTITY_PROVIDER` у кожному GitHub Environment має містити resource name провайдера у форматі `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`. Пул `cheers-app` лежить у проєкті `cheers-511106` (номер `556814809418`), OIDC-провайдер для GitHub — `github` (умова `assertion.repository=='tepasha/cheers-'`), тож значення: `projects/556814809418/locations/global/workloadIdentityPools/cheers-app/providers/github`. Провайдер `cheers` у тому ж пулі — це AWS-провайдер, для GitHub він не підходить. Перевірити список провайдерів можна в Google Cloud → IAM & Admin → Workload Identity Federation → пул → Providers або виконайте в Google Cloud Shell:

```sh
gcloud iam workload-identity-pools providers list \
  --project=cheers-511106 \
  --location=global \
  --workload-identity-pool=cheers-app \
  --format="value(name)"
```

Оберіть провайдер для GitHub Actions і скопіюйте його повний `name` у GitHub → Settings → Environments → `staging` → Environment variables → `GCP_WORKLOAD_IDENTITY_PROVIDER` (аналогічно для `production`, якщо вона також налаштована неправильно). `principal://…/subject/…` і `principalSet://…` — IAM members для надання прав, а не значення цієї змінної. Для input `workload_identity_provider` не додавайте префікс `//iam.googleapis.com/`: action формує STS audience самостійно. [Формат input у google-github-actions/auth](https://github.com/google-github-actions/auth/tree/v2#inputs-workload-identity-federation). `GCP_SERVICE_ACCOUNT` містить email сервісного акаунта, який використовує деплой.

**Увага, `FIRESTORE_DATABASE_ID`:** зараз змінна називає базу `cheers_db`, якої не існує. Задайте в `production` id бази з `firebase.json` (і id staging-бази в `staging`). Доки значення не збігається з `firebase.json`, `deploy-backend.yml` у production зупиняється з `::error::`, а production-OTA – на порівнянні з EAS `production`. Якщо `FIRESTORE_DATABASE_ID` (чи `FIREBASE_PROJECT_ID`) задано як змінну **репозиторію**, вона діє в кожному середовищі, де її не перевизначено: тримайте ці дві змінні лише в середовищах.

**Рівень репозиторію** (Settings → Secrets and variables → Actions). Секрети сторів мають бути саме секретами **репозиторію**, не середовища: job-и збірок і verify-job працюють без Environment і секретів середовища не бачать.

- Variables: `STORE_RELEASES` (`true` після етапу 0).
- Secrets: `EXPO_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_BASE64`, опційно `EXPO_ACCESS_TOKEN` (лише з Expo «enhanced push security»).

**Не перевірено, бо потребує ваших акаунтів:** реальний запуск workflow (перевірено синтаксис YAML, звʼязки `needs`, `bash -n` скриптів і локальні скрипти), `eas build/submit/update`, Workload Identity, Play Developer API, `eas metadata:push`.

## 4. Інвентар секретів

| Де | Що |
|----|----|
| GitHub Secrets (репозиторій) | `EXPO_TOKEN`, `APP_STORE_CONNECT_API_KEY_BASE64`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `GOOGLE_SERVICE_ACCOUNT_BASE64`, (опційно) `EXPO_ACCESS_TOKEN` |
| GitHub Variables (репозиторій) | `STORE_RELEASES`, `ASC_APP_ID`, `APPLE_TEAM_ID` |
| GitHub Environments `staging`, `production` | `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` (Workload Identity: довгоживучого ключа Google у GitHub немає) |
| EAS env (preview/production; Plain text або Sensitive, не Secret) | `FIREBASE_*` (з `FIREBASE_FIRESTORE_DATABASE_ID`), `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_MAPS_API_KEY`, `ADMOB_ANDROID_APP_ID`, `ADMOB_IOS_APP_ID`, `PRIVACY_POLICY_URL`, `TERMS_URL`, файл `GOOGLE_SERVICES_JSON`; лише в production: `ADMOB_{ANDROID,IOS}_{BANNER,INLINE}_ID` |
| EAS credentials | keystore Android, сертифікат дистрибуції й профілі iOS, ключ APNs, FCM V1 |
| Firebase functions env (`functions/.env.<project-id>`, не в git; у CI генерується) | `FIRESTORE_DATABASE_ID` (обовʼязковий param), `EXPO_ACCESS_TOKEN` (опційно, читається з оточення) |

## 5. Ризики й чесні обмеження

- **Рев'ю Apple/Google не автоматизується**: час очікування й можливі відмови поза вашим контролем. Закладайте запас у кілька днів на перший реліз.
- **Перший Android-реліз і закритий тест** визначають календар більше, ніж код.
- **Збірки на `ubuntu-latest` не потребують macOS:** iOS будується в хмарі EAS. Ліміти безкоштовного плану EAS (черга, число збірок) варто звірити з очікуваною частотою релізів.
- **Правила, що змінюють формат чи умови доступу**, можуть відмовляти старим клієнтам. Нові onboarding claims і квоти — така зміна. Для вже публічної версії потрібні staging-перевірка, період сумісності або погоджений перехід, а не припущення про автоматичну сумісність.
- **Production-збірки не порівнюють** Firebase-проєкт EAS `production` з GitHub `production` (це додало б друге схвалення кожному ручному релізу); це робить production-OTA, а `--env` і `app.config.ts` вимагають самих значень.
- **iOS promote** не може перевірити, яку збірку відправлять на рев'ю: її обирають руками в App Store Connect.

## 6. Оцінка (що лишилось)

| Етап | Робота | Залежить від |
|------|--------|--------------|
| 0 | 1–2 дні (акаунти, ключі, змінні) | оплата акаунтів, верифікація Apple (бувають дні) |
| 4 | 2–5 днів (матеріали) + очікування рев'ю | політика, скріншоти, тестовий акаунт |
| 5 | ~0,5–1 день | — |
