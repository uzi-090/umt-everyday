import test from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECTS, TIMETABLE, PENDING_SUBJECTS, attendancePercent, classesToTarget, absenceAllowance, recordsFor, classMinutes } from '../src/data.js';

test('recovery classes and absence allowance include future held classes', () => {
  assert.equal(classesToTarget(7, 10, 75), 2);
  assert.equal(classesToTarget(14, 20, 75), 4);
  assert.equal(classesToTarget(18, 20, 95), 20);
  assert.equal(absenceAllowance(18, 20, 75), 4);
  assert.equal(absenceAllowance(15, 20, 75), 0);
  assert.equal(attendancePercent(0, 0), null);
  assert.equal(classesToTarget(0, 0, 75), null);
  assert.equal(classesToTarget(18, 20, 100), Infinity);
});

test('sample history reconciles with every displayed attendance total', () => {
  for (const subject of SUBJECTS) {
    const records = recordsFor(subject);
    assert.equal(records.length, subject.held);
    assert.equal(records.filter(record => record.status === 'Present').length, subject.attended);
    assert.equal(new Set(records.map(record => record.id)).size, subject.held);
  }
});

test('registered course codes keep theory and lab separate and include the supplied Linear Algebra code', () => {
  assert.deepEqual(SUBJECTS.map(subject => subject.code), ['CC112', 'CC112L', 'CC222', 'CC222L', 'MA150', 'MK210', 'SD210', 'MA210']);
  assert.equal(SUBJECTS.find(subject => subject.code === 'MA210').fullName, 'Linear Algebra');
  assert.equal(SUBJECTS.find(subject => subject.code === 'CC112L').section, 'D3');
  assert.equal(SUBJECTS.find(subject => subject.code === 'MA150').section, 'A2');
});

test('the supplied timetable covers all eight courses in chronological order without overlaps', () => {
  assert.equal(TIMETABLE.length, 7);
  assert.deepEqual(TIMETABLE.map(day => day.length), [1, 5, 2, 1, 5, 2, 0]);
  assert.equal(TIMETABLE.reduce((minutes, day) => minutes + classMinutes(day), 0), 1290);
  assert.equal(PENDING_SUBJECTS.length, 0);
  for (const day of TIMETABLE) {
    day.forEach((lesson, index) => {
      assert(SUBJECTS.some(subject => subject.id === lesson.subject));
      assert(lesson.start < lesson.end);
      assert.match(lesson.room, /^SST[12]-\d+[A-Z]?$/);
      if (index) assert(day[index - 1].end <= lesson.start);
    });
  }
});

test('rooms stay attached to each session, including different rooms for the same course', () => {
  assert.equal(TIMETABLE[0][0].room, 'SST1-702');
  assert.equal(TIMETABLE[3][0].room, 'SST2-404');
  assert.equal(TIMETABLE[1].find(item => item.subject === 'statistics').room, 'SST2-1101');
  assert.equal(TIMETABLE[5].find(item => item.subject === 'statistics').room, 'SST1-701');
  assert.equal(TIMETABLE[4].find(item => item.subject === 'civics').room, 'SST1-304B');
});

test('lab sessions and the late Friday end time are preserved as supplied', () => {
  const oopLab = TIMETABLE[1].filter(item => item.subject === 'oop-lab');
  assert.deepEqual(oopLab.map(item => [item.start, item.end, item.room]), [['11:00', '12:15', 'SST1-603'], ['12:30', '13:45', 'SST1-603']]);
  const coalLab = TIMETABLE[4].filter(item => item.subject === 'coal-lab');
  assert.deepEqual(coalLab.map(item => [item.start, item.end, item.room]), [['17:00', '18:15', 'SST1-302'], ['18:30', '21:15', 'SST1-302']]);
  assert.deepEqual(TIMETABLE.flatMap((day, index) => day.filter(item => item.subject === 'linear-algebra').map(item => [index, item.start, item.end, item.room])), [[2, '08:00', '09:15', 'SST1-701'], [5, '08:00', '09:15', 'SST1-701']]);
});

test('attendance stays sample data and unsupplied registration facts stay unknown', () => {
  assert(SUBJECTS.every(subject => subject.room === null && subject.attendanceIsSample));
  const algebra = SUBJECTS.find(subject => subject.code === 'MA210');
  assert.equal(algebra.creditHours, null);
  assert.equal(algebra.section, null);
});
