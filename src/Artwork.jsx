import React from 'react';

export function AcademicGlyph({ variant = 'classic' }) {
  return (
    <svg className="academic-glyph" viewBox="0 0 260 330" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M82 105C44 117 20 149 21 188C21 232 43 256 81 267C95 271 91 284 101 284C112 284 109 266 120 267C132 269 126 292 132 301C137 308 148 304 149 292L151 269C188 258 211 228 211 190C211 159 197 134 180 121" />
        <path d="M83 104L44 79L136 29L229 77L197 96" />
        <path d="M88 76C120 66 153 72 193 88L181 121C153 107 119 101 82 103Z" />
        <path d="M222 80V137M222 137L214 162Q224 166 230 162Z" />
        {variant === 'code' ? <><path d="M98 142L91 150L97 158" /><path d="M148 143L155 151L148 158" /></> : variant === 'orbit' ? <><circle cx="97" cy="150" r="4" /><circle cx="150" cy="150" r="4" /></> : <><path d="M98 142L96 158" /><path d="M149 143L147 159" /></>}
      </g>
    </svg>
  );
}

export function Icon({ name, size = 24, ...props }) {
  const paths = {
    home: <path d="M3 10.5L12 3L21 10.5V21H15V14H9V21H3Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3V7M17 3V7M3 10H21M7 14H8M12 14H13M17 14H18M7 18H8M12 18H13" /></>,
    settings: <><path d="M9.5 3L10 1.8H14L14.5 4L17 5.5L19.2 5L21.2 8.5L19.5 10V13L21.2 15L19.2 18.5L17 18L14.5 19.5L14 22H10L9.5 19.5L7 18L4.8 18.5L2.8 15L4.5 13V10L2.8 8.5L4.8 5L7 5.5Z" /><circle cx="12" cy="12" r="3.5" /></>,
    arrow: <path d="M4 12H20M13 5L20 12L13 19" />,
    back: <path d="M20 12H4M11 5L4 12L11 19" />,
    close: <path d="M6 6L18 18M18 6L6 18" />,
    check: <path d="M5 12L10 17L20 7" />,
    bell: <><path d="M18 8A6 6 0 0 0 6 8C6 15 3 15 3 17H21C21 15 18 15 18 8ZM10 21H14" /></>,
    download: <><path d="M12 3V15M7 10L12 15L17 10M4 16V21H20V16" /></>,
    share: <><path d="M12 15V2M7 7L12 2L17 7M7 10H4V22H20V10H17" /></>,
    chevron: <path d="M9 5L16 12L9 19" />,
    wifi: <><path d="M3 8C8 3 16 3 21 8M6 12C9 9 15 9 18 12M9 16C11 14 13 14 15 16" /><circle cx="12" cy="20" r="1" fill="currentColor" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}

export function CalendarSketch() {
  return <svg className="calendar-sketch" viewBox="0 0 80 72" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 19Q10 13 17 13L56 9Q64 9 64 16L67 55Q68 62 61 63L19 67Q12 68 12 60Z" /><path d="M22 6L24 23M49 3L51 20M12 31L65 26M70 15L77 8M72 28L79 26" /><path d="M25 39H28V42H25ZM42 37H45V40H42ZM25 51H28V54H25ZM43 49H46V52H43ZM55 36H58V39H55ZM56 48H59V51H56Z" fill="currentColor" /></g></svg>;
}
