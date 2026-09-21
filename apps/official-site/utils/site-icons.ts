// Trusted, local SVG paths. Never populated from a network response.
export const siteIcons: Record<string, string> = {
  star: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="m20 2 .7 2.3L23 5l-2.3.7L20 8l-.7-2.3L17 5l2.3-.7Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v16c3-1 6-1 10 1 4-2 7-2 10-1V4c-2-1-6-2-10 1Zm0 0v16"/>',
  repeat:
    '<path d="m17 2 4 4-4 4M3 10V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3"/>',
  headphones:
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/>',
  pen: '<path d="m15 4 5 5M4 20l5-1L21 7l-4-4L5 15Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone:
    '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
  monitor:
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-5 0h10"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
  moon: '<path d="M21 14A9 9 0 0 1 10 3 9 9 0 1 0 21 14Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  cup: '<path d="M4 9h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm13 1h2a3 3 0 0 1 0 6h-2M7 3v2m5-3v3"/>',
  chart: '<path d="M5 20V10m7 10V4m7 16v-7"/>',
  shield:
    '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  mic: '<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6"/>',
  file: '<path d="M5 2h10l4 4v16H5Zm10 0v5h4M8 12h8m-8 4h8"/>',
  bell: '<path d="M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Zm5 4h4"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  train: '<path d="M4 16V6h12v10H4Zm0-6h12M7 6V3h6v3m3 6h4v5H3m3 0v3m11-3v3"/>',
  wall: '<path d="M3 3h7v8H3Zm11 0h7v8h-7ZM3 15h7v6H3Zm11 0h7v6h-7Z"/>',
  room: '<path d="M3 10 12 3l9 7v11H3Zm6 11v-8h6v8"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  rotate: '<path d="M4 9a8 8 0 1 1 0 7m0-7V3m0 6h6"/>',
};
