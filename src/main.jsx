import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import { CalendarSketch, Icon } from './Artwork.jsx';
import { StudentPass, useStudentPass } from './StudentPass.jsx';
import { THEMES, validTheme } from './themes.js';
import { SUBJECTS, WEEKDAYS, TIMETABLE, PENDING_SUBJECTS, attendancePercent, classesToTarget, absenceAllowance, classMinutes, formatDuration, recordsFor, displayDate } from './data.js';
import { createDepthCarousel } from './depthCarousel.js';
import { RAIL_COPIES, RAIL_CENTER } from './courseRail.js';
import { BottomDock } from './BottomDock.jsx';
import { getScheduleWeek, getScheduleHighlight } from './scheduleDate.js';
import { NotificationPanel } from './NotificationPanel.jsx';
import { parseReminderLink } from './reminderSchedule.js';
import { observeOffline } from './offline.js';
import './styles.css';
import './schedule.css';
import './courseRail.css';
import './mobile.css';

const STORAGE_KEY = 'umt-everyday-demo-v1';
const DEFAULTS = { version: 1, subject: 0, target: 75, motion: 'system', theme: 'electric' };
const keepCourseCopyUnfocused = event => event.preventDefault();

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || saved.version !== 1) return DEFAULTS;
    return {
      version: 1,
      subject: Number.isInteger(saved.subject) && saved.subject >= 0 && saved.subject < SUBJECTS.length ? saved.subject : 0,
      target: Number.isFinite(saved.target) ? Math.max(60, Math.min(95, saved.target)) : 75,
      motion: ['system', 'full', 'reduced'].includes(saved.motion) ? saved.motion : 'system',
      theme: validTheme(saved.theme),
    };
  } catch { return DEFAULTS; }
}

function useSystemMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function PageTitle({ title, subtitle, children }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>;
}

function AttendanceView({ active, selectedIndex, onSelect, target, reducedMotion, onHistory, shellRef }) {
  const surfaceRef = useRef(null);
  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const detailsRef = useRef(null);
  const engineRef = useRef(null);
  const selectRef = useRef(onSelect);
  const previousIndex = useRef(selectedIndex);
  selectRef.current = onSelect;
  const subject = SUBJECTS[selectedIndex];
  const below = attendancePercent(subject.attended, subject.held) < target;
  useStudentPass(worldRef, reducedMotion, active);

  useLayoutEffect(() => {
    const engine = createDepthCarousel({
      surface: surfaceRef.current,
      stage: stageRef.current,
      world: worldRef.current,
      layers: [...worldRef.current.querySelectorAll('.glyph-layer')],
      shell: shellRef.current || surfaceRef.current.closest('.app-shell'),
      initialIndex: selectedIndex,
      reducedMotion,
      onIndex: index => selectRef.current(index),
      onDragState: value => surfaceRef.current?.classList.toggle('is-dragging', value),
    });
    engineRef.current = engine;
    return () => { engine.dispose(); engineRef.current = null; };
  }, [reducedMotion]);

  useLayoutEffect(() => {
    engineRef.current?.setActive(active);
  }, [active, reducedMotion]);

  useLayoutEffect(() => {
    engineRef.current?.syncIndex(selectedIndex);
  }, [selectedIndex, reducedMotion]);

  useLayoutEffect(() => {
    if (previousIndex.current === selectedIndex) return;
    previousIndex.current = selectedIndex;
    const ctx = gsap.context(() => {
      gsap.fromTo('.subject-identity', { opacity: .15, y: reducedMotion ? 0 : 8 }, { opacity: 1, y: 0, duration: reducedMotion ? 0 : .28, ease: 'power2.out', overwrite: true });
    }, detailsRef);
    return () => ctx.revert();
  }, [selectedIndex, reducedMotion]);

  const openHistory = () => {
    if (!engineRef.current?.suppressClick()) onHistory(subject);
  };

  return <section className="attendance-view page-view" hidden={!active} inert={!active ? true : undefined} ref={surfaceRef} aria-label="Attendance overview">
    <div className="depth-world" ref={worldRef} aria-hidden="true">
      {SUBJECTS.map(item => <div className="glyph-layer" key={item.id} data-subject={item.id}>
        <StudentPass />
        <div className="glyph-numbers"><span className="glyph-percent">{Math.round(attendancePercent(item.attended, item.held))}<span>%</span></span><span className="glyph-count">{item.attended} / {item.held} attended</span></div>
      </div>)}
    </div>
    <PageTitle title="Attendance" subtitle="Sample attendance" />
    <div className="attendance-stage" ref={stageRef}>
      <button className="graphic-open" type="button" data-drag-surface aria-label={`Open ${subject.name} attendance history. Swipe up or down to change subject.`} onClick={openHistory} />
      <div className="subject-selector" role="group" aria-label="Choose subject" data-course-rail>
        <div className="subject-viewport" data-native-scroll><div className="subject-track">
          {Array.from({ length: RAIL_COPIES }, (_, copy) => <div className="subject-cycle" key={copy} data-primary={copy === RAIL_CENTER ? '' : undefined} aria-hidden={copy !== RAIL_CENTER ? true : undefined}>
            {SUBJECTS.map((item, index) => <button key={item.id} type="button" aria-label={item.fullName} className={selectedIndex === index ? 'is-active' : ''} aria-pressed={selectedIndex === index} tabIndex={copy === RAIL_CENTER && selectedIndex === index ? 0 : -1} onMouseDown={copy !== RAIL_CENTER ? keepCourseCopyUnfocused : undefined} onClick={() => { if (!engineRef.current?.suppressClick()) engineRef.current?.goTo(index); }}><span className="selection-dash" />{item.railName || item.name}</button>)}
          </div>)}
        </div></div>
      </div>
    </div>
    <div className="subject-details" ref={detailsRef}>
      <div className="subject-identity"><h2>{subject.name}</h2><p className="subject-code">{subject.code}</p><p className={`subject-status ${below ? 'needs-attention' : ''}`}><span className="status-dot" />{below ? 'Below target' : 'On track'}</p></div>
      <button type="button" className="history-button" onClick={openHistory}>Attendance history<Icon name="arrow" size={24} /></button>
    </div>
    <div className="context-strip"><div><span>Target</span><strong>{target}%</strong></div><div><span>Absent</span><strong>{subject.held - subject.attended} classes</strong></div></div>
    <p className="sr-only" aria-live="polite">{subject.name}: {Math.round(attendancePercent(subject.attended, subject.held))}% attendance. {below ? 'Below' : 'At or above'} your {target}% target.</p>
  </section>;
}

function ScheduleView({ day, setDay, calendar, onLesson, onCourse, reducedMotion }) {
  const timelineRef = useRef(null);
  const previousDay = useRef(day);
  const classes = TIMETABLE[day];
  const [now, setNow] = useState(() => new Date());
  const highlight = getScheduleHighlight(classes, day, now);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const clock = value => {
    const [hours, minutes] = value.split(':').map(Number);
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
  };

  useLayoutEffect(() => {
    if (previousDay.current === day) return;
    const direction = Math.sign(day - previousDay.current);
    previousDay.current = day;
    timelineRef.current.scrollTop = 0;
    const ctx = gsap.context(() => gsap.fromTo(timelineRef.current.children, { opacity: 0, x: reducedMotion ? 0 : direction * 14 }, { opacity: 1, x: 0, duration: reducedMotion ? 0 : .32, stagger: reducedMotion ? 0 : .035, ease: 'power2.out' }));
    return () => ctx.revert();
  }, [day, reducedMotion]);

  return <section className="schedule-view page-view" aria-label="Weekly timetable">
    <PageTitle title={day === calendar.todayIndex ? 'Today' : WEEKDAYS[day].name} subtitle={calendar.days[day].label} />
    <div className="week-selector" role="group" aria-label="Choose weekday">
      {WEEKDAYS.map((weekday, index) => <button type="button" key={weekday.short} aria-label={weekday.name} aria-description={calendar.days[index].label} aria-current={index === calendar.todayIndex ? 'date' : undefined} aria-pressed={day === index} onClick={() => setDay(index)} className={day === index ? 'is-active' : ''}><span>{weekday.short}</span><span className="weekday-date">{calendar.days[index].number}</span></button>)}
    </div>
    <div className="day-heading"><h2>{WEEKDAYS[day].name}</h2><span>{classes.length > 0 ? `${classes.length} ${classes.length === 1 ? 'class' : 'classes'} · ${formatDuration(classMinutes(classes))}` : PENDING_SUBJECTS.length ? 'Times pending' : 'No classes'}</span></div>
    <div className="timeline" ref={timelineRef} data-native-scroll role="region" aria-label={`${WEEKDAYS[day].name} classes`} tabIndex={0}>
      {classes.length === 0 && PENDING_SUBJECTS.length === 0 && <div className="schedule-empty"><CalendarSketch /><h3>No classes</h3><p>Nothing scheduled for this day.</p></div>}
      {classes.length > 0 && <div className="lesson-list">
      {classes.map((item, index) => {
        const subject = SUBJECTS.find(subject => subject.id === item.subject);
        const isNext = index === highlight.index;
        return <button key={`${day}-${item.subject}-${item.start}`} type="button" className={`lesson-row ${isNext ? 'is-next' : ''}`} onClick={() => onLesson({ ...subject, ...item, day })} aria-label={`${subject.fullName}, ${item.start} to ${item.end}, ${item.room}. View class details.`}>
            <span className="timeline-mark" aria-hidden="true"><span /></span>
            <span className="lesson-card">
              <span className="lesson-top"><strong>{subject.name}</strong><span className="lesson-time">{clock(item.start)}</span></span>
              <span className="lesson-description">{item.room}<span>Ends {clock(item.end)}</span></span>
              {isNext && <span className="lesson-footer"><span className="next-label">{highlight.label}</span><span className="lesson-open" aria-hidden="true"><Icon name="arrow" size={19} /></span></span>}
            </span>
          </button>;
      })}
      </div>}
      {PENDING_SUBJECTS.length > 0 && <div className="schedule-pending">
        <h3>Timetable pending</h3><p>Your courses are added. Class days, times and rooms are still to come.</p>
        <ul className="pending-course-list">{PENDING_SUBJECTS.map(subject => <li key={subject.id}><button type="button" className="pending-course" onClick={() => onCourse(subject)} aria-label={`View ${subject.fullName}, ${subject.code} course details`}><span><strong>{subject.fullName}</strong><span>{subject.code}{subject.section && ` · Section ${subject.section}`}</span></span><Icon name="chevron" size={17} /></button></li>)}</ul>
      </div>}
    </div>
  </section>;
}

function SettingsView({ preferences, update, reducedMotion, offlineStatus, onSaveOffline, standalone, onInstall, onReset, onAbout, onNotifications }) {
  return <section className="settings-view page-view" aria-label="App settings">
    <PageTitle title="Settings" subtitle="Make it yours." />
    <div className="settings-scroll" data-native-scroll>
      <button type="button" className="settings-action" onClick={onNotifications}><span><strong>Class reminders</strong><span>10 minutes before class · time and room</span></span><Icon name="bell" /></button>
      <div className="setting-block appearance-setting">
        <h2>Appearance</h2><p>Choose your semester's colors.</p>
        <div className="theme-selector" role="group" aria-label="App theme">
          {THEMES.map(theme => <button type="button" key={theme.id} className={`theme-option theme-preview-${theme.id} ${preferences.theme === theme.id ? 'is-active' : ''}`} aria-pressed={preferences.theme === theme.id} onClick={() => update({ theme: theme.id })}>
            <span className="theme-swatch" aria-hidden="true"><span /><i /></span><strong>{theme.name}</strong><span>{theme.description}</span>
          </button>)}
        </div>
      </div>
      <div className="setting-block target-setting">
        <div className="setting-heading"><label htmlFor="target-range">Attendance target</label><output htmlFor="target-range">{preferences.target}%</output></div>
        <input id="target-range" type="range" min="60" max="95" step="1" value={preferences.target} onChange={event => update({ target: Number(event.target.value) })} />
        <p>Your target applies to every subject.</p>
      </div>
      <div className="setting-block">
        <h2>Motion</h2><p>Keep the depth, or keep things still.</p>
        <div className="motion-selector" role="group" aria-label="Animation preference">{[['system', 'Auto'], ['full', 'Full'], ['reduced', 'Reduced']].map(([value, label]) => <button type="button" aria-pressed={preferences.motion === value} className={preferences.motion === value ? 'is-active' : ''} onClick={() => update({ motion: value })} key={value}>{label}</button>)}</div>
        <span className="setting-caption">{reducedMotion ? 'Reduced motion is on.' : 'Full depth animations are on.'}</span>
      </div>
      <div className="setting-block setting-inline"><div><h2>Offline access</h2><p role="status">{offlineStatus.state === 'ready' ? 'Ready offline · Timetable, course details and saved preferences are on this device.' : offlineStatus.state === 'preparing' ? 'Saving your app for offline use…' : 'Open online to finish saving your offline copy.'}</p>{offlineStatus.state === 'error' && <button type="button" className="text-button" onClick={onSaveOffline}>Save offline copy<Icon name="arrow" size={17} /></button>}</div><span className={`offline-dot ${offlineStatus.state === 'ready' ? 'ready' : ''}`} aria-label={offlineStatus.state === 'ready' ? 'Available offline' : 'Not ready yet'} /></div>
      <button type="button" className="settings-action" onClick={onInstall}><span><strong>{standalone ? 'Installed on this device' : 'Add to Home Screen'}</strong><span>{standalone ? 'Open UMT Everyday from your app icon.' : 'Your attendance, one tap away.'}</span></span><Icon name={standalone ? 'check' : 'download'} /></button>
      <div className="setting-block"><h2>Your data</h2><p>Your courses and weekly timetable match the details you provided. Attendance is sample data. Your UMT portal is not connected.</p><button type="button" className="text-button" onClick={onReset}>Reset demo preferences<Icon name="arrow" size={17} /></button></div>
      <button type="button" className="settings-action about-action" onClick={onAbout}><span><strong>UMT Everyday</strong><span>Version 0.2 · Personal demo</span></span><Icon name="chevron" size={20} /></button>
    </div>
  </section>;
}

function Overlay({ title, eyebrow, onClose, children, reducedMotion, className = '' }) {
  const overlayRef = useRef(null);
  const closeRef = useRef(null);
  const closing = useRef(false);
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    if (reducedMotion) onClose();
    else gsap.to(overlayRef.current, { opacity: 0, y: 12, scale: .99, duration: .24, ease: 'power2.in', onComplete: onClose });
  };
  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const ctx = gsap.context(() => gsap.fromTo(overlayRef.current, { opacity: 0, y: reducedMotion ? 0 : 18, scale: reducedMotion ? 1 : .975 }, { opacity: 1, y: 0, scale: 1, duration: reducedMotion ? 0 : .42, ease: 'power3.out' }));
    closeRef.current?.focus({ preventScroll: true });
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); }
      if (event.key === 'Tab') {
        const items = [...overlayRef.current.querySelectorAll('button:not(:disabled), input, a[href], select')];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { ctx.revert(); document.removeEventListener('keydown', key); previousFocus?.focus?.({ preventScroll: true }); };
  }, []);
  return <section className={`overlay-frame ${className}`} ref={overlayRef} role="dialog" aria-modal="true" aria-labelledby="overlay-title">
    <div className="overlay-top"><button type="button" className="icon-button" ref={closeRef} onClick={requestClose} aria-label="Close details"><Icon name="back" /></button><span>{eyebrow}</span></div>
    <h2 id="overlay-title">{title}</h2>
    {children}
  </section>;
}

function HistoryPanel({ subject, target, reducedMotion, onClose }) {
  const [filter, setFilter] = useState('All');
  const records = recordsFor(subject);
  const shown = records.filter(record => filter === 'All' || record.status === filter);
  const required = classesToTarget(subject.attended, subject.held, target);
  const allowance = absenceAllowance(subject.attended, subject.held, target);
  return <Overlay title={subject.name} eyebrow="Attendance history" onClose={onClose} reducedMotion={reducedMotion} className="history-panel">
    <p className="course-full-name">{subject.fullName}</p>
    <div className="history-summary"><div><strong>{Math.round(attendancePercent(subject.attended, subject.held))}%</strong><span>{subject.attended} of {subject.held} classes attended</span></div><span className="history-code">{subject.code}</span></div>
    <p className="target-insight">{required ? <>Attend the next <strong>{required} classes</strong> to reach {target}%.</> : <>Your {target}% target leaves room for <strong>{allowance} more {allowance === 1 ? 'absence' : 'absences'}</strong>.</>}</p>
    <div className="history-filter" role="group" aria-label="Filter attendance records">{['All', 'Present', 'Absent'].map(value => <button type="button" key={value} onClick={() => setFilter(value)} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value}>{value}<span>{value === 'All' ? records.length : records.filter(record => record.status === value).length}</span></button>)}</div>
    <div className="history-records" data-native-scroll aria-live="polite">
      {shown.map(record => <div className={`history-record ${record.status.toLowerCase()}`} key={record.id}><time dateTime={record.date}>{displayDate(record.date)}</time><span><i />{record.status}</span></div>)}
    </div>
    <p className="panel-footnote">Sample records · Each class counts equally.</p>
  </Overlay>;
}

function CoursePanel({ subject, onClose, reducedMotion, onSubject }) {
  return <Overlay title={subject.fullName} eyebrow="Course details" onClose={onClose} reducedMotion={reducedMotion} className="course-panel">
    <div className="course-info" data-native-scroll><dl className="lesson-facts"><div><dt>Course code</dt><dd>{subject.code}</dd></div><div><dt>Section</dt><dd>{subject.section || 'To be confirmed'}</dd></div><div><dt>Credit hours</dt><dd>{subject.creditHours ?? 'To be confirmed'}</dd></div><div><dt>Faculty</dt><dd>{subject.faculty || 'Not provided yet'}</dd></div><div><dt>Timetable</dt><dd>{PENDING_SUBJECTS.some(item => item.id === subject.id) ? 'Pending' : 'Added'}</dd></div></dl></div>
    <button type="button" className="primary-button" onClick={() => onSubject(subject.id)}>View attendance<Icon name="arrow" /></button>
    <p className="panel-footnote">Attendance figures are samples.</p>
  </Overlay>;
}

function LessonPanel({ lesson, onClose, reducedMotion, onSubject }) {
  return <Overlay title={lesson.name} eyebrow="Class details" onClose={onClose} reducedMotion={reducedMotion} className="lesson-panel">
    {lesson.fullName !== lesson.name && <p className="course-full-name">{lesson.fullName}</p>}
    <CalendarSketch />
    <p className="class-date">{WEEKDAYS[lesson.day].name} · Weekly timetable</p>
    <dl className="lesson-facts"><div><dt>Time</dt><dd>{lesson.start}–{lesson.end}</dd></div><div><dt>Location</dt><dd>{lesson.room}</dd></div><div><dt>Course</dt><dd>{lesson.code}</dd></div><div><dt>Teacher</dt><dd>{lesson.faculty || 'Not provided yet'}</dd></div></dl>
    <button type="button" className="primary-button" onClick={() => onSubject(lesson.id)}>View attendance<Icon name="arrow" /></button>
    <p className="panel-footnote">Weekly timetable · No changes to your portal.</p>
  </Overlay>;
}

function App() {
  const [launchLink] = useState(() => parseReminderLink(location.search));
  const [preferences, setPreferences] = useState(readPreferences);
  const [page, setPage] = useState(() => launchLink ? 'schedule' : 'attendance');
  const [calendar, setCalendar] = useState(getScheduleWeek);
  const [day, setDay] = useState(() => launchLink?.day ?? getScheduleWeek().todayIndex);
  const [panel, setPanel] = useState(() => launchLink?.lesson ? { type: 'lesson', lesson: launchLink.lesson } : null);
  const [offlineStatus, setOfflineStatus] = useState({ state: 'preparing' });
  const offlineRef = useRef(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [standalone, setStandalone] = useState(() => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
  const [toast, setToast] = useState('');
  const installPrompt = useRef(null);
  const shellRef = useRef(null);
  const routeRef = useRef(null);
  const previousPage = useRef(page);
  const toastTimer = useRef(null);
  const systemReduced = useSystemMotion();
  const reducedMotion = preferences.motion === 'reduced' || (preferences.motion === 'system' && systemReduced);
  const update = patch => setPreferences(previous => ({ ...previous, ...patch }));
  const notify = message => { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const updateViewport = () => {
      if (viewport?.scale > 1) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => document.documentElement.style.setProperty('--app-viewport-height', `${viewport?.height || innerHeight}px`));
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => { cancelAnimationFrame(frame); viewport?.removeEventListener('resize', updateViewport); window.removeEventListener('resize', updateViewport); document.documentElement.style.removeProperty('--app-viewport-height'); };
  }, []);

  useEffect(() => {
    if (page !== 'schedule') return;
    const refreshDate = () => {
      const current = getScheduleWeek();
      if (current.todayKey !== calendar.todayKey) {
        setCalendar(current);
        setDay(current.todayIndex);
      }
    };
    const timer = setInterval(refreshDate, 60000);
    document.addEventListener('visibilitychange', refreshDate);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refreshDate); };
  }, [page, calendar.todayKey]);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Preferences still work for this session. */ } }, [preferences]);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES.find(item => item.id === preferences.theme).background);
  }, [preferences.theme]);
  useEffect(() => {
    const observer = observeOffline(setOfflineStatus);
    offlineRef.current = observer;
    return () => { observer.dispose(); offlineRef.current = null; };
  }, []);
  useEffect(() => {
    const network = () => setOnline(navigator.onLine);
    const beforeInstall = event => { event.preventDefault(); installPrompt.current = event; };
    const installed = () => { setStandalone(true); installPrompt.current = null; notify('Added to your Home Screen.'); };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      clearTimeout(toastTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    const ctx = gsap.context(() => gsap.fromTo(routeRef.current, { opacity: 0, y: reducedMotion ? 0 : 12 }, { opacity: 1, y: 0, duration: reducedMotion ? 0 : .35, ease: 'power2.out', onComplete: () => routeRef.current?.querySelector('.attendance-view')?.dispatchEvent(new Event('route-settled')) }));
    return () => ctx.revert();
  }, [page, reducedMotion]);

  const navigate = destination => {
    if (destination === 'schedule') {
      const current = getScheduleWeek();
      setCalendar(current);
      setDay(current.todayIndex);
    }
    setPanel(null);
    setPage(destination);
  };
  const showSubject = id => { update({ subject: SUBJECTS.findIndex(subject => subject.id === id) }); navigate('attendance'); };
  const install = async () => {
    if (standalone) { notify('Already installed on this device.'); return; }
    if (installPrompt.current) {
      await installPrompt.current.prompt();
      await installPrompt.current.userChoice;
      installPrompt.current = null;
    } else setPanel({ type: 'install' });
  };

  return <div className={`app-shell ${reducedMotion ? 'reduced-motion' : ''} route-${page}`} ref={shellRef}>
    <div className="ambient-blue" aria-hidden="true" />
    {page !== 'schedule' && <header className="app-brand"><button type="button" className="wordmark" onClick={() => navigate('attendance')} aria-label="UMT Everyday attendance">UMT<span>.</span></button><span>Fall 2026</span></header>}
    {!online && <div className="network-note" role="status">Offline · Your saved data is available.</div>}
    <main className="route-content" ref={routeRef}>
      <AttendanceView active={page === 'attendance'} selectedIndex={preferences.subject} onSelect={subject => update({ subject })} target={preferences.target} reducedMotion={reducedMotion} onHistory={subject => setPanel({ type: 'history', subject })} shellRef={shellRef} />
      {page === 'schedule' && <ScheduleView day={day} setDay={setDay} calendar={calendar} reducedMotion={reducedMotion} onLesson={lesson => setPanel({ type: 'lesson', lesson })} onCourse={subject => setPanel({ type: 'course', subject })} />}
      {page === 'settings' && <SettingsView preferences={preferences} update={update} reducedMotion={reducedMotion} offlineStatus={offlineStatus} onSaveOffline={() => offlineRef.current?.refresh()} standalone={standalone} onInstall={install} onReset={() => { setPreferences({ ...DEFAULTS }); notify('Demo preferences reset.'); }} onAbout={() => setPanel({ type: 'about' })} onNotifications={() => setPanel({ type: 'notifications' })} />}
    </main>
    <BottomDock page={page} onNavigate={navigate} reducedMotion={reducedMotion} />
    {panel?.type === 'history' && <HistoryPanel subject={panel.subject} target={preferences.target} reducedMotion={reducedMotion} onClose={() => setPanel(null)} />}
    {panel?.type === 'lesson' && <LessonPanel lesson={panel.lesson} reducedMotion={reducedMotion} onClose={() => setPanel(null)} onSubject={showSubject} />}
    {panel?.type === 'course' && <CoursePanel subject={panel.subject} reducedMotion={reducedMotion} onClose={() => setPanel(null)} onSubject={showSubject} />}
    {panel?.type === 'notifications' && <Overlay title="Class reminders" eyebrow="Notifications" reducedMotion={reducedMotion} onClose={() => setPanel(null)} className="notification-panel"><NotificationPanel onInstall={() => setPanel({ type: 'install' })} /></Overlay>}
    {panel?.type === 'install' && <Overlay title="One tap away." eyebrow="Add to Home Screen" reducedMotion={reducedMotion} onClose={() => setPanel(null)} className="install-panel"><Icon name="download" size={48} /><p>Keep your attendance and timetable beside your other apps.</p><ol><li>Open this page in <strong>Safari</strong> on your iPhone.</li><li>Tap <Icon name="share" size={18} /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>. Open UMT Everyday from its new icon.</li></ol><p className="panel-footnote">On other browsers, look for Install app in the browser menu. Load the demo once online before using it offline.</p></Overlay>}
    {panel?.type === 'about' && <Overlay title="Your semester, at a glance." eyebrow="UMT Everyday" reducedMotion={reducedMotion} onClose={() => setPanel(null)} className="about-panel"><img className="about-pass" src="/attendance-pass.png" alt="UMT attendance pass" /><p>A personal attendance companion, made for your day.</p><p>Your registered courses and weekly timetable are added. Attendance records are samples. Preferences stay on this device. No portal credentials are collected.</p><span className="version-label">Version 0.2.0</span></Overlay>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
