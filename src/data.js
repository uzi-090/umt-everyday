// Registration details are real; attendance remains explicitly sample data.
const SAMPLE_ABSENCES = [[5, 13], [1, 4, 7, 11, 14, 18], [3, 10, 17], [8], [2, 9, 16], [3, 7, 12, 18], [11], [0, 5, 8, 14, 19]];
export const SUBJECTS = [
  { id: 'oop', name: 'OOP', fullName: 'Object Oriented Programming', code: 'CC112', creditHours: 3, section: 'D1', faculty: 'Mehak Saleem', type: 'Core Course', variant: 'code' },
  { id: 'oop-lab', name: 'OOP Lab', fullName: 'Object Oriented Programming (Lab)', code: 'CC112L', creditHours: 1, section: 'D3', faculty: 'Syeda Inshrah Fatima', type: 'Core Course', variant: 'code' },
  { id: 'coal', name: 'COAL', fullName: 'Computer Organization and Assembly Language', code: 'CC222', creditHours: 2, section: 'D1', faculty: 'Dr. Muhammad Rizwan', type: 'Core Course', variant: 'code' },
  { id: 'coal-lab', name: 'COAL Lab', fullName: 'Computer Organization and Assembly Language (Lab)', code: 'CC222L', creditHours: 1, section: 'D3', faculty: 'Muhammad Rizwan Shoukat', type: 'Core Course', variant: 'code' },
  { id: 'statistics', name: 'Statistics', fullName: 'Probability and Statistics', code: 'MA150', creditHours: 3, section: 'A2', faculty: 'Dr. Farooq Ahmad', type: 'Core Course', variant: 'classic' },
  { id: 'marketing', name: 'Marketing', fullName: 'Principles of Marketing', code: 'MK210', creditHours: 3, section: 'C2', faculty: 'Zahid Iqbal', type: 'Elective Course', variant: 'classic' },
  { id: 'civics', name: 'Civics', fullName: 'Civics and Community Engagement', code: 'SD210', creditHours: 2, section: 'D2', faculty: null, type: 'Core Course', variant: 'classic' },
  { id: 'linear-algebra', name: 'Linear Algebra', railName: 'Linear alg.', fullName: 'Linear Algebra', code: 'MA210', creditHours: null, section: null, faculty: null, type: null, variant: 'classic' },
].map((subject, index) => ({ ...subject, semester: 'Fall 2026', room: null, attendanceIsSample: true, held: 20, attended: 20 - SAMPLE_ABSENCES[index].length, absentAt: SAMPLE_ABSENCES[index] }));

export const WEEKDAYS = [
  { short: 'Mon', name: 'Monday' },
  { short: 'Tue', name: 'Tuesday' },
  { short: 'Wed', name: 'Wednesday' },
  { short: 'Thu', name: 'Thursday' },
  { short: 'Fri', name: 'Friday' },
  { short: 'Sat', name: 'Saturday' },
  { short: 'Sun', name: 'Sunday' },
];

// Weekly sessions transcribed from the supplied portal timetable. Rooms belong
// to sessions: the same course can meet in different rooms on different days.
const lesson = (subject, start, end, room) => ({ subject, start, end, room });
export const TIMETABLE = [
  [lesson('oop', '12:30', '13:45', 'SST1-702')],
  [
    lesson('coal', '09:30', '10:45', 'SST2-503'),
    lesson('oop-lab', '11:00', '12:15', 'SST1-603'),
    lesson('oop-lab', '12:30', '13:45', 'SST1-603'),
    lesson('marketing', '14:00', '15:15', 'SST2-805'),
    lesson('statistics', '15:30', '16:45', 'SST2-1101'),
  ],
  [
    lesson('linear-algebra', '08:00', '09:15', 'SST1-701'),
    lesson('civics', '12:30', '13:45', 'SST2-1005'),
  ],
  [lesson('oop', '12:30', '13:45', 'SST2-404')],
  [
    lesson('coal', '09:30', '10:45', 'SST1-706A'),
    lesson('marketing', '14:00', '15:15', 'SST2-805'),
    lesson('civics', '15:30', '16:45', 'SST1-304B'),
    lesson('coal-lab', '17:00', '18:15', 'SST1-302'),
    lesson('coal-lab', '18:30', '21:15', 'SST1-302'),
  ],
  [
    lesson('linear-algebra', '08:00', '09:15', 'SST1-701'),
    lesson('statistics', '12:30', '13:45', 'SST1-701'),
  ],
  [],
];
export const PENDING_SUBJECTS = SUBJECTS.filter(subject => !TIMETABLE.some(day => day.some(lesson => lesson.subject === subject.id)));

export function attendancePercent(attended, held) {
  return held > 0 ? (attended / held) * 100 : null;
}

export function classesToTarget(attended, held, target) {
  if (!held) return null;
  if (attendancePercent(attended, held) >= target) return 0;
  if (target >= 100) return Infinity;
  const fraction = target / 100;
  return Math.max(0, Math.ceil((fraction * held - attended) / (1 - fraction) - 1e-9));
}

export function absenceAllowance(attended, held, target) {
  if (!held || target <= 0) return null;
  return Math.max(0, Math.floor(attended / (target / 100) - held + 1e-9));
}

export function classMinutes(classes) {
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return classes.reduce((total, item) => total + minutes(item.end) - minutes(item.start), 0);
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}

const classDates = [];
for (let day = 0; classDates.length < 20; day++) {
  const date = new Date(Date.UTC(2026, 8, 21 + day));
  if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) classDates.push(date.toISOString().slice(0, 10));
}

export function recordsFor(subject) {
  return classDates.map((date, index) => ({
    id: `${subject.id}-${index}`,
    date,
    status: subject.absentAt.includes(index) ? 'Absent' : 'Present',
  })).reverse();
}

export function displayDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}
