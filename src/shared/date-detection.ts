import { parse } from 'chrono-node';
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  setHours,
  setMinutes,
  getDay,
  differenceInCalendarDays,
  isValid,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export interface DetectedDateTime {
  originalText: string;
  start: Date;
  end?: Date;
  index: number;
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];
const MONTHS_FR_SHORT = [
  'janv', 'jan', 'févr', 'mars', 'avr', 'mai', 'juin',
  'juil', 'août', 'sept', 'oct', 'nov', 'déc'
];
const DAYS_FR = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'
];
const DAYS_FR_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function normalizeFrenchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[àâ]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ÿ]/g, 'y')
    .replace(/[ç]/g, 'c');
}

function monthNameToNumber(name: string): number | null {
  const normalized = normalizeFrenchText(name);
  const idx = MONTHS_FR.findIndex(m => normalizeFrenchText(m).startsWith(normalized));
  if (idx >= 0) return idx;
  const idxShort = MONTHS_FR_SHORT.findIndex(m => normalizeFrenchText(m).startsWith(normalized));
  if (idxShort >= 0) return idxShort;
  return null;
}

function dayNameToNumber(name: string): number | null {
  const normalized = normalizeFrenchText(name);
  const idx = DAYS_FR.findIndex(d => normalizeFrenchText(d).startsWith(normalized));
  if (idx >= 0) return idx;
  const idxShort = DAYS_FR_SHORT.findIndex(d => normalizeFrenchText(d).startsWith(normalized));
  if (idxShort >= 0) return idxShort;
  return null;
}

function getNextDayOfWeek(ref: Date, targetDay: number): Date {
  const currentDay = getDay(ref);
  let daysToAdd = (targetDay - currentDay + 7) % 7;
  if (daysToAdd === 0) daysToAdd = 7;
  return addDays(startOfDay(ref), daysToAdd);
}

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/^(\d{1,2})[h:](\d{2})?$/);
  if (match) {
    return { hours: parseInt(match[1], 10), minutes: parseInt(match[2] || '0', 10) };
  }
  const match2 = timeStr.match(/^(\d{1,2})h$/);
  if (match2) {
    return { hours: parseInt(match2[1], 10), minutes: 0 };
  }
  return null;
}

function applyTime(date: Date, time: { hours: number; minutes: number }): Date {
  return setMinutes(setHours(date, time.hours), time.minutes);
}

function findTimeAfter(text: string, fromIndex: number): { time: { hours: number; minutes: number }; matchedText: string } | null {
  const timeRegex = /(\d{1,2}[h:]\d*)/g;
  timeRegex.lastIndex = fromIndex;
  const match = timeRegex.exec(text);
  if (match) {
    const parsed = parseTime(match[1]);
    if (parsed) {
      return { time: parsed, matchedText: match[1] };
    }
  }
  return null;
}

function parseFrenchDateTime(text: string, ref: Date): DetectedDateTime[] {
  const results: DetectedDateTime[] = [];
  let match: RegExpExecArray | null;

  // Pattern 1: DD/MM/YYYY [à] HH:MM or HHh
  const regex1 = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/g;
  while ((match = regex1.exec(text)) !== null) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (!isValid(date)) continue;

    let start = date;
    const timeResult = findTimeAfter(text, match.index + match[0].length);
    if (timeResult) {
      start = applyTime(date, timeResult.time);
    }
    results.push({ originalText: match[0].trim(), start, index: match.index });
  }

  // Pattern 2: DD/MM [à] HH:MM or HHh (current/next year)
  const regex2 = /(\d{1,2})[/\-.](\d{1,2})(?!\d)/g;
  while ((match = regex2.exec(text)) !== null) {
    const after = text.slice(match.index + match[0].length);
    if (after.match(/^[\/\-.]\d{2,4}/)) continue;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = ref.getFullYear();
    let date = new Date(year, month, day);
    if (date < startOfDay(ref)) date = new Date(year + 1, month, day);
    if (!isValid(date)) continue;

    let start = date;
    const timeResult = findTimeAfter(text, match.index + match[0].length);
    if (timeResult) {
      start = applyTime(date, timeResult.time);
    }
    results.push({ originalText: match[0].trim(), start, index: match.index });
  }

  // Pattern 3: DD month_name YYYY [à] HH:MM
  const monthNames = MONTHS_FR.concat(MONTHS_FR_SHORT).join('|');
  const regex3 = new RegExp(`(\\d{1,2})\\s+(${monthNames})\\.?\\s+(\\d{4})`, 'gi');
  while ((match = regex3.exec(text)) !== null) {
    const day = parseInt(match[1], 10);
    const month = monthNameToNumber(match[2]);
    const year = parseInt(match[3], 10);
    if (month === null) continue;
    const date = new Date(year, month, day);
    if (!isValid(date)) continue;

    let start = date;
    const timeResult = findTimeAfter(text, match.index + match[0].length);
    if (timeResult) {
      start = applyTime(date, timeResult.time);
    }
    results.push({ originalText: match[0].trim(), start, index: match.index });
  }

  // Pattern 4: DD month_name (current/next year)
  const regex4 = new RegExp(`(\\d{1,2})\\s+(${monthNames})\\.?(?!\\s+\\d{4})`, 'gi');
  while ((match = regex4.exec(text)) !== null) {
    const day = parseInt(match[1], 10);
    const month = monthNameToNumber(match[2]);
    if (month === null) continue;
    const year = ref.getFullYear();
    let date = new Date(year, month, day);
    if (date < startOfDay(ref)) date = new Date(year + 1, month, day);
    if (!isValid(date)) continue;

    results.push({ originalText: match[0].trim(), start: date, index: match.index });
  }

  // Pattern 5: jour_semaine [prochain/ce] [à] HH:MM
  const dayNames = DAYS_FR.concat(DAYS_FR_SHORT).join('|');
  const regex5 = new RegExp(`(?:ce|prochain|prochaine)?\\s*(${dayNames})\\.?`, 'gi');
  while ((match = regex5.exec(text)) !== null) {
    const dayNum = dayNameToNumber(match[1]);
    if (dayNum === null) continue;

    const isProchain = match[0].includes('prochain') || match[0].includes('prochaine');
    let date = getNextDayOfWeek(ref, dayNum);
    if (isProchain && differenceInCalendarDays(date, ref) <= 1) {
      date = addDays(date, 7);
    }
    if (!isValid(date)) continue;

    let start = date;
    const timeResult = findTimeAfter(text, match.index + match[0].length);
    if (timeResult) {
      start = applyTime(date, timeResult.time);
    }
    results.push({ originalText: match[0].trim(), start, index: match.index });
  }

  // Pattern 6: demain [à] HH:MM
  const regex6 = /demain/gi;
  while ((match = regex6.exec(text)) !== null) {
    const date = addDays(startOfDay(ref), 1);
    if (!isValid(date)) continue;

    let start = date;
    const timeResult = findTimeAfter(text, match.index + match[0].length);
    if (timeResult) {
      start = applyTime(date, timeResult.time);
    }
    results.push({ originalText: match[0].trim(), start, index: match.index });
  }

  // Pattern 7: dans X jours [à] HH:MM
  const regex7 = /dans\s+(\d+)\s+jours?/gi;
  while ((match = regex7.exec(text)) !== null) {
    const days = parseInt(match[1], 10);
    const date = addDays(startOfDay(ref), days);
    if (!isValid(date)) continue;

    let start = date;
    const timeResult = findTimeAfter(text, match.index + match[0].length);
    if (timeResult) {
      start = applyTime(date, timeResult.time);
    }
    results.push({ originalText: match[0].trim(), start, index: match.index });
  }

  // Pattern 8: HH:MM or HHh (time only -> today)
  const regex8 = /(?:^|\s)(\d{1,2}[h:]\d*)(?=\s|$|[.,;!?])/g;
  while ((match = regex8.exec(text)) !== null) {
    const m = match!;
    const time = parseTime(m[1]);
    if (!time) continue;
    const start = applyTime(startOfDay(ref), time);
    if (!isValid(start)) continue;

    const isPartOfDate = results.some(r =>
      r.index < m.index &&
      r.index + r.originalText.length >= m.index
    );
    const beforeText = text.slice(Math.max(0, m.index - 50), m.index);
    const precededByDate = /(\d{1,2}[\/\-.]\d{1,2}|\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv|févr|avr|juil|sept|oct|nov|déc|jan)|(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)(?:\s+prochain|\s+prochaine)?|demain|dans\s+\d+\s+jours?)\.?\s*(?:a|à|@)?\s*$/i.test(beforeText);

    if (!isPartOfDate && !precededByDate) {
      results.push({ originalText: m[1].trim(), start, index: m.index });
    }
  }

  // Pattern 9: cette semaine / la semaine prochaine
  const regex9 = /(?:cette|la?\s+prochaine)\s+semaine/gi;
  while ((match = regex9.exec(text)) !== null) {
    const isProchaine = match[0].includes('prochaine');
    const date = isProchaine
      ? addDays(startOfDay(ref), 7 - getDay(ref) + 1)
      : startOfDay(ref);
    if (isValid(date)) {
      results.push({ originalText: match[0].trim(), start: date, index: match.index });
    }
  }

  // Pattern 10: ce week-end / weekend
  const regex10 = /ce\s+week[- ]?end/gi;
  while ((match = regex10.exec(text)) !== null) {
    const saturday = getNextDayOfWeek(ref, 6);
    if (isValid(saturday)) {
      results.push({ originalText: match[0].trim(), start: saturday, index: match.index });
    }
  }

  return results;
}

function deduplicateResults(results: DetectedDateTime[]): DetectedDateTime[] {
  const sorted = [...results].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return b.originalText.length - a.originalText.length;
  });

  const seen = new Set<string>();
  const seenTimeAtDate = new Set<number>();

  return sorted.filter(r => {
    const key = `${r.originalText}-${r.start.getTime()}`;
    if (seen.has(key)) return false;

    const timeOnly = r.originalText.match(/^\d{1,2}[h:]\d*$/);
    if (timeOnly) {
      const timeKey = r.start.getTime();
      if (seenTimeAtDate.has(timeKey)) return false;
    }

    seen.add(key);
    if (r.originalText.includes('/') || r.originalText.match(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/i)) {
      seenTimeAtDate.add(r.start.getTime());
    }
    return true;
  });
}

export function detectDateTimes(text: string, referenceDate = new Date()): DetectedDateTime[] {
  const customDetected = parseFrenchDateTime(text, referenceDate);

  const chronoResults = parse(text, referenceDate);
  const chronoDetected: DetectedDateTime[] = chronoResults
    .map((r, index: number) => ({
      originalText: r.text,
      start: r.start.date(),
      end: r.end?.date(),
      index,
    }))
    .filter(c => !customDetected.some(custom =>
      custom.index === c.index && custom.start.getTime() === c.start.getTime()
    ));

  const all = [...customDetected, ...chronoDetected];
  return deduplicateResults(all).sort((a, b) => a.index - b.index);
}

export function formatDateTimeForDisplay(date: Date): string {
  return format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
}

export function formatDateOnlyForDisplay(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: fr });
}

export function formatTimeOnlyForDisplay(date: Date): string {
  return format(date, 'HH:mm', { locale: fr });
}