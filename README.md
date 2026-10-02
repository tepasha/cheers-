# **CheersMobApp** — Мобільний додаток для пошуку компанії та організацій зустрічей

**CheersMobApp** — це мобільний застосунок, створений для швидкого та зручного пошуку компанії за спільними інтересами чи приводом (наприклад, відпочинок, розваги, зустрічі з друзями або нові знайомства).

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
* **Стан:** Redux Toolkit + `redux-persist` (AsyncStorage). Побічні ефекти — у thunks, логіка — у чистих функціях.
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
├── functions/           # Cloud Function: push-сповіщення про нові повідомлення (окремий пакет)
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
    ├── hooks/           # useAppLifecycle (сесія, мережа, Firestore-потоки, GPS), useChatSync…
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
   git clone https://github.com/tepasha/CheersMobApp.git
   cd CheersMobApp
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

#### Перевірки:

```bash
npm run lint        # ESLint (react-hooks) + tsc --noEmit, включно з тестами
npm test            # tests/unit: логіка, стор, шифрування, локалізація
npm run test:rules  # tests/rules: правила Firestore + контракт клієнта на емуляторі (Java 11+)
```

Усі тести лежать у теці `tests/`: `tests/unit/` віддзеркалює структуру `src/`, `tests/rules/` — тести з емулятором. Код застосунку в тестах імпортується через псевдонім `@/…` (= `src/…`).

#### Локалізація (uk · en · pl · de)

Український текст пишеться прямо в коді й служить ключем: `tr('Скарга на {name}', { name })` у компонентах (`useTr()`), `tr(...)` з `trFor(getState)` у thunks, `ph('…')` для даних, що перекладаються при виведенні. Переклади лежать у `src/i18n/phrases/{en,pl,de}.ts`.

`npm test` перевіряє через AST, що жодного українського рядка інтерфейсу не лишилось поза `tr()`/`ph()`, що кожна фраза має переклад усіма мовами й однакові `{плейсхолдери}`. Навмисні винятки позначаються коментарем `i18n-ignore`. Контент (тости, описи закладів, назви районів Києва) лишається українською.

Модель безпеки, розгортання правил і відомі обмеження: [SECURITY.md](SECURITY.md).

#### Ключі та змінні оточення

У репозиторії ключів немає. Скопіюйте `.env.example` у `.env` (він у `.gitignore`) і заповніть: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_FIRESTORE_DATABASE_ID`, `GOOGLE_MAPS_API_KEY`. [app.config.ts](app.config.ts) читає їх і кладе Firebase-конфіг в `extra.firebase`, а ключ карт в `android.config.googleMaps`. Без Firebase-змінних застосунок одразу падає з поясненням. Після зміни `.env` перезапустіть `npx expo start -c`.

**EAS-збірки в хмарі не бачать `.env`** (він не в git): створіть ті самі змінні через `npx eas-cli env:create` (для `preview` і `production`). Ці ключі не є секретами в криптографічному сенсі: вони потрапляють у кожну збірку. Захист їх: правила Firestore та обмеження ключа в Google Cloud (Firebase-ключ, ключ карт за пакетом `com.budmo.app` і SHA-1).

#### Збірки для сторів (EAS)

```bash
npx eas-cli init                        # один раз: створює projectId у app.json
npx eas-cli build --platform android --profile preview
```

Для відправки iOS-збірок у TestFlight workflow бере **змінні репозиторію** (Settings → Secrets and variables → Actions → Variables) `ASC_APP_ID` (числовий Apple ID застосунку з App Store Connect) та `APPLE_TEAM_ID`; без них збірка створюється, але в TestFlight не відправляється. У `eas.json` цих значень немає навмисно. Для ручного `eas submit` EAS запитає їх інтерактивно.

Workflow збірок нічого не публікує у GitHub Releases і не друкує повний результат `eas build`: він містить посилання на артефакти. У підсумку job лишаються лише id, статус і посилання на сторінку збірки в EAS.

#### Push-сповіщення про повідомлення

Коли застосунок закритий, нові повідомлення приходять пушем. Схема: телефон реєструє Expo push-токен у `devices/{id}` (Firestore) → Cloud Function [`functions/`](functions/src/index.ts) спрацьовує на кожне нове повідомлення чату й надсилає пуш через Expo Push Service → тап по пушу відкриває потрібний чат. Поки застосунок відкритий, ОС нічого не показує: працює банер усередині застосунку.

Що треба зробити один раз (нічого з цього код зробити не може):

1. `npx eas-cli init` — створює `extra.eas.projectId` в `app.json`; без нього токен не видається, а перемикач «Системні сповіщення» покаже «недоступні».
2. **Android:** створіть проєкт Firebase Cloud Messaging V1, додайте `google-services.json` до проєкту та завантажте ключ сервісного акаунта в EAS (`eas credentials`). **iOS:** EAS створить ключ APNs під час `eas build`. Push не працює в Expo Go, лише у збірці (development / preview / production).
3. Cloud Functions потребують тарифу **Blaze**. Розгортання:
   ```bash
   cd functions && npm ci && cd ..
   npx firebase-tools@15.32.1 deploy --only functions --project <project-id>
   ```
   Параметри функції (`firebase functions:params` / `.env`): `FIRESTORE_DATABASE_ID` — id іменованої бази (`FIREBASE_FIRESTORE_DATABASE_ID` з `.env`), `EXPO_ACCESS_TOKEN` — необовʼязково, якщо в Expo-проєкті увімкнено «enhanced push security».
4. Правила з колекцією `devices` треба розгорнути разом (див. [SECURITY.md](SECURITY.md)).

Що бачить пуш: імʼя відправника (або назву групи) і загальний рядок на мові пристрою («Нове повідомлення»). **Текст повідомлення в пуш не потрапляє**, сервер його не розшифровує. Але Expo і Apple/Google бачать імʼя відправника та id чату.

Ключ Google Maps для Android береться зі змінної `GOOGLE_MAPS_API_KEY` (див. вище).
