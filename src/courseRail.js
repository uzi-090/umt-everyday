export const RAIL_COPIES = 21;
export const RAIL_CENTER = Math.floor(RAIL_COPIES / 2);
export const wrapCourse = (value, count) => ((value % count) + count) % count;
export const railPosition = (top, row, count) => top / row + 1 - RAIL_CENTER * count;
export const centeredRailTop = (position, row, count) => (RAIL_CENTER * count + wrapCourse(position, count) - 1) * row;
export const nearestCourse = (index, position, count) => position + wrapCourse(index - position + count / 2, count) - count / 2;

// Touch keeps native momentum. Repeating bands are recentered only after it rests.
// Mouse-wheel and tap animations move a continuous cursor through the same bands.
export function createCourseScroller({ viewport, count, rowHeight, onPosition, onSettled, reducedMotion, animate, stopAnimation = () => {} }) {
  const motion = { position: 0 };
  let active = true;
  let mode = 'idle';
  let touching = false;
  let target = null;
  let expectedTop = null;
  let idle;
  let lastWheel = 0;
  let wheelTarget = 0;
  const restoreSnap = () => { viewport.style.scrollSnapType = ''; };
  const paint = notify => {
    viewport.scrollTo({ top: centeredRailTop(motion.position, rowHeight(), count), behavior: 'auto' });
    expectedTop = viewport.scrollTop;
    if (notify) onPosition(motion.position);
  };
  const finish = notify => {
    const index = wrapCourse(Math.round(motion.position), count);
    restoreSnap();
    mode = 'idle';
    target = null;
    if (notify) onSettled(index);
  };
  const moveTo = (position, duration, notify, complete) => {
    stopAnimation(motion);
    viewport.style.scrollSnapType = 'none';
    const update = () => paint(notify);
    if (reducedMotion || !animate || !duration) {
      motion.position = position;
      update();
      complete();
    } else animate(motion, position, duration, update, complete);
  };
  const settle = position => {
    mode = 'settling';
    moveTo(position, .42, true, () => finish(true));
  };
  const afterNativeScroll = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!active || touching || mode !== 'native') return;
      motion.position = railPosition(viewport.scrollTop, rowHeight(), count);
      settle(Math.round(motion.position));
    }, 160);
  };
  const release = () => {
    clearTimeout(idle);
    stopAnimation(motion);
    restoreSnap();
    mode = 'idle';
    target = null;
    expectedTop = null;
  };
  const scroll = () => {
    if (!active || !rowHeight() || ['programmatic', 'wheel', 'settling'].includes(mode)) return;
    if (expectedTop !== null && Math.abs(viewport.scrollTop - expectedTop) < .75) return;
    expectedTop = null;
    mode = 'native';
    motion.position = railPosition(viewport.scrollTop, rowHeight(), count);
    onPosition(motion.position);
    afterNativeScroll();
  };
  const interrupt = () => { if (active) release(); };
  const touchStart = () => { touching = true; interrupt(); };
  const touchEnd = event => { touching = Boolean(event.touches?.length); afterNativeScroll(); };
  const wheel = event => {
    if (!active || !rowHeight() || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    clearTimeout(idle);
    const now = performance.now();
    if (mode !== 'wheel' || now - lastWheel > 240) {
      stopAnimation(motion);
      motion.position = railPosition(viewport.scrollTop, rowHeight(), count);
      wheelTarget = motion.position;
    }
    lastWheel = now;
    mode = 'wheel';
    target = null;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
    wheelTarget += delta / 120;
    moveTo(wheelTarget, .2, true, () => {});
    idle = setTimeout(() => { if (active && mode === 'wheel') settle(Math.round(wheelTarget)); }, 150);
  };
  viewport.addEventListener('scroll', scroll, { passive: true });
  viewport.addEventListener('pointerdown', interrupt, { passive: true });
  viewport.addEventListener('touchstart', touchStart, { passive: true });
  viewport.addEventListener('touchend', touchEnd, { passive: true });
  viewport.addEventListener('touchcancel', touchEnd, { passive: true });
  viewport.addEventListener('wheel', wheel, { passive: false });
  return {
    release,
    sync(index, immediate = false) {
      if (!active || !rowHeight() || ['native', 'wheel', 'settling'].includes(mode)) return;
      if (!immediate && target === index) return;
      if (immediate) {
        mode = 'programmatic';
        motion.position = index;
        viewport.style.scrollSnapType = 'none';
        paint(false);
        finish(false);
        return;
      }
      motion.position = railPosition(viewport.scrollTop, rowHeight(), count);
      const destination = nearestCourse(index, motion.position, count);
      if (Math.abs(destination - motion.position) < .001) return;
      target = index;
      mode = 'programmatic';
      moveTo(destination, .5, false, () => finish(false));
    },
    setActive(value) { release(); touching = false; active = value; },
    dispose() {
      active = false;
      release();
      viewport.removeEventListener('scroll', scroll);
      viewport.removeEventListener('pointerdown', interrupt);
      viewport.removeEventListener('touchstart', touchStart);
      viewport.removeEventListener('touchend', touchEnd);
      viewport.removeEventListener('touchcancel', touchEnd);
      viewport.removeEventListener('wheel', wheel);
    },
  };
}
