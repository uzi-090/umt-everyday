import test from 'node:test';
import assert from 'node:assert/strict';
import { getScheduleWeek, getScheduleHighlight } from '../src/scheduleDate.js';
import { TIMETABLE } from '../src/data.js';

test('Schedule uses the current campus date and a Monday to Sunday week', () => {
  const week = getScheduleWeek(new Date('2026-10-17T15:00:00Z'));
  assert.equal(week.todayIndex, 5);
  assert.equal(week.todayKey, '2026-10-17');
  assert.deepEqual(week.days.map(day => day.number), [12, 13, 14, 15, 16, 17, 18]);
  assert.equal(week.days[5].label, 'October 17, 2026');
});

test('Schedule crosses campus midnight independently of the browser time zone', () => {
  const before = getScheduleWeek(new Date('2026-10-18T18:59:59Z'));
  const after = getScheduleWeek(new Date('2026-10-18T19:00:00Z'));
  assert.equal(before.todayIndex, 6);
  assert.equal(before.todayKey, '2026-10-18');
  assert.equal(after.todayIndex, 0);
  assert.equal(after.todayKey, '2026-10-19');
  assert.equal(after.days[0].number, 19);
});

test('A calendar week keeps correct dates across a year boundary', () => {
  const week = getScheduleWeek(new Date('2026-01-01T07:00:00Z'));
  assert.equal(week.todayIndex, 3);
  assert.deepEqual(week.days.map(day => day.key), ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
});

test('class highlight follows campus time across class starts, breaks, and the end of the day', () => {
  const tuesday = TIMETABLE[1];
  // All instants are UTC; campus time is five hours ahead.
  assert.deepEqual(getScheduleHighlight(tuesday, 1, new Date('2026-10-20T04:00:00Z')), { index: 0, label: 'Next class' });
  assert.deepEqual(getScheduleHighlight(tuesday, 1, new Date('2026-10-20T04:30:00Z')), { index: 0, label: 'In progress' });
  assert.deepEqual(getScheduleHighlight(tuesday, 1, new Date('2026-10-20T05:45:00Z')), { index: 1, label: 'Next class' });
  assert.deepEqual(getScheduleHighlight(tuesday, 1, new Date('2026-10-20T07:30:00Z')), { index: 2, label: 'In progress' });
  assert.deepEqual(getScheduleHighlight(tuesday, 1, new Date('2026-10-20T11:45:00Z')), { index: -1, label: '' });
});

test('future weekdays say First class and past days or Sunday have no next-class label', () => {
  const monday = new Date('2026-10-19T08:00:00Z');
  assert.deepEqual(getScheduleHighlight(TIMETABLE[1], 1, monday), { index: 0, label: 'First class' });
  assert.deepEqual(getScheduleHighlight(TIMETABLE[6], 6, monday), { index: -1, label: '' });
  assert.deepEqual(getScheduleHighlight(TIMETABLE[0], 0, new Date('2026-10-20T08:00:00Z')), { index: -1, label: '' });
});
