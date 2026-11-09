import test from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, nextReminder, reminderPayload, parseReminderLink, weeklyReminders } from '../src/reminderSchedule.js';

test('all 16 weekly sessions get their own Pakistan-time reminder exactly ten minutes earlier', () => {
  const items = weeklyReminders(new Date('2026-10-19T00:00:00Z'));
  assert.equal(items.length, 16);
  assert.equal(new Set(items.map(item => item.id)).size, 16);
  assert(items.every(item => item.startsAt - item.dueAt === 600000));
  const monday = items[0];
  assert.equal(new Date(monday.dueAt).toISOString(), '2026-10-19T07:20:00.000Z');
  assert.equal(monday.room, 'SST1-702');
  assert.match(reminderPayload(monday).body, /12:30 PM–1:45 PM · SST1-702/);
  assert.equal(dueReminders(new Date(monday.dueAt - 1)).length, 0);
  assert.equal(dueReminders(new Date(monday.dueAt)).length, 1);
  assert.equal(dueReminders(new Date(monday.dueAt + 59999)).length, 1);
  assert.equal(dueReminders(new Date(monday.dueAt + 60000)).length, 0);
  assert.equal(dueReminders(new Date(monday.startsAt + 600000)).length, 0);
});

test('labs stay separate, changing rooms are preserved, and Sunday rolls to the next week', () => {
  const items = weeklyReminders(new Date('2026-10-19T00:00:00Z'));
  assert.deepEqual(items.filter(item => item.subject === 'oop-lab').map(item => new Date(item.dueAt).toISOString()), ['2026-10-20T05:50:00.000Z', '2026-10-20T07:20:00.000Z']);
  assert.equal(items.find(item => item.subject === 'oop' && item.day === 3).room, 'SST2-404');
  assert.equal(items.find(item => item.subject === 'linear-algebra').code, 'MA210');
  assert.equal(dueReminders(new Date('2026-10-25T07:20:00Z')).length, 0);
  assert.equal(nextReminder(new Date('2026-10-25T07:20:00Z')).date, '2026-10-26');
});

test('notification links open the exact session, reject invalid days, and avoid stale-week classes', () => {
  const now = new Date('2026-10-19T00:00:00Z');
  const item = weeklyReminders(now).find(item => item.subject === 'coal-lab' && item.start === '18:30');
  const parsed = parseReminderLink(new URL(item.path, 'https://example.com').search, now);
  assert.equal(parsed.day, 4);
  assert.equal(parsed.lesson.room, 'SST1-302');
  assert.equal(parsed.lesson.end, '21:15');
  assert.equal(parsed.lesson.id, 'coal-lab');
  assert.equal(parseReminderLink('?view=schedule&day=99', now), null);
  assert.equal(parseReminderLink('?view=settings', now), null);
  assert.equal(parseReminderLink(new URL(item.path, 'https://example.com').search, new Date('2026-10-26T00:00:00Z')).lesson, null);
});
