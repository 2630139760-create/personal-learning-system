// Stable IDs, names and order are persisted; only the visual resources change.
// Four PNGs are unretouched crops of the confirmed reference. The other five SVGs stay unchanged.
export const MOODS = [
  {
    id: 'anguish', name: '痛苦', color: '#e9a0a8', ink: '#a35365',
    brows: '<path d="M16 18l8 3m12 0 8-3"/>',
    eyes: '<path d="M17 24l7 2.5-7 2.5m26-5-7 2.5 7 2.5"/>',
    mouth: '<path d="M24 37q6-1.5 12 0v2q-6 1.5-12 0z" fill="#f5d0d0"/>',
    accents: '<path d="M44 30c-1 2-4 4.5-3 6.5 1.3 2.4 5.3 1.5 5.1-1.1-.1-1.8-1.2-3.7-2.1-5.4z" fill="#86c5df" stroke="#69a5c0" stroke-width="1"/><path d="M43 33l-.8 1.5" stroke="#d2ecf6" stroke-width=".8"/>'
  },
  { id: 'depressed', name: '抑郁', image: new URL('../assets/moods/depressed.png', import.meta.url).href },
  { id: 'downcast', name: '失落', image: new URL('../assets/moods/downcast.png', import.meta.url).href },
  { id: 'confused', name: '迷茫', image: new URL('../assets/moods/confused.png', import.meta.url).href },
  {
    id: 'plain', name: '平淡', color: '#e3dfcf', ink: '#978a70', lineWidth: 1.7,
    brows: '',
    eyes: '<path d="M17 26q4 2.5 8 0m10 0q4 2.5 8 0"/>',
    mouth: '<path d="M26 37h8" stroke-width="1.6"/>',
    accents: ''
  },
  {
    id: 'amused', name: '有趣', color: '#f4cb83', ink: '#9a6e3c', lineWidth: 1.8,
    brows: '<path d="M16 18q4-4 9-1.5m11 2h8"/>',
    eyes: '<ellipse cx="21" cy="26" rx="2.7" ry="3.4" fill="#9a6e3c" stroke="none"/><ellipse cx="39" cy="26" rx="2.7" ry="3.4" fill="#9a6e3c" stroke="none"/><circle cx="22" cy="24.5" r=".9" fill="#fff2ca" stroke="none"/><circle cx="40" cy="24.5" r=".9" fill="#fff2ca" stroke="none"/>',
    mouth: '<path d="M23 35q7 9 15-.8" stroke-width="2"/>',
    accents: ''
  },
  {
    id: 'joyful', name: '快乐', color: '#f5dc7d', ink: '#9b793b', lineWidth: 1.7,
    brows: '',
    eyes: '<path d="M16 26q4.5-7 9 0m10 0q4.5-7 9 0"/>',
    mouth: '<path d="M21 34q9 1.2 18 0c-1 9-4 13-9 13s-8-4-9-13z" fill="#aa5064" stroke="none"/><path d="M24.7 42q5.3-3 10.6 0c-2.5 5.7-8.1 5.7-10.6 0z" fill="#e59a9d" stroke="none"/>',
    accents: '<ellipse cx="14.5" cy="33" rx="4.5" ry="2.6" fill="url(#BLUSH)" stroke="none"/><ellipse cx="45.5" cy="33" rx="4.5" ry="2.6" fill="url(#BLUSH)" stroke="none"/>'
  },
  {
    id: 'blessed', name: '幸福', color: '#edc2ce', ink: '#b16e86', lineWidth: 1.7,
    brows: '',
    eyes: '<path d="M16 25q4.5 5 9 0m10 0q4.5 5 9 0"/>',
    mouth: '<path d="M23.5 35q6.5 8 13 0" stroke-width="1.6"/>',
    accents: '<ellipse cx="15" cy="33" rx="4.5" ry="2.7" fill="url(#BLUSH)" stroke="none"/><ellipse cx="45" cy="33" rx="4.5" ry="2.7" fill="url(#BLUSH)" stroke="none"/><path d="M44 9c-5-6-11.5 1 0 7 11.5-6 5-13 0-7z" fill="#c77595" stroke="none"/>'
  },
  { id: 'alive', name: '生命', image: new URL('../assets/moods/alive.png', import.meta.url).href }
];
let svgSerial = 0;
export function moodSVG(id) {
  const mood = MOODS.find(m => m.id === id);
  if (!mood) return '';
  if (mood.image) return `<img class="diary-face" src="${mood.image}" alt="" aria-hidden="true" decoding="async" draggable="false" data-mood-art="${mood.id}" />`;
  // Unique gradient IDs prevent a calendar icon from picking up another SVG's paint.
  const key = `diary-mood-${mood.id}-${++svgSerial}`;
  const parts = ['accents', 'brows', 'eyes', 'mouth'].map(part => `<g data-part="${part}">${mood[part].replaceAll('BLUSH', `${key}-blush`)}</g>`).join('');
  return `<svg class="diary-face" viewBox="0 0 60 60" aria-hidden="true" focusable="false" style="color:${mood.ink}" data-mood-art="${mood.id}" data-mood-art-version="reference-20261001"><defs><radialGradient id="${key}-face" cx=".36" cy=".28" r=".8"><stop stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="${mood.color}" stop-opacity="0"/></radialGradient><radialGradient id="${key}-blush"><stop stop-color="#d58a99" stop-opacity=".5"/><stop offset="1" stop-color="#d58a99" stop-opacity="0"/></radialGradient></defs><circle cx="30" cy="30" r="25" fill="${mood.color}"/><circle cx="30" cy="30" r="25" fill="url(#${key}-face)"/><g fill="none" stroke="currentColor" stroke-width="${mood.lineWidth || 1.8}" stroke-linecap="round" stroke-linejoin="round">${parts}</g></svg>`;
}
