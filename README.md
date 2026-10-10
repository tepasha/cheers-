# **Будьмо!** (Budmo) — Мобільний додаток для пошуку компанії та організацій зустрічей

**Будьмо!** (`cheers.tepasha.dev`, репозиторій `cheers-`) — це мобільний застосунок, створений для швидкого та зручного пошуку компанії за спільними інтересами чи приводом (наприклад, відпочинок, розваги, зустрічі з друзями або нові знайомства).

Підготовка першого публічного релізу: [DEPLOY.md](DEPLOY.md), [модель безпеки](SECURITY.md) і [перевірка залежностей](docs/dependency-audit.md). Перед build/OTA потрібні реальні legal URL, `SUPPORT_EMAIL`, Sentry env та reviewer реквізити; для iOS — перевірена `EXPORT_ENCRYPTION_CLASSIFICATION`. Кодові перевірки не замінюють staging deployment, нативну збірку й перевірки на пристроях.

---

### 📌 Основний функціонал та можливості

* **Створення та пошук івентів/зустрічей:** можливість створювати локальні оголошення або шукати вже існуючі події поблизу.
* **Інтерактивна карта / Геолокація:** пошук людей та подій поруч із використанням геоданих у реальному часі.
* **Профілі користувачів:** налаштування особистого профілю (аватар, інтереси, коротка інформація про себе).
* **Система сповіщень та чат:** взаємодія між користувачами для узгодження деталей зустрічі.

---

### 🛠 Технологічний стек (Tech Stack)

* **Фреймворк:** React Native 0.86 + Expo SDK 57 *(iOS та Android з однієї кодової бази)*.
* **Мова:** TypeScript (`strict`).
* **Навігація:** React Navigation 7 (нижні таби + native stack).
* **Стан:** Redux Toolkit + `redux-persist`: кожен слайс зберігається окремим зашифрованим записом в AsyncStorage, ключ шифрування лежить у сховищі ключів ОС (`expo-secure-store`, [src/store/keystore.ts](src/store/keystore.ts)); у веб-перегляді без шифрування. Побічні ефекти — у thunks, логіка — у чистих функціях.
* **Бекенд:** Firebase JS SDK: Auth (email + підтвердження) та Firestore із закритими правилами (`firestore.rules`), що перевіряються тестами на емуляторі.
* **Карти та геолокація:** `react-native-maps`, `expo-location`.
* **Шифрування повідомлень:** AES-GCM через `@noble/ciphers` (Hermes не має `crypto.subtle`).
* **Стилізація:** `StyleSheet` + спільна тема (`src/theme`).
* **Тести:** Vitest для чистої логіки (слайси, селектори, гео, i18n, шифрування).

---

### 📂 Структура проєкту

```text
├── App.tsx              # Провайдери (Redux, persist, навігація) і життєвий цикл застосунку
├── index.ts             # Точка входу
├── app.json / eas.json  # Конфігурація Expo та EAS Build/Submit
├── assets/              # Іконка, splash, adaptive icon
├── functions/           # Cloud Functions (окремий пакет): push про нові повідомлення, deleteMyAccount, очищення
├── tests/               # Усі тести: unit/ (дзеркало src/ і functions/) і rules/ (емулятор Firestore)
└── src/
    ├── screens/         # Екрани (Discover, Map, Hangouts, Friends, Chats, ChatRoom, Profile…)
    ├── components/      # UI-кіт (ui.tsx), shell, листи-модалки, картки
    ├── navigation/      # Root stack + tabs, типи маршрутів, deep-link зі сповіщень
    ├── store/
    │   ├── slices/      # Редʼюсери (auth, chats, friends, hangouts, meetups, safety, …)
    │   ├── thunks/      # Дії з побічними ефектами (Firestore, хаптика, сповіщення)
    │   └── selectors.ts # Похідні дані (відстані, блокування, лічильники)
    ├── logic/           # Чисті правила: гейміфікація, мітапи, сесія, фільтри, дати
    ├── services/        # Firebase, Firestore sync, шифрування, гео, локація, i18n, аналітика
    ├── hooks/           # useAppLifecycle (сесія, мережа, GPS, push), useCloudSync (Firestore-потоки, присутність, профіль), useChatSync…
    ├── data/            # Заклади, тости, довідники
    └── theme/           # Кольори, відступи, типографіка
```

---

### 🚀 Запуск та розгортання проєкту

#### Передумови:
* Установлений **Node.js** 22+
* Установлений **npm** або **yarn**
* Застосунок **Expo Go** на смартфоні (для швидкого тестування) або налаштовані емулятори (Android Studio / Xcode)

#### Кроки для локального запуску:

1. **Клонувати репозиторій:**
   ```bash
   git clone https://github.com/tepasha/cheers-.git
   cd cheers-
   ```

2. **Встановити залежності:**
   ```bash
   npm install
   # або
   yarn install
   ```

3. **Запустити проект через Expo:**
   ```bash
   npx expo start
   # або
   npm start
   ```

4. **Відкрити на пристрої:**
   * Відскануйте QR-код з терміналу за допомогою додатка **Expo Go** (на Android) або стандартної камери (на iOS).
   * Натисніть `a` для запуску в Android-емуляторі або `i` для iOS-симулятора.

#### Вхід через Google

Кнопка «Увійти через Google» на екрані входу. Хто входить уперше, отримує акаунт автоматично (Firebase створює його сам). Google-вхід запитує дозвіл `https://www.googleapis.com/auth/user.birthday.read`, а People API повертає дату для попереднього заповнення. Якщо дата відсутня, без року, дозвіл не надано або API недоступний, користувач обирає її вручну календарним пікером. Збережена дата акаунта має пріоритет; прийняття правил і серверна перевірка віку залишаються обов’язковими. **Застосунок для віку від 21 року** (одна стала `MIN_AGE` у `src/logic/session.ts`, діє однаково для e-mail і Google): якщо дата вказує на вік менший, акаунт видаляється разом із даними, а екран входу показує «Ще трохи треба почекати, вік користування застосунком 21». Акаунти, у яких уже збережена дата до 21 року, відхиляються при вході так само.

Що треба налаштувати (код цього зробити не може):

1. **Firebase Console → Authentication → Sign-in method → Google: увімкнути.**
2. `GOOGLE_WEB_CLIENT_ID` у `.env` та EAS: Web OAuth client проєкту (береться з тієї ж консолі; підходить і `FIREBASE_OAUTH_CLIENT_ID`, якщо він уже є).
3. **iOS:** створіть iOS OAuth client для `com.budmo.app` у Google Cloud (Credentials) і запишіть його в `GOOGLE_IOS_CLIENT_ID`: плагін додасть у застосунок потрібну URL-схему.
4. **Android:** у Firebase Console додайте SHA-1 (і SHA-256) ключів підпису (debug, EAS, Google Play App Signing) до Android-застосунку `com.budmo.app`; це створює Android OAuth client. Окремої змінної не треба.
5. Нативний модуль: вхід через Google **не працює в Expo Go**, лише в development / preview / production збірці. У веб-перегляді працює вікно Google від Firebase (потрібен дозвіл домену в Authentication → Settings → Authorized domains).
6. У Google Cloud-проєкті OAuth-клієнтів увімкніть **People API** та додайте `https://www.googleapis.com/auth/user.birthday.read` у **Google Auth Platform → Data Access**. Для зовнішнього застосунку перевірте вимоги OAuth verification; у режимі Testing додайте тестових користувачів. Запит People API обмежений п’ятьма секундами; помилка читання дати не скасовує вже виконаний вхід. OAuth access token не зберігається в Redux чи Firestore.
7. Після додавання `@react-native-community/datetimepicker` потрібна нова нативна збірка. У вебверсії використовується HTML `input type="date"`, нативний модуль у веббандл не потрапляє.

**Не перевірено на пристрої:** сам обмін з Google (потрібні ваші client id та збірка). Перевірено тестами: обмін токена на сесію Firebase, скасування діалогу, помилки, перевірка віку з межею в день 21-річчя, видалення акаунта молодшого за 21.

#### Вхід через Apple (iOS)

App Store вимагає Sign in with Apple поряд із входом через Google (Guideline 4.8), тож на iOS 13+ під кнопкою Google є офіційна кнопка Apple. Працює так само, як Google: новий акаунт створюється автоматично, далі застосунок питає дату народження й застосовує поріг 21 рік. Видалення акаунта Apple підтверджується входом через Apple і відкликає токени Apple, як вимагає Apple.

Що треба налаштувати (код цього зробити не може):

1. **Apple Developer → Identifiers → `com.budmo.app`: увімкнути capability «Sign In with Apple».** EAS Build додасть entitlement сам (`ios.usesAppleSignIn` у `app.json`).
2. **Firebase Console → Authentication → Sign-in method → Apple: увімкнути.** Для входу з нативного iOS-застосунку Services ID і ключ не потрібні (лише для вебу та Android, яких тут немає).
3. Перевіряється лише на справжньому iOS-пристрої або симуляторі зі збіркою (не Expo Go).

**Не перевірено на пристрої:** сам діалог Apple. Перевірено тестами: шлях акаунта Apple у застосунку (дата народження, поріг), видалення з повторним входом через Apple.

#### Веб-перегляд (`npm run web`)

Застосунок мобільний, але в браузері (Expo web, вікно перегляду AI Studio) він теж відкривається. Відмінності: замість `react-native-maps` (потрібні нативні SDK) показується список точок ([src/components/map/index.web.tsx](src/components/map/index.web.tsx)); сховище стану не шифрується (немає OS-ключосховища); push недоступні. Без Firebase-змінних застосунок стартує в демо-режимі: екран входу пояснює, що саме не налаштовано, і жодних запитів до Firebase не робить. Щоб побачити решту екранів, потрібні змінні з `.env.example` і підтверджений акаунт.

#### Перевірки:

```bash
npm run lint        # ESLint (react-hooks) + tsc --noEmit, включно з тестами
npm test            # tests/unit: логіка, стор, шифрування, локалізація
npm run test:rules  # правила + справжній клієнт на Firestore emulator (Java 21+)
```

Усі тести лежать у теці `tests/`: `tests/unit/` віддзеркалює структуру `src/`, `tests/rules/` — тести з емулятором. Код застосунку в тестах імпортується через псевдонім `@/…` (= `src/…`).

#### Локалізація (uk · en · pl · de)

Український текст пишеться прямо в коді й служить ключем: `tr('Скарга на {name}', { name })` у компонентах (`useTr()`), `tr(...)` з `trFor(getState)` у thunks, `ph('…')` для даних, що перекладаються при виведенні. Переклади лежать у `src/i18n/phrases/{en,pl,de}.ts`.

`npm test` перевіряє через AST, що жодного українського рядка інтерфейсу не лишилось поза `tr()`/`ph()`, що кожна фраза має переклад усіма мовами й однакові `{плейсхолдери}`. Навмисні винятки позначаються коментарем `i18n-ignore`. Контент (тости, описи закладів, назви районів Києва) лишається українською.

Модель безпеки, розгортання правил і відомі обмеження: [SECURITY.md](SECURITY.md).

#### Ключі та змінні оточення

У репозиторії ключів немає. Скопіюйте `.env.example` у `.env` (він у `.gitignore`) і заповніть: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_FIRESTORE_DATABASE_ID`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `PRIVACY_POLICY_URL`, `TERMS_URL`, `GOOGLE_SERVICES_JSON`, `ADMOB_*` (реклама, див. [DEPLOY.md](DEPLOY.md#реклама-google-admob)). [app.config.ts](app.config.ts) читає їх і кладе Firebase-конфіг в `extra.firebase`, а ключ карт в `android.config.googleMaps`. Без Firebase-змінних (або без `FIREBASE_FIRESTORE_DATABASE_ID`: мовчазного переходу на базу `(default)` більше немає) застосунок стартує в демо-режимі й пояснює, чого бракує; кнопка Google зʼявляється лише тоді, коли задано потрібні для платформи client id. Після зміни `.env` перезапустіть `npx expo start -c`.

**EAS-збірки в хмарі не бачать `.env`** (він не в git): створіть ті самі змінні через `npx eas-cli env:create` (для `preview` і `production`) з видимістю **Plain text** або **Sensitive**, не **Secret**: `eas update` і `eas env:exec` Secret-змінних не бачать, тож OTA-оновлення пішло б без них. Для preview- і production-збірок обовʼязкові всі змінні вище: CI перевіряє їх до старту збірки й перед кожним OTA (`eas env:exec <env> 'node scripts/release-check.mjs --env'`), а `app.config.ts` на EAS-воркері зупиняє збірку, якщо чогось бракує (зокрема файлу `GOOGLE_SERVICES_JSON`). Ці ключі не є секретами в криптографічному сенсі: вони потрапляють у кожну збірку. Захист їх: правила Firestore, App Check (ще не підключений, див. [SECURITY.md](SECURITY.md)) і обмеження ключів у Google Cloud. Firebase-ключ (`FIREBASE_API_KEY`) обмежуйте **лише за API** (Identity Toolkit, Token Service, Cloud Firestore), а не за Android/iOS-застосунком: Firebase JS SDK не надсилає заголовків пакета й SHA-1, тож таке обмеження відмовить у вході всім. За пакетом `com.budmo.app` і SHA-1 обмежується лише ключ карт (`GOOGLE_MAPS_API_KEY`), його нативний Maps SDK ці заголовки надсилає.

#### Збірки для сторів (EAS)

Проєкт уже привʼязаний до EAS (`extra.eas.projectId` в `app.json`; `npx eas-cli init` потрібен лише для форку). Локальна збірка:

```bash
npx eas-cli build --platform android --profile preview
```

Як іде реліз (докладно, з усіма одноразовими налаштуваннями: [DEPLOY.md](DEPLOY.md)):

* **push у `stage`** ([preview.yml](.github/workflows/preview.yml)): CI → правила й functions у **staging**-проєкт → Android preview APK → OTA у канал `preview`, усе автоматично й лише в тестовому оточенні. Посилання на встановлення є в підсумку Android job. Push у `main` запускає тільки CI. [Як почати тестування](docs/expo-testing.md).
* **кнопка Run workflow → Production release (manual)** ([release.yml](.github/workflows/release.yml)): CI → перевірка версій, коміту в `main`, `STORE_RELEASES=true`, ключів сторів і EAS `production` → **production-бекенд** (після схвалення Environment `production`) → Android у Play internal, iOS у TestFlight. Push і створення тегу не запускають production-реліз.
* **promote** ([promote.yml](.github/workflows/promote.yml), вручну, схвалення `store-release`): Android з internal у production зі staged rollout, iOS: листинг; бекенд не змінює.
* **OTA у production** ([ota.yml](.github/workflows/ota.yml), вручну): лише JS і ресурси. Runtime version = нативний fingerprint, тож оновлення доходить тільки до збірок з тим самим нативним кодом; без такої production-збірки для кожної платформи workflow не публікує.
* Усе, що веде в production, запускається лише кнопкою Run workflow з `main` або тегу на коміті з `main` і лише після повного CI. Спільна перевірка відхиляє автоматичні події навіть у reusable workflow.

Профіль `development` збирає development client (`expo-dev-client`): встановіть збірку один раз, а JS вантажте з `npx expo start --dev-client`. Так перевіряються вхід через Google і push без нової збірки на кожну зміну. Він бере змінні EAS-середовища `development` (обовʼязкові лише для preview/production).

Кожна iOS-збірка в CI (`build-ios.yml`) потребує ключа App Store Connect API: секрети `APP_STORE_CONNECT_API_KEY_BASE64`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID` і **змінна репозиторію** (Settings → Secrets and variables → Actions → Variables) `APPLE_TEAM_ID`; без будь-якого з них job зупиняється до старту хмарної збірки. Для відправки в TestFlight потрібна ще змінна `ASC_APP_ID` (числовий Apple ID застосунку з App Store Connect); без неї production-збірка створюється, але в TestFlight не відправляється. У `eas.json` цих значень немає навмисно: `eas.json` входить у fingerprint (runtime version), тож workflow дописує їх лише в окремому кроці `eas submit` після збірки, і OTA-оновлення з чистого checkout збігаються зі збіркою в сторі. Для ручного `eas submit` EAS запитає їх інтерактивно.

Android: tag-реліз відправляє production AAB у Play **internal** track (окремим кроком `eas submit` після збірки), для цього потрібен секрет `GOOGLE_SERVICE_ACCOUNT_BASE64` (без нього job зупиняється до старту хмарної збірки; preview-збірки в Play не йдуть ніколи). Далі [promote.yml](.github/workflows/promote.yml) з `build_id` цієї збірки переводить той самий versionCode з internal у production через Play Developer API ([scripts/play-promote.mjs](scripts/play-promote.mjs)), нічого не завантажуючи вдруге: `rollout` 0.1 → 0.5 → 1.

Workflow збірок нічого не публікує у GitHub Releases і не друкує повний результат `eas build`: він містить посилання на артефакти. У підсумку job лишаються лише id, статус і посилання на сторінку збірки в EAS.

#### Push-сповіщення про повідомлення

Коли застосунок закритий, нові повідомлення приходять пушем. Схема: телефон реєструє Expo push-токен у `devices/{id}` (Firestore) → Cloud Function [`functions/`](functions/src/index.ts) спрацьовує на кожне нове повідомлення чату й надсилає пуш через Expo Push Service → тап по пушу відкриває потрібний чат. Поки застосунок відкритий, ОС нічого не показує: працює банер усередині застосунку.

Там само живе **`deleteMyAccount`** — видалення акаунта для будь-якого способу входу (застосунок кличе її після повторного входу паролем або через Google; без цієї функції кнопка «Видалити акаунт» повертає помилку). Та сама тека `functions/` містить щогодинне очищення `cleanupExpiredContent`: столики живуть 4 години, зустрічі зникають через 24 години після початку, архів видаляється через 30 днів (див. [SECURITY.md](SECURITY.md)). Воно використовує Cloud Scheduler: API вмикається автоматично при першому деплої функцій (потрібен Blaze).

Що треба зробити один раз (нічого з цього код зробити не може):

1. `extra.eas.projectId` в `app.json` уже є (для форку: `npx eas-cli init`); без нього токен не видається, а перемикач «Системні сповіщення» покаже «недоступні».
2. **Android:** увімкніть Firebase Cloud Messaging API (V1), передайте `google-services.json` як файлову EAS-змінну `GOOGLE_SERVICES_JSON` і завантажте ключ сервісного акаунта FCM V1 в EAS (`npx eas-cli credentials -p android`). **iOS:** ключ APNs додайте через `npx eas-cli credentials -p ios` (CI збирає в `--non-interactive` і сам його не створить). Push не працює в Expo Go, лише у збірці (development / preview / production).
3. Cloud Functions потребують тарифу **Blaze**. Звичайно їх розгортає CI ([deploy-backend.yml](.github/workflows/deploy-backend.yml)); вручну так:
   ```bash
   cd functions && npm ci && cd ..
   # functions/.env.<project-id> (не комітиться: .gitignore містить .env*)
   echo 'FIRESTORE_DATABASE_ID=<id з "database" у firebase.json>' > functions/.env.<project-id>
   # необовʼязково, лише якщо в Expo-проєкті увімкнено «enhanced push security»:
   # echo 'EXPO_ACCESS_TOKEN=<токен>' >> functions/.env.<project-id>
   npx firebase-tools@15.32.1 deploy --only functions --project <project-id>
   ```
   `FIRESTORE_DATABASE_ID` обовʼязковий і не має значення за замовчуванням: без нього деплой зупиниться (у `--non-interactive`) або спитає id, а не привʼяже функції мовчки до бази `(default)`, де чатів немає (тоді пуші й очищення тихо не працюють). Значення має збігатися з `database` у `firebase.json` і `FIREBASE_FIRESTORE_DATABASE_ID` застосунку. `EXPO_ACCESS_TOKEN` функція читає з оточення, тож без нього деплой проходить. Перший деплой функцій у проєкт без `--non-interactive` спитає, скільки днів зберігати образи (Artifact Registry): відповідь 7 нормальна.
4. Правила з колекцією `devices` треба розгорнути разом (див. [SECURITY.md](SECURITY.md)).

Що бачить пуш: імʼя відправника (або назву групи) і загальний рядок на мові пристрою («Нове повідомлення»). **Текст повідомлення в пуш не потрапляє**, сервер його не розшифровує. Але Expo і Apple/Google бачать імʼя відправника та id чату.

Ключ Google Maps для Android береться зі змінної `GOOGLE_MAPS_API_KEY` (див. вище).
