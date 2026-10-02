# Декларація даних для App Store та Google Play (чернетка)

Шпаргалка для форм **Apple App Privacy** та **Google Play Data safety**. Складена з коду станом на цей реліз; перед відправкою звірте з реальною поведінкою збірки й актуальною політикою. Відповіді в консолях юридично значущі.

Загальне: усі дані **повʼязані з користувачем**; **для відстеження (tracking) не використовуються**; рекламних SDK та аналітики сторонніх сервісів немає; дані шифруються під час передачі (HTTPS/TLS); користувач може видалити акаунт у застосунку.

| Категорія | Apple | Google Data safety | Мета | Обовʼязково? |
|-----------|-------|--------------------|------|--------------|
| Email | Contact Info → Email Address | Personal info → Email address | функціонал застосунку, автентифікація | так |
| Імʼя | Contact Info → Name | Personal info → Name | профіль | так |
| Дата народження | не має точної категорії: Other User Content / Other Data Types | Personal info → Other (дата народження) | перевірка 18+ | так |
| Приблизне місцезнаходження | Location → Coarse Location | Location → Approximate location | показ людей і закладів поруч | ні (можна відмовити) |
| Точне місцезнаходження | Location → Precise Location (використовується на пристрої, на сервер у публічному профілі йдуть округлені координати; уточніть у консолі, чи потрібно декларувати) | Location → Precise location | пошук поруч | ні |
| Повідомлення | User Content → Other User Content (повідомлення) | Messages → Other in-app messages | чати | так (функція) |
| Фото профілю | User Content → Photos or Videos | Photos and videos | аватар | ні |
| Ідентифікатор пристрою (push-токен) | Identifiers → Device ID | Device or other IDs | push-сповіщення | ні |
| Ідентифікатор користувача | Identifiers → User ID | Personal info → User IDs | функціонал | так |
| Скарги, блокування | User Content → Other User Content | App activity → Other user-generated content | безпека | так |

Додатково для **Google Data safety**: «Data is encrypted in transit» — Так. «Users can request data deletion» — Так (у застосунку; вкажіть URL інструкції видалення, Google вимагає веб-посилання на видалення акаунта: потрібна проста сторінка з інструкцією «Профіль → Видалити акаунт»).

Для **Apple**: Account Deletion (5.1.1(v)) виконано в застосунку; посилання на політику обовʼязкове; вік 18+ (в `store.config.json` виставлено частий контент про алкоголь; перегляньте відповіді анкети вікового рейтингу).

Для **Google Play**: анкета Content rating (IARC): згадка алкоголю, користувацький контент зі спілкуванням, обмін місцезнаходженням. Цільова аудиторія: 18+. Заява про дозволи місцезнаходження: лише під час використання (foreground).
