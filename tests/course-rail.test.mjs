import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseScroller, railPosition, centeredRailTop, nearestCourse, wrapCourse, RAIL_CENTER } from '../src/courseRail.js';
import { SUBJECTS } from '../src/data.js';
import { THEMES, validTheme } from '../src/themes.js';

class Viewport extends EventTarget {
  scrollTop = 0;
  clientHeight = 176;
  style = {};
  calls = [];
  scrollTo(options) { this.calls.push(options); this.scrollTop = options.top; this.dispatchEvent(new Event('scroll')); }
  swipeTo(top) { this.scrollTop = top; this.dispatchEvent(new Event('scroll')); }
}
const idle = () => new Promise(resolve => setTimeout(resolve, 190));

test('every course and circular boundary retains four filled flat rows without end padding', () => {
  for (let position = -40; position <= 40; position++) {
    const top = centeredRailTop(position, 44, SUBJECTS.length);
    assert.equal(railPosition(top, 44, 8), wrapCourse(position, 8));
    const first = Math.round(top / 44);
    const visible = Array.from({ length: 4 }, (_, row) => wrapCourse(first + row, 8));
    assert.equal(new Set(visible).size, 4);
    assert.equal(visible[1], wrapCourse(position, 8));
  }
  assert.equal(nearestCourse(0, 7, 8), 8);
  assert.equal(nearestCourse(7, 0, 8), -1);
  assert.equal(railPosition(centeredRailTop(2.5, 44, 8), 44, 8), 2.5);
});

test('native swiping continues through pointercancel and does not fight the finger or momentum', async () => {
  const viewport = new Viewport();
  const positions = [], settled = [];
  const scroller = createCourseScroller({ viewport, count: 8, rowHeight: () => 44,
    onPosition(position) { positions.push(position); scroller.sync(Math.round(position)); },
    onSettled: index => settled.push(index),
  });
  scroller.sync(0, true);
  const start = centeredRailTop(0, 44, 8);
  viewport.dispatchEvent(new Event('touchstart'));
  viewport.swipeTo(start + 44);
  viewport.dispatchEvent(new Event('pointercancel'));
  viewport.swipeTo(start + 110);
  await idle();
  assert.deepEqual(positions, [1, 2.5]);
  assert.equal(viewport.calls.length, 1, 'do not rebase while the finger is still down');
  viewport.dispatchEvent(new Event('touchend'));
  viewport.swipeTo(start + 11 * 44);
  await idle();
  assert.deepEqual(positions.slice(0, 3), [1, 2.5, 11]);
  assert.deepEqual(settled, [3]);
  assert.equal(viewport.scrollTop, centeredRailTop(3, 44, 8));
  scroller.dispose();
});

test('tap selection scrolls to its course without feeding programmatic scroll back into selection', async () => {
  const viewport = new Viewport();
  const positions = [], settled = [];
  const scroller = createCourseScroller({ viewport, count: 8, rowHeight: () => 44, onPosition: p => positions.push(p), onSettled: p => settled.push(p) });
  scroller.sync(5, true);
  await idle();
  assert.equal(viewport.scrollTop, centeredRailTop(5, 44, 8));
  assert.deepEqual(positions, []);
  assert.deepEqual(settled, []);
  viewport.dispatchEvent(new Event('pointerdown'));
  viewport.swipeTo(centeredRailTop(3, 44, 8));
  scroller.release();
  scroller.sync(1);
  await idle();
  assert.deepEqual(positions, [3]);
  assert.equal(viewport.scrollTop, centeredRailTop(1, 44, 8));
  assert.deepEqual(settled, []);
  scroller.dispose();
});

test('hidden and disposed course lists stop selection updates, and reduced motion uses immediate scrolling', () => {
  const viewport = new Viewport();
  const positions = [];
  const scroller = createCourseScroller({ viewport, count: 8, rowHeight: () => 44, reducedMotion: true, onPosition: p => positions.push(p), onSettled() {} });
  scroller.sync(7);
  assert.equal(viewport.calls[0].behavior, 'auto');
  scroller.setActive(false);
  viewport.swipeTo(44);
  assert.deepEqual(positions, []);
  scroller.dispose();
  viewport.swipeTo(88);
  assert.deepEqual(positions, []);
});

test('mouse wheel eases through many full laps in both directions without hitting an end', async () => {
  const viewport = new Viewport();
  const positions = [], settled = [], durations = [];
  const scroller = createCourseScroller({ viewport, count: 8, rowHeight: () => 44, onPosition: p => positions.push(p), onSettled: p => settled.push(p),
    animate(motion, position, duration, update, complete) { durations.push(duration); motion.position = position; update(); complete(); },
  });
  scroller.sync(0, true);
  const wheel = amount => {
    const event = new Event('wheel', { cancelable: true });
    Object.assign(event, { deltaY: amount, deltaX: 0, deltaMode: 0, ctrlKey: false });
    viewport.dispatchEvent(event);
    assert(event.defaultPrevented);
  };
  for (let i = 0; i < 80; i++) wheel(120);
  await idle();
  assert.equal(settled.at(-1), 0);
  assert.equal(viewport.scrollTop, centeredRailTop(0, 44, 8));
  for (let i = 0; i < 81; i++) wheel(-120);
  await idle();
  assert.equal(settled.at(-1), 7);
  assert.equal(viewport.scrollTop, centeredRailTop(7, 44, 8));
  assert(durations.includes(.2) && durations.includes(.42));
  assert(positions.length >= 161);
  assert(RAIL_CENTER > 1);
  scroller.dispose();
});

test('fourth appearance preserves original theme identities and validates saved preferences', () => {
  assert.deepEqual(THEMES.map(theme => theme.id), ['electric', 'porcelain', 'burgundy', 'carbon']);
  assert.equal(validTheme('carbon'), 'carbon');
  assert.equal(validTheme('unknown'), 'electric');
});
