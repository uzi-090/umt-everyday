import { gsap } from 'gsap';
import { createCourseScroller } from './courseRail.js';

const wrap = (value, length) => ((value % length) + length) % length;
const relative = (value, length) => wrap(value + length / 2, length) - length / 2;

/** One continuous scene: position, scale and depth-of-field share the same cursor. */
export function createDepthCarousel({ surface, stage, world, layers, shell, initialIndex, reducedMotion, onIndex, onDragState }) {
  const cursor = { position: initialIndex };
  const count = layers.length;
  const rail = surface.querySelector('[data-course-rail]');
  const railButtons = [...rail.querySelectorAll('.subject-cycle[data-primary] button')];
  const railViewport = rail.querySelector('.subject-viewport');
  let focusRailAfter = false;
  let railSelectionTarget = null;
  let geometry = null;
  let selected = initialIndex;
  let drag = null;
  let wheelEnd = null;
  let wheelTarget = initialIndex;
  let wheelStart = initialIndex;
  let wheelDelta = 0;
  let lastWheel = 0;
  let suppressClickUntil = 0;
  let disposed = false;
  let active = true;

  const draw = () => {
    if (!geometry || disposed || !active) return;
    const index = wrap(Math.round(cursor.position), count);
    if (index !== selected) { selected = index; onIndex(index); }
    layers.forEach((element, i) => {
      const distance = relative(i - cursor.position, count);
      const magnitude = Math.abs(distance);
      const settled = reducedMotion || magnitude < .0001;
      const pixelRatio = window.devicePixelRatio || 1;
      const snap = value => Math.round(value * pixelRatio) / pixelRatio;
      const x = geometry.x - geometry.width / 2;
      const y = geometry.y + distance * geometry.step - geometry.height / 2;
      const offsetX = geometry.originX + geometry.canvasOffsetX;
      const offsetY = geometry.originY + Number(element.style.getPropertyValue('--glyph-inset').replace('px', '') || 0);
      const positionX = settled ? snap(x + offsetX) - offsetX : x;
      const positionY = settled ? snap(y + offsetY) - offsetY : y;
      let opacity = Math.max(0, 1 - Math.min(magnitude, 1) * .79);
      if (magnitude > 1) opacity *= Math.max(0, 1 - (magnitude - 1) * 1.5);
      if (reducedMotion) opacity = i === index ? 1 : 0;
      gsap.set(element, {
        x: positionX,
        y: positionY,
        xPercent: 0,
        yPercent: 0,
        z: reducedMotion ? 0 : -Math.min(magnitude, 2) * 75,
        scale: reducedMotion ? 1 : 1 - Math.min(magnitude, 1.8) * .14,
        rotationX: reducedMotion ? 0 : distance * -2,
        opacity,
        filter: reducedMotion || magnitude < .0001 ? 'none' : `blur(${Math.min(magnitude * 11, 18).toFixed(2)}px)`,
        zIndex: 20 - Math.round(magnitude * 5),
        force3D: magnitude >= .0001 && !reducedMotion,
      });
      element.dataset.focused = i === index ? 'true' : 'false';
      element.dataset.distance = distance.toFixed(4);
      if (settled && i === index) {
        // Resolve the browser's own fractional CSS layout rounding at rest.
        const rendered = element.querySelector('.student-pass').getBoundingClientRect();
        gsap.set(element, { x: positionX + snap(rendered.left) - rendered.left, y: positionY + snap(rendered.top) - rendered.top });
      }
    });
    railScroller.sync(railSelectionTarget ?? index);
    world.dispatchEvent(new Event('depthframe'));
  };

  const measure = () => {
    const rect = stage.getBoundingClientRect();
    const backdrop = world.getBoundingClientRect();
    if (!active || !rect.width || !rect.height) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const snap = value => Math.round(value * pixelRatio) / pixelRatio;
    const height = snap(Math.min(188, rect.height * .90));
    const passHeight = snap(Math.min(112, height * .60));
    const passWidth = snap(passHeight * 5 / 6);
    const width = snap(Math.min(rect.width * .655, 256));
    geometry = {
      x: rect.left - backdrop.left + width / 2 - 1,
      y: rect.top - backdrop.top + rect.height * .49,
      step: shell.clientHeight * .55,
      railRow: parseFloat(getComputedStyle(rail).getPropertyValue('--rail-row')),
      width, height,
      originX: backdrop.left, originY: backdrop.top, canvasOffsetX: (width - passWidth) / 2,
    };
    layers.forEach(node => {
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
      node.style.setProperty('--pass-height', `${passHeight}px`);
      node.style.setProperty('--pass-width', `${passWidth}px`);
      const gap = shell.clientHeight <= 600 ? 5 : 9;
      const numbersHeight = node.querySelector('.glyph-numbers').offsetHeight;
      node.style.setProperty('--glyph-inset', `${Math.max(0, snap((height - passHeight - gap - numbersHeight) / 2))}px`);
    });
    railScroller.sync(selected, true);
    draw();
  };

  const settle = (target, speed = .5) => {
    gsap.killTweensOf(cursor);
    wheelTarget = target;
    gsap.to(cursor, {
      position: target,
      duration: reducedMotion ? 0 : speed,
      ease: 'power3.out',
      onUpdate: draw,
      onComplete: () => {
        const rounded = Math.round(cursor.position);
        cursor.position = wrap(rounded, count);
        wheelTarget = cursor.position;
        railSelectionTarget = null;
        draw();
        if (focusRailAfter) { railButtons[selected].focus({ preventScroll: true }); focusRailAfter = false; }
      },
    });
  };

  const goTo = index => {
    clearTimeout(wheelEnd);
    railScroller.release();
    railSelectionTarget = index;
    railScroller.sync(index);
    const delta = relative(index - cursor.position, count);
    settle(cursor.position + delta);
  };

  const canDrag = target => !target.closest('button:not([data-drag-surface]), a, input, select, [data-native-scroll]');
  const pointerDown = event => {
    if (!active || !geometry || event.isPrimary === false || event.button !== 0 || !canDrag(event.target)) return;
    clearTimeout(wheelEnd);
    gsap.killTweensOf(cursor);
    railSelectionTarget = null;
    const step = Math.min(geometry.step, Math.max(140, stage.clientHeight * .9));
    drag = { id: event.pointerId, initialY: event.clientY, lastY: event.clientY, initialPosition: cursor.position, lastTime: performance.now(), velocity: 0, moved: false, step };
  };
  const pointerMove = event => {
    if (!drag || drag.id !== event.pointerId || !geometry) return;
    const now = performance.now();
    const elapsed = Math.max(8, now - drag.lastTime);
    const delta = event.clientY - drag.initialY;
    drag.velocity = drag.velocity * .25 + ((event.clientY - drag.lastY) / elapsed) * .75;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    if (Math.abs(delta) > 5 && !drag.moved) {
      drag.moved = true;
      onDragState?.(true);
      try { surface.setPointerCapture(event.pointerId); } catch { /* Keep tracking on the surface. */ }
    }
    if (drag.moved) {
      cursor.position = drag.initialPosition - delta / drag.step;
      draw();
      event.preventDefault();
    }
  };
  const pointerUp = event => {
    if (!drag || drag.id !== event.pointerId) return;
    const previous = drag;
    drag = null;
    if (surface.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    if (!previous.moved) return;
    onDragState?.(false);
    suppressClickUntil = performance.now() + 350;
    const velocity = performance.now() - previous.lastTime < 100 ? previous.velocity : 0;
    const impulse = Math.max(-1.1, Math.min(1.1, -velocity * 135 / previous.step));
    let target = Math.round(cursor.position + impulse);
    if (target === Math.round(previous.initialPosition) && Math.abs(cursor.position - previous.initialPosition) > .16) {
      target += Math.sign(cursor.position - previous.initialPosition);
    }
    settle(target, .7);
  };
  const pointerCancel = event => {
    if (drag?.id === event.pointerId) { drag = null; onDragState?.(false); settle(Math.round(cursor.position), .45); }
  };
  const wheel = event => {
    if (!active || !geometry || event.ctrlKey || event.target.closest('[data-native-scroll]')) return;
    railSelectionTarget = null;
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 230) { wheelStart = cursor.position; wheelTarget = cursor.position; wheelDelta = 0; }
    lastWheel = now;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 250 : 1);
    wheelDelta += delta;
    wheelTarget += delta / (event.target.closest('[data-course-rail]') ? 120 : 330);
    gsap.to(cursor, { position: wheelTarget, duration: reducedMotion ? 0 : .2, ease: 'power2.out', overwrite: true, onUpdate: draw });
    clearTimeout(wheelEnd);
    wheelEnd = setTimeout(() => {
      let target = Math.round(wheelTarget);
      if (target === Math.round(wheelStart) && Math.abs(wheelDelta) > 35) target += Math.sign(wheelDelta);
      settle(target);
    }, 150);
  };
  const key = event => {
    if (event.target.closest('input, select')) return;
    if (['Home', 'End'].includes(event.key)) {
      event.preventDefault();
      focusRailAfter = Boolean(event.target.closest('[data-course-rail]'));
      goTo(event.key === 'Home' ? 0 : count - 1);
      return;
    }
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    focusRailAfter = Boolean(event.target.closest('[data-course-rail]'));
    railScroller.release();
    railSelectionTarget = null;
    settle(Math.round(wheelTarget) + direction);
  };

  const railScroller = createCourseScroller({
    viewport: railViewport, count, reducedMotion,
    rowHeight: () => geometry?.railRow || 0,
    onPosition(position) {
      clearTimeout(wheelEnd);
      gsap.killTweensOf(cursor);
      railSelectionTarget = null;
      cursor.position = position;
      wheelTarget = position;
      draw();
    },
    onSettled(index) { settle(cursor.position + relative(index - cursor.position, count), .2); },
    animate(motion, position, duration, onUpdate, onComplete) { gsap.to(motion, { position, duration, ease: 'power3.out', overwrite: true, onUpdate, onComplete }); },
    stopAnimation(motion) { gsap.killTweensOf(motion); },
  });
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(stage);
  surface.addEventListener('route-settled', measure);
  surface.addEventListener('pointerdown', pointerDown);
  surface.addEventListener('pointermove', pointerMove, { passive: false });
  surface.addEventListener('pointerup', pointerUp);
  surface.addEventListener('pointercancel', pointerCancel);
  surface.addEventListener('lostpointercapture', pointerCancel);
  surface.addEventListener('wheel', wheel, { passive: false });
  surface.addEventListener('keydown', key);

  return {
    goTo,
    setActive(value) {
      active = value;
      railScroller.setActive(value);
      if (active) measure();
      else {
        clearTimeout(wheelEnd);
        gsap.killTweensOf(cursor);
        cursor.position = selected;
        wheelTarget = selected;
        drag = null;
        onDragState?.(false);
      }
    },
    syncIndex(index) {
      if (selected === index) return;
      clearTimeout(wheelEnd);
      gsap.killTweensOf(cursor);
      cursor.position += relative(index - cursor.position, count);
      wheelTarget = cursor.position;
      draw();
    },
    suppressClick: () => performance.now() < suppressClickUntil,
    dispose() {
      disposed = true;
      railScroller.dispose();
      observer.disconnect();
      surface.removeEventListener('route-settled', measure);
      clearTimeout(wheelEnd);
      gsap.killTweensOf(cursor);
      surface.removeEventListener('pointerdown', pointerDown);
      surface.removeEventListener('pointermove', pointerMove);
      surface.removeEventListener('pointerup', pointerUp);
      surface.removeEventListener('pointercancel', pointerCancel);
      surface.removeEventListener('lostpointercapture', pointerCancel);
      surface.removeEventListener('wheel', wheel);
      surface.removeEventListener('keydown', key);
    },
  };
}
