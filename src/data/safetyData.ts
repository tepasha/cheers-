import { ph } from '../services/i18nService';
import { ReportCategory } from '../types';

export const REPORT_CATEGORIES: {
  id: ReportCategory;
  title: string;
  description: string;
  icon: string;
  severity: 'high' | 'medium' | 'critical';
}[] = [
  {
    id: 'harassment',
    title: ph('Домагання чи агресія'),
    description: ph('Образи, погрози, небажані домагання чи тиск'),
    icon: '🛑',
    severity: 'critical',
  },
  {
    id: 'suspicious',
    title: ph('Підозрілий акаунт / Шахрайство'),
    description: ph('Бот, фішинг, вимагання грошей або підробний профіль'),
    icon: '🕵️‍♂️',
    severity: 'critical',
  },
  {
    id: 'toxic_behavior',
    title: ph('Неадекватна поведінка в закладі'),
    description: ph('Надмірне сп’яніння, дебош, порушення порядку за столиком'),
    icon: '⚠️',
    severity: 'high',
  },
  {
    id: 'inappropriate_content',
    title: ph('Неприйнятний контент / Спам'),
    description: ph('Реклама, спам-кличі, заборонені матеріали'),
    icon: '🚫',
    severity: 'medium',
  },
  {
    id: 'underage',
    title: ph('Неповнолітні (Порушення 18+)'),
    description: ph('Особи до 18 років у додатку для зустрічей у барах'),
    icon: '🔞',
    severity: 'critical',
  },
  {
    id: 'spam',
    title: ph('Фейковий клич або чекін'),
    description: ph('Людина не з’явилася або створює неправдиві локації'),
    icon: '📢',
    severity: 'medium',
  },
  {
    id: 'other',
    title: ph('Інша проблема безпеки'),
    description: ph('Будь-яке інше порушення правил спільноти'),
    icon: '🛡️',
    severity: 'medium',
  },
];

export const SOS_SAFETY_TIPS = [
  {
    title: ph('Кодова фраза «Запитайте Анжелу» (Ask for Angela)'),
    description: ph('Фраза «Запитайте Анжелу» діє в закладах, що беруть участь у програмі. Якщо персонал її не знає, прямо попросіть допомогу або таксі.'),
    icon: '🍸',
  },
  {
    title: ph('Екстрена допомога в Україні'),
    description: ph('Єдиний номер екстрених служб: 112. Поліція: 102. Швидка допомога: 103.'),
    icon: '🚨',
  },
  {
    title: ph('Публічне місце'),
    description: ph('Ніколи не залишайте заклад наодинці з малознайомою людиною. Зустрічайтеся лише в людних, добре освітлених місцях.'),
    icon: '💡',
  },
];
