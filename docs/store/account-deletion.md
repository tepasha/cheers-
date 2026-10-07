# Видалення акаунта «Будьмо!» / Deleting your «Будьмо!» account (ЧЕРНЕТКА)

> Сторінка для Google Play (Data safety → «Delete account URL») і для всіх, хто вже не має застосунку. Опублікуйте її
> за публічним https-посиланням разом із політикою конфіденційності, підставте контакт замість `[email]` і вкажіть
> посилання в Play Console. Текст описує те, що робить код (`functions/src/account.ts`); якщо змінюєте поведінку,
> змініть і його. Це не юридична консультація.

## Українською

**Застосунок:** «Будьмо!». **Розробник:** [НАЗВА / ПІБ].

### Як видалити акаунт у застосунку

1. Відкрийте **Профіль** і прокрутіть донизу.
2. Натисніть **Видалити акаунт**.
3. Підтвердьте, що це ви: введіть пароль або увійдіть через Google чи Apple повторно. Сервер вимагає авторизацію не давнішу за 10 хвилин.
4. Натисніть **Видалити назавжди** та дочекайтеся підтвердження сервера. Якщо мережа перервалася, повторіть операцію. Після успіху локальні персональні дані очищаються.

### Якщо застосунку вже немає

Напишіть на **[email]** з адреси, на яку зареєстровано акаунт, з темою «Видалення акаунта». Ми видалимо акаунт тим самим
способом протягом [N] днів і підтвердимо відповіддю.

### Що видаляється

* обліковий запис (email, Google або Apple);
* публічний профіль: імʼя, фото, опис, місцезнаходження, час останнього візиту;
* приватні дані: email у профілі, дата народження, прогрес і досягнення;
* друзі, улюблені заклади, ваш список блокувань;
* ваші столики й зустрічі; ваші місця за чужими столиками та відповіді на чужі зустрічі;
* записи про ваші пристрої для push-сповіщень;
* ваше імʼя та фото в чатах інших людей.

### Що лишається

* **Надіслані повідомлення** лишаються в чатах ваших співрозмовників у зашифрованому вигляді, **без вашого імені та
  фото**: розмова належить і їм. [Узгодьте з юристом.]
* **Скарги** зберігаються до 90 днів після серверного отримання. Імена й фото видаляються, технічні UID залишаються як псевдонімні ідентифікатори для модерації.
* Групові чати залишаються іншим учасникам; ви вилучаєтеся зі складу, право адміністратора передається. UID може залишатися у старих повідомленнях. Уже збережений контент на чужому офлайн-пристрої неможливо відкликати дистанційно.
* Резервні копії інфраструктури (Google Firebase) перезаписуються в межах їхніх строків.

## In English

**App:** «Будьмо!». **Developer:** [NAME].

### Delete your account in the app

1. Open **Profile** and scroll to the bottom.
2. Tap **Delete account**.
3. Confirm it is you with your password, Google or Apple. The server requires authentication within the last ten minutes.
4. Tap **Delete permanently** and wait for server confirmation. Retry if the connection fails. On success, local personal data is cleared.

### If you no longer have the app

Email **[email]** from the address of your account with the subject "Account deletion". We delete the account the same
way within [N] days and confirm by reply.

### What is deleted

* your sign-in (email, Google or Apple);
* your public profile: name, photo, bio, location, last-seen time;
* private data: e-mail in the profile, date of birth, progress and achievements;
* friends, favourite places, your block list;
* your tables and meetups; your seats at other people's tables and your replies to their meetups;
* your push-notification device records;
* your name and photo in other people's chats.

### What is kept

* **Messages you sent** stay in your contacts' chats, encrypted and **without your name or photo**: the conversation is
  theirs too.
* **Reports** are retained for up to 90 days after server receipt. Names and photos are removed; technical UIDs remain as pseudonymous moderation identifiers.
* Groups remain available to other members. Your membership is removed and ownership is transferred. Old messages may retain a technical UID. Copies already stored on another person's offline device cannot be remotely recalled.
* Infrastructure backups (Google Firebase) are overwritten within their own retention periods.
