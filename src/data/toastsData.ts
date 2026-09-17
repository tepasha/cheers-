export interface ToastItem {
  id: string;
  text: string;
  category: 'patriotic' | 'it_dev' | 'classic' | 'humor' | 'wine_love' | 'adventure' | 'craft_beer';
  categoryLabel: string;
  emoji: string;
  tags: string[];
}

export interface ToastCategoryMeta {
  id: ToastItem['category'] | 'all';
  label: string;
  emoji: string;
}

export const TOAST_CATEGORIES: ToastCategoryMeta[] = [
  { id: 'all', label: 'Всі тости', emoji: '🍻' },
  { id: 'patriotic', label: 'За Перемогу & ЗСУ', emoji: '🇺🇦' },
  { id: 'it_dev', label: 'IT, Код & Стартапи', emoji: '💻' },
  { id: 'classic', label: 'Класичні & Компанія', emoji: '🍺' },
  { id: 'humor', label: 'З гумором', emoji: '😂' },
  { id: 'wine_love', label: 'Вино & Душевні', emoji: '🍷' },
  { id: 'adventure', label: 'Мандри & Пригоди', emoji: '🧭' },
  { id: 'craft_beer', label: 'Крафт & Хміль', emoji: '🌾' },
];

export const ALL_TOASTS: ToastItem[] = [
  // 🇺🇦 Патріотичні & За Перемогу
  {
    id: 't-pat-1',
    text: 'За мирне небо, вільну Україну та якнайшвидшу Перемогу! 🇺🇦',
    category: 'patriotic',
    categoryLabel: 'За Перемогу',
    emoji: '🇺🇦',
    tags: ['україна', 'перемога', 'мир', 'зсу']
  },
  {
    id: 't-pat-2',
    text: 'За Збройні Сили України — хлопцям і дівчатам низький уклін і міцне здоровʼя! 🛡️',
    category: 'patriotic',
    categoryLabel: 'За ЗСУ',
    emoji: '🛡️',
    tags: ['зсу', 'захисники', 'подяка']
  },
  {
    id: 't-pat-3',
    text: 'Щоб вороги згинули, як роса на сонці, а в нас завжди було що налити в келих! ☀️',
    category: 'patriotic',
    categoryLabel: 'За Перемогу',
    emoji: '☀️',
    tags: ['ворогам кришка', 'роса на сонці', 'будьмо']
  },
  {
    id: 't-pat-4',
    text: 'За повернення всіх наших людей додому та святковий переможний тост на вільному Хрещатику! 🕊️',
    category: 'patriotic',
    categoryLabel: 'За Перемогу',
    emoji: '🕊️',
    tags: ['дім', 'хрещатик', 'мир']
  },
  {
    id: 't-pat-5',
    text: 'За українську незламність, щедрість душі та рідну землю — Будьмо! Гей! 🌾🇺🇦',
    category: 'patriotic',
    categoryLabel: 'За Перемогу',
    emoji: '🌾',
    tags: ['незламність', 'будьмо', 'традиція']
  },

  // 💻 IT & Розробка
  {
    id: 't-it-1',
    text: 'За чистий код без багів і деплой у пʼятницю вечором без викликів на онкол! 💻✨',
    category: 'it_dev',
    categoryLabel: 'IT & Код',
    emoji: '💻',
    tags: ['код', 'деплой', 'баги', 'пʼятниця']
  },
  {
    id: 't-it-2',
    text: 'Щоб продакшн лежав лише на пляжі під пальмами, а не від несподіваного напливу трафіку! 🏖️🚀',
    category: 'it_dev',
    categoryLabel: 'IT & Код',
    emoji: '🏖️',
    tags: ['прод', 'відпочинок', 'сервери']
  },
  {
    id: 't-it-3',
    text: 'За зелені пайплайни в CI/CD, 100% test coverage та швидкі апруви в pull request! 🟢',
    category: 'it_dev',
    categoryLabel: 'IT & Код',
    emoji: '🟢',
    tags: ['ci/cd', 'пайплайн', 'pr', 'тести']
  },
  {
    id: 't-it-4',
    text: 'Нехай сервери гудуть спокійно, Docker контейнери не крешаться, а памʼять ніколи не тече! 🐳',
    category: 'it_dev',
    categoryLabel: 'IT & Код',
    emoji: '🐳',
    tags: ['docker', 'сервер', 'памʼять']
  },
  {
    id: 't-it-5',
    text: 'Щоб замовник приймав фічі з першого разу, а правки були лише у стилі "додайте більше золота"! 💰',
    category: 'it_dev',
    categoryLabel: 'IT & Код',
    emoji: '💰',
    tags: ['клієнт', 'правки', 'фічі']
  },
  {
    id: 't-it-6',
    text: 'За тих, хто ночами рефакторить, а вдень тестує — нехай кава та крафтове пиво не вичерпуються! ☕🍺',
    category: 'it_dev',
    categoryLabel: 'IT & Код',
    emoji: '☕',
    tags: ['рефакторинг', 'кава', 'ніч']
  },
  {
    id: 't-it-7',
    text: 'Щоб AI генерував без галюцинацій, а API сторонніх сервісів ніколи не віддавали 500 error! 🤖⚡',
    category: 'it_dev',
    categoryLabel: 'IT & Код',
    emoji: '🤖',
    tags: ['ai', 'api', 'помилки']
  },

  // 🍻 Класичні & За компанію
  {
    id: 't-cls-1',
    text: 'Будьмо! — Гей! — Будьмо! — Гей! — Будьмо, будьмо, будьмо! — Гей, гей, гей! 🍻',
    category: 'classic',
    categoryLabel: 'Класичні',
    emoji: '🍻',
    tags: ['будьмо', 'гей', 'традиція']
  },
  {
    id: 't-cls-2',
    text: 'За щиру душевну бесіду, взаємну повагу та нові приємні знайомства! 🤝',
    category: 'classic',
    categoryLabel: 'Класичні',
    emoji: '🤝',
    tags: ['знайомство', 'друзі', 'бесіда']
  },
  {
    id: 't-cls-3',
    text: 'Нехай келих буде повним, стіл — щедрим, а люди поруч — відкритими та надійними! 🥨',
    category: 'classic',
    categoryLabel: 'Класичні',
    emoji: '🥨',
    tags: ['стіл', 'келих', 'надійність']
  },
  {
    id: 't-cls-4',
    text: 'Дзинь! До дна за те, щоб такі теплі й затишні вечори траплялися якнайчастіше! 💥',
    category: 'classic',
    categoryLabel: 'Класичні',
    emoji: '💥',
    tags: ['дзинь', 'до дна', 'вечір']
  },
  {
    id: 't-cls-5',
    text: 'За приємні зустрічі, які починаються з випадкового дзвінка бокалів і стають міцною дружбою! 🌟',
    category: 'classic',
    categoryLabel: 'Класичні',
    emoji: '🌟',
    tags: ['дружба', 'зустріч', 'радар']
  },
  {
    id: 't-cls-6',
    text: 'Між першою і другою — перерва невеличка! Наливай, щоб не сумувати! ⏳',
    category: 'classic',
    categoryLabel: 'Класичні',
    emoji: '⏳',
    tags: ['перерва', 'друга чарка']
  },
  {
    id: 't-cls-7',
    text: 'За господарів цього закладу, ввічливих барменів та щедрі порції! 🍸',
    category: 'classic',
    categoryLabel: 'Класичні',
    emoji: '🍸',
    tags: ['бармен', 'заклад', 'подяка']
  },

  // 😂 З гумором & Життєві
  {
    id: 't-hum-1',
    text: 'Пийте, люди, пиво з піною — буде морда соловʼїною! 🐦🍻',
    category: 'humor',
    categoryLabel: 'З гумором',
    emoji: '🐦',
    tags: ['соловʼїна', 'піна', 'жарт']
  },
  {
    id: 't-hum-2',
    text: 'Краще пузо від пива, ніж горб від роботи! За заслужений вечірній релакс! 🛋️',
    category: 'humor',
    categoryLabel: 'З гумором',
    emoji: '🛋️',
    tags: ['робота', 'релакс', 'гумор']
  },
  {
    id: 't-hum-3',
    text: 'За те, щоб ранком боліло від щирого реготу, а не від похмілля! Свіжої голови всім! 😄💧',
    category: 'humor',
    categoryLabel: 'З гумором',
    emoji: '😄',
    tags: ['ранок', 'сміх', 'похмілля']
  },
  {
    id: 't-hum-4',
    text: 'Щоб у нас все було, і нам за це нічого не було! За легкість буття! 🎯',
    category: 'humor',
    categoryLabel: 'З гумором',
    emoji: '🎯',
    tags: ['все було', 'везіння']
  },
  {
    id: 't-hum-5',
    text: 'Пʼємо за те, щоб наші реальні можливості офігівали від наших грандіозних бажань! 🚀',
    category: 'humor',
    categoryLabel: 'З гумором',
    emoji: '🚀',
    tags: ['бажання', 'мрії', 'можливості']
  },
  {
    id: 't-hum-6',
    text: 'За здоровий глузд, який так рідко, але так доречно залишає нас у пʼятницю ввечері! 🧠🎉',
    category: 'humor',
    categoryLabel: 'З гумором',
    emoji: '🧠',
    tags: ['глузд', 'пʼятниця', 'відрив']
  },
  {
    id: 't-hum-7',
    text: 'Якщо не можна, але дуже хочеться — то за це обовʼязково треба підняти келих! 🤫',
    category: 'humor',
    categoryLabel: 'З гумором',
    emoji: '🤫',
    tags: ['хочеться', 'спокуса']
  },

  // 🍷 Вино & Душевні
  {
    id: 't-win-1',
    text: 'In vino veritas — за щирість, теплий погляд і оксамитовий післясмак гарної бесіди! 🍷✨',
    category: 'wine_love',
    categoryLabel: 'Вино & Душа',
    emoji: '🍷',
    tags: ['вино', 'щирість', 'істина']
  },
  {
    id: 't-win-2',
    text: 'За моменти, які не купиш за гроші: захід сонця, тиха музика та правильна людина навпроти! 🕯️',
    category: 'wine_love',
    categoryLabel: 'Вино & Душа',
    emoji: '🕯️',
    tags: ['моменти', 'романтика', 'музика']
  },
  {
    id: 't-win-3',
    text: 'Нехай життя іскриться бульбашками, як найкраще сухе ігристе, і зігріває любовʼю! 🥂',
    category: 'wine_love',
    categoryLabel: 'Вино & Душа',
    emoji: '🥂',
    tags: ['ігристе', 'просекко', 'радість']
  },
  {
    id: 't-win-4',
    text: 'За тих, хто нас надихає, хто вірить у нас більше, ніж ми самі, і з ким приємно помовчати! ❤️',
    category: 'wine_love',
    categoryLabel: 'Вино & Душа',
    emoji: '❤️',
    tags: ['любов', 'підтримка', 'натхнення']
  },
  {
    id: 't-win-5',
    text: 'За внутрішній спокій, гармонію в серці та вміння насолоджуватися смаком кожної краплі! 🍇',
    category: 'wine_love',
    categoryLabel: 'Вино & Душа',
    emoji: '🍇',
    tags: ['гармонія', 'смак', 'гедонізм']
  },

  // 🧭 Мандри & Пригоди
  {
    id: 't-adv-1',
    text: 'За нові горизонти, далекі дороги і щоб у кожному місті світу нас чекав гостинний бар! 🗺️',
    category: 'adventure',
    categoryLabel: 'Пригоди',
    emoji: '🗺️',
    tags: ['подорожі', 'світ', 'дорога']
  },
  {
    id: 't-adv-2',
    text: 'Щоб внутрішній компас завжди вказував туди, де сміх, жива музика і дзвін келихів! 🧭',
    category: 'adventure',
    categoryLabel: 'Пригоди',
    emoji: '🧭',
    tags: ['компас', 'музика', 'веселощі']
  },
  {
    id: 't-adv-3',
    text: 'За наші Карпати, Чорне море, київські схили та неповторні спогади з мандрівок! 🏔️',
    category: 'adventure',
    categoryLabel: 'Пригоди',
    emoji: '🏔️',
    tags: ['карпати', 'київ', 'гори']
  },
  {
    id: 't-adv-4',
    text: 'За спонтанні рішення під келих, які перетворюються на найяскравіші історії в житті! 🎒⚡',
    category: 'adventure',
    categoryLabel: 'Пригоди',
    emoji: '🎒',
    tags: ['спонтанність', 'історії', 'драйв']
  },

  // 🌾 Крафт & Хміль
  {
    id: 't-crf-1',
    text: 'За правильний IBU, густу стійку пінну шапку та ідеальний баланс хмелю і солоду! 🌾🍺',
    category: 'craft_beer',
    categoryLabel: 'Крафт & Хміль',
    emoji: '🌾',
    tags: ['хміль', 'крафт', 'ibu', 'піна']
  },
  {
    id: 't-crf-2',
    text: 'Щоб кожна варка була шедевром, а соковита DIPA піднімала настрій до небес! 🍺🍍',
    category: 'craft_beer',
    categoryLabel: 'Крафт & Хміль',
    emoji: '🍍',
    tags: ['dipa', 'варка', 'настрій']
  },
  {
    id: 't-crf-3',
    text: 'За пивоварів-ентузіастів, які перетворюють воду, солод та хміль на чисту магію! ✨🍻',
    category: 'craft_beer',
    categoryLabel: 'Крафт & Хміль',
    emoji: '✨',
    tags: ['пивовари', 'магія', 'крафт']
  },
  {
    id: 't-crf-4',
    text: 'Нехай життя буде таким же насиченим, як витриманий імперський стаут! 🍫☕',
    category: 'craft_beer',
    categoryLabel: 'Крафт & Хміль',
    emoji: '🍫',
    tags: ['стаут', 'насиченість', 'шоколад']
  }
];

// Flat list for simple compatibility with existing views
export const TOASTS_PRESETS = ALL_TOASTS.map((t) => t.text);

/**
 * Returns a random toast from the collection, optionally filtered by category
 */
export function getRandomToast(category?: ToastItem['category'] | 'all'): ToastItem {
  const pool = category && category !== 'all' 
    ? ALL_TOASTS.filter((t) => t.category === category)
    : ALL_TOASTS;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex] || ALL_TOASTS[0];
}
