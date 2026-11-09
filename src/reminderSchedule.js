import { SUBJECTS, TIMETABLE } from './data.js';
import { getScheduleWeek } from './scheduleDate.js';

export const REMINDER_LEAD_MS = 10 * 60 * 1000;
export const REMINDER_WINDOW_MS = 60 * 1000;

export function weeklyReminders(now = new Date()) {
  const week = getScheduleWeek(now);
  return week.days.flatMap((date, day) => TIMETABLE[day].map(lesson => {
    const subject = SUBJECTS.find(item => item.id === lesson.subject);
    const startsAt = new Date(`${date.key}T${lesson.start}:00+05:00`).getTime();
    const dueAt = startsAt - REMINDER_LEAD_MS;
    const query = new URLSearchParams({ view: 'schedule', day: String(day), subject: lesson.subject, start: lesson.start, date: date.key });
    return { ...lesson, name: subject.name, code: subject.code, day, date: date.key, startsAt, dueAt, expiresAt: dueAt + REMINDER_WINDOW_MS, id: `${date.key}-${lesson.subject}-${lesson.start}`, path: `/?${query}` };
  })).sort((a, b) => a.dueAt - b.dueAt);
}

export function dueReminders(now = new Date()) {
  const time = now.getTime();
  return weeklyReminders(now).filter(item => time >= item.dueAt && time < item.expiresAt);
}

export function nextReminder(now = new Date()) {
  const future = weeklyReminders(now).find(item => item.dueAt > now.getTime());
  if (future) return future;
  return weeklyReminders(new Date(now.getTime() + 7 * 86400000)).find(item => item.dueAt > now.getTime()) ?? null;
}

export function reminderPayload(item) {
  const clock = value => {
    const [hour, minute] = value.split(':').map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  };
  return { title: `${item.name} in 10 minutes`, body: `${clock(item.start)}–${clock(item.end)} · ${item.room}\n${item.code}`, tag: item.id, url: item.path };
}

export function parseReminderLink(search, now = new Date()) {
  const params = new URLSearchParams(search);
  const day = Number(params.get('day'));
  if (params.get('view') !== 'schedule' || !Number.isInteger(day) || day < 0 || day > 6) return null;
  const week = getScheduleWeek(now);
  // A previous week's notification should open today's schedule, not a stale class.
  if (params.get('date') !== week.days[day].key) return { day: week.todayIndex, lesson: null };
  const lesson = TIMETABLE[day].find(item => item.subject === params.get('subject') && item.start === params.get('start'));
  return { day, lesson: lesson ? { ...SUBJECTS.find(subject => subject.id === lesson.subject), ...lesson, day } : null };
}
