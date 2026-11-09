const DAY_MS = 24 * 60 * 60 * 1000;
const campusDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
});
const fullDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
});
const campusTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function getScheduleHighlight(classes, day, now = new Date()) {
  const { todayIndex } = getScheduleWeek(now);
  if (!classes.length || day < todayIndex) return { index: -1, label: '' };
  if (day > todayIndex) return { index: 0, label: 'First class' };
  const time = campusTime.format(now);
  const index = classes.findIndex(lesson => lesson.end > time);
  return { index, label: index < 0 ? '' : classes[index].start <= time ? 'In progress' : 'Next class' };
}

export function getScheduleWeek(now = new Date()) {
  const parts = Object.fromEntries(campusDate.formatToParts(now).map(part => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const todayIndex = (today.getUTCDay() + 6) % 7;
  const monday = today.getTime() - todayIndex * DAY_MS;
  return {
    todayIndex,
    todayKey: today.toISOString().slice(0, 10),
    days: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday + index * DAY_MS);
      return { key: date.toISOString().slice(0, 10), number: date.getUTCDate(), label: fullDate.format(date) };
    }),
  };
}
