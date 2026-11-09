import React, { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Icon } from './Artwork.jsx';
import './bottomDock.css';

const DESTINATIONS = [
  { id: 'attendance', label: 'Attendance', icon: 'home' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function BottomDock({ page, onNavigate, reducedMotion }) {
  const dockRef = useRef(null);
  const lensRef = useRef(null);
  const echoRef = useRef(null);
  const previousPage = useRef(null);
  const layoutRef = useRef(null);

  // Measure the real label so the expanded pill fits at every screen width.
  layoutRef.current = animate => {
    const dock = dockRef.current;
    if (!dock) return;
    const buttons = [...dock.querySelectorAll('.dock-tab')];
    const labels = buttons.map(button => button.querySelector('.dock-label'));
    const textWidths = buttons.map(button => button.querySelector('.dock-label-text').getBoundingClientRect().width);
    const activeIndex = DESTINATIONS.findIndex(item => item.id === page);
    const inset = parseFloat(getComputedStyle(dock).paddingLeft);
    const available = dock.clientWidth - inset * 2;
    const iconWidth = buttons[activeIndex].querySelector('svg').getBoundingClientRect().width;
    const activeWidth = Math.min(available - 88, Math.max(available * .44, textWidths[activeIndex] + iconWidth + 28));
    const collapsedWidth = (available - activeWidth) / 2;
    const widths = buttons.map((_, index) => index === activeIndex ? activeWidth : collapsedWidth);
    const x = widths.slice(0, activeIndex).reduce((total, width) => total + width, 0);
    const lens = lensRef.current;
    const echo = echoRef.current;
    gsap.killTweensOf([...buttons, ...labels, lens, echo]);

    if (!animate || reducedMotion) {
      buttons.forEach((button, index) => gsap.set(button, { width: widths[index] }));
      labels.forEach((label, index) => gsap.set(label, { width: index === activeIndex ? textWidths[index] : 0, opacity: index === activeIndex ? 1 : 0 }));
      gsap.set(lens, { x, width: activeWidth, scaleY: 1, opacity: 1 });
      gsap.set(echo, { opacity: 0 });
      return;
    }

    const oldX = Number(gsap.getProperty(lens, 'x'));
    const oldWidth = Number(gsap.getProperty(lens, 'width'));
    const incoming = buttons[activeIndex].getBoundingClientRect();
    const incomingX = incoming.left - dock.getBoundingClientRect().left - dock.clientLeft - inset;
    gsap.set(echo, { x: oldX, width: oldWidth, opacity: .16 });
    gsap.to(echo, { opacity: 0, duration: .2, ease: 'power2.out' });
    gsap.set(lens, { x: incomingX, width: incoming.width, opacity: .75 });
    buttons.forEach((button, index) => gsap.to(button, { width: widths[index], duration: .36, ease: 'power3.out' }));
    labels.forEach((label, index) => {
      const active = index === activeIndex;
      gsap.to(label, { width: active ? textWidths[index] : 0, duration: .36, ease: 'power3.out' });
      gsap.to(label, { opacity: active ? 1 : 0, delay: active ? .08 : 0, duration: active ? .2 : .1, ease: 'power2.out' });
    });
    gsap.to(lens, { x, width: activeWidth, opacity: 1, duration: .36, ease: 'power3.out' });
    gsap.fromTo(lens, { scaleY: .97 }, { scaleY: 1, duration: .38, ease: 'elastic.out(1, .6)' });
  };

  useLayoutEffect(() => {
    const dock = dockRef.current;
    let width = dock.clientWidth;
    layoutRef.current(false);
    const observer = new ResizeObserver(() => {
      if (Math.abs(dock.clientWidth - width) < .25) return;
      width = dock.clientWidth;
      layoutRef.current(false);
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
      gsap.killTweensOf([lensRef.current, echoRef.current, ...dock.querySelectorAll('.dock-tab, .dock-label')]);
    };
  }, []);

  useLayoutEffect(() => {
    layoutRef.current(previousPage.current !== null && previousPage.current !== page);
    previousPage.current = page;
  }, [page, reducedMotion]);

  const handleKeys = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = DESTINATIONS.findIndex(item => item.id === page);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
    dockRef.current.querySelectorAll('.dock-tab')[next].focus();
    onNavigate(DESTINATIONS[next].id);
  };

  return <nav className="bottom-dock liquid-dock" aria-label="Main navigation" ref={dockRef} onKeyDown={handleKeys}>
    <span className="dock-echo" ref={echoRef} aria-hidden="true" />
    <span className="dock-lens" ref={lensRef} aria-hidden="true" />
    {DESTINATIONS.map(item => <button type="button" key={item.id} className={`dock-tab ${page === item.id ? 'is-active' : ''}`} onClick={() => onNavigate(item.id)} aria-label={item.label} aria-current={page === item.id ? 'page' : undefined} title={item.label}>
      <Icon name={item.icon} size={20} />
      <span className="dock-label" aria-hidden="true"><span className="dock-label-text">{item.label}</span></span>
    </button>)}
  </nav>;
}
