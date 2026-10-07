export interface IconDefinition {
  readonly viewBox?: string;
  readonly paths?: readonly string[];
  readonly circles?: readonly {
    cx: number;
    cy: number;
    r: number;
  }[];
  readonly rects?: readonly {
    x: number;
    y: number;
    width: number;
    height: number;
    rx: number;
  }[];
}

export const ICONS = {
  home: {
    paths: ['m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z'],
  },
  compass: {
    circles: [{ cx: 12, cy: 12, r: 9 }],
    paths: ['m15.5 8.5-2 5-5 2 2-5z'],
  },
  bell: {
    paths: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4'],
  },
  bookmark: {
    paths: ['M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z'],
  },
  users: {
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' +
        'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8' +
        'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    ],
  },
  search: {
    circles: [{ cx: 11, cy: 11, r: 7 }],
    paths: ['m20 20-4-4'],
  },
  compose: {
    paths: ['M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z'],
  },
  message: {
    paths: ['M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z'],
  },
  repeat: {
    paths: ['m17 1 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14' + 'M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3'],
  },
  react: {
    circles: [{ cx: 12, cy: 12, r: 9 }],
    paths: ['M12 8v8M8 12h8'],
  },
  useful: {
    paths: [
      'M9 18h6M10 22h4M9 18c0-2.3-.4-2.7-1.6-4.2' +
        'A6.8 6.8 0 1 1 16.6 14C15.4 15.3 15 15.8 15 18',
      'M12 2v2M4.9 4.9l1.4 1.4M2 12h2M20 12h2M17.7 6.3l1.4-1.4',
    ],
  },
  agree: {
    circles: [{ cx: 12, cy: 12, r: 9 }],
    paths: ['m8 12 2.7 2.7L16.5 9'],
  },
  verified: {
    viewBox: '0 0 16 16',
    paths: ['m3.5 8 2.7 2.7 6.3-6.3'],
  },
  brilliant: {
    paths: [
      'm12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8z' +
        'M18.5 15l.7 2.1 1.8.9-1.8.9-.7 2.1-.7-2.1L16 18l1.8-.9z' +
        'M5.5 3l.6 1.7 1.4.8-1.4.8L5.5 8l-.6-1.7-1.4-.8 1.4-.8z',
    ],
  },
  spicy: {
    paths: [
      'M12 22c4 0 7-3 7-7 0-3.5-2-6.5-5.5-10' +
        '.2 3-1.4 5-3.2 6.8.1-2.1-.7-3.8-2.3-5.3C9 9 5 11 5 15c0 4 3 7 7 7z',
      'M9.5 18c0-1.7 1.1-2.8 2.5-4.5.2 1.6 2.5 2.7 2.5 4.5' + 'a2.5 2.5 0 0 1-5 0z',
    ],
  },
  ship: {
    paths: [
      'M14 5c2.5-2.5 5.5-2 5.5-2s.5 3-2 5.5l-5 5-4-4z' +
        'M13 14l-1 5-3-3M8 11l-5 1 3 3M15.5 6.5h.01' +
        'M5 19l-2 2M8 20l-1 2M4 16l-2 1',
    ],
  },
  share: {
    circles: [
      { cx: 18, cy: 5, r: 3 },
      { cx: 6, cy: 12, r: 3 },
      { cx: 18, cy: 19, r: 3 },
    ],
    paths: ['m8.6 10.5 6.8-4M8.6 13.5l6.8 4'],
  },
  quote: {
    paths: [
      'M9 11H4a7 7 0 0 1 7-7v3a4 4 0 0 0-4 4v1h2v7H3v-7' +
        'a1 1 0 0 1 1-1M21 11h-5a7 7 0 0 1 7-7v3' +
        'a4 4 0 0 0-4 4v1h2v7h-6v-7a1 1 0 0 1 1-1',
    ],
  },
  copy: {
    rects: [{ x: 8, y: 8, width: 13, height: 13, rx: 2 }],
    paths: ['M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3'],
  },
  more: {
    circles: [
      { cx: 5, cy: 12, r: 1 },
      { cx: 12, cy: 12, r: 1 },
      { cx: 19, cy: 12, r: 1 },
    ],
  },
  code: {
    paths: ['m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14'],
  },
  image: {
    rects: [{ x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    circles: [{ cx: 8.5, cy: 8.5, r: 1.5 }],
    paths: ['m21 15-5-5L5 21'],
  },
  poll: {
    paths: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  },
  chevron: {
    paths: ['m9 18 6-6-6-6'],
  },
  x: {
    paths: ['M18 6 6 18M6 6l12 12'],
  },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;
export type IconSize = 'small' | 'standard' | 'large';
