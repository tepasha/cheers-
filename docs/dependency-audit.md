# Перевірка залежностей перед релізом

Стан перевірки: **2026-10-07**. Запуск: `node scripts/dependency-audit.mjs` після `npm ci` у корені та `functions/`. Цей gate включений до CI; нові advisories, завершення строку винятку чи помилка registry зупиняють перевірку.

`npm audit` для root показує **19 high записів**, які походять від **двох advisories** у транзитивних залежностях інструментів збірки. Functions має **0** записів. Gate з винятками проходить; це не означає відсутності вразливостей.

| Пакет | Ризик і межі поточного використання | Виняток діє до |
| --- | --- | --- |
| `braces` 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Metro/micromatch обробляє glob patterns із репозиторію; застосунок не передає в нього користувацькі шаблони. | 2026-11-06, 00:00 UTC |
| `node-forge` 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Expo CLI використовує certificate/signature tooling; код застосунку не імпортує пакет, OTA code signing не налаштований. Зміна схеми підписання потребує нового перегляду ризику. | 2026-11-06, 00:00 UTC |

На дату перевірки advisories не вказують patched version. Обмежені за строком винятки записані в [dependency-audit-exceptions.json](dependency-audit-exceptions.json); вони не прибирають advisory і не гарантують безпечності пакета. Оператор релізу має прийняти цей залишковий ризик або відкласти публікацію до виправлення upstream. Відсутність npm advisories у backend також не доводить відсутності всіх дефектів.

До завершення строку перегляньте upstream fixes і оновіть сумісні з Expo пакети. Не розширюйте винятки автоматично й не використовуйте `npm audit fix --force` без перевірки SDK, native plugins і tests. Повторіть gate на точному коміті релізу; registry advisory database може змінитися після цього звіту.
