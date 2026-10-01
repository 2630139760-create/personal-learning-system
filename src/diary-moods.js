// Stable IDs, names and order are persisted; only the SVG artwork changes.
// Each expression has separate brows / eyes / mouth / accents for small, local edits.
export const MOODS = [
  {
    id: 'anguish', name: '痛苦', color: '#e9a0a8', ink: '#a35365',
    brows: '<path d="M16 18l8 3m12 0 8-3"/>',
    eyes: '<path d="M17 24l7 2.5-7 2.5m26-5-7 2.5 7 2.5"/>',
    mouth: '<path d="M24 37q6-1.5 12 0v2q-6 1.5-12 0z" fill="#f5d0d0"/>',
    accents: '<path d="M44 30c-1 2-4 4.5-3 6.5 1.3 2.4 5.3 1.5 5.1-1.1-.1-1.8-1.2-3.7-2.1-5.4z" fill="#86c5df" stroke="#69a5c0" stroke-width="1"/><path d="M43 33l-.8 1.5" stroke="#d2ecf6" stroke-width=".8"/>'
  },
  {
    id: 'depressed', name: '抑郁', color: '#b6bccf', ink: '#555574', lineWidth: 2.1,
    // Low heavy eyelids and brow pressure distinguish this from ordinary sadness.
    brows: '<path d="M15.5 21q4.5 3.5 9 1m11 0q4.5 2.5 9-1"/><path d="M27 23v2m3-3v3m3-2v2" stroke-width="1.3"/>',
    eyes: '<path d="M16 29q4.5 2.6 9 0m10 0q4.5 2.6 9 0" stroke-width="3.8"/><path d="M18 33h5m14 0h5" stroke="#7b819e" stroke-width="1.4"/>',
    mouth: '<path d="M24 40q6-3.5 12 0" stroke-width="2.8"/>',
    accents: '<g stroke="#64617f" stroke-width="1.7"><path d="M41 12c-7-6 5-9 7-5 1 4-9 3-8-1 2-5 11-1 8 4-3 3-9-3-5-7 4-4 11 1 7 6-3 4-10 0-7-4 2-4 11-3 8 4-1 3-7 7-9 2"/><path d="M50 14l1 4" stroke-width="1.2"/></g>'
  },
  {
    id: 'downcast', name: '失落', color: '#b7e2f1', ink: '#7397ab', lineWidth: 1.5,
    brows: '<path d="M22.5 25.5q2.5-1 4-3m6 0q1.5 2 4 3" stroke="#83aabd"/>',
    // Reference: short, half-open eyes sit low on the face; the soft lids cover the pupils.
    eyes: '<path d="M14.5 31.8q5-.6 10.5.1c-.9 6.1-9.6 6.1-10.5-.1zm20 .1q5.5-.7 10.5-.1c-.9 6.2-9.6 6.2-10.5.1z" fill="#e6f1f2" fill-opacity=".7" stroke="none"/><path d="M17 32.4q3-.1 6 .1c-.3 4.9-5.7 4.9-6-.1zm20 .1q3-.2 6-.1c-.3 5-5.7 5-6 .1z" fill="#344b57" stroke="none"/><path d="M14.5 31.8q5-.6 10.5.1m9.5 0q5.5-.7 10.5-.1" stroke="#73939f" stroke-width="1.1"/>',
    mouth: '<path d="M26.5 44q3.5-5.5 7 0" stroke="#719bb8" stroke-width="1.9"/>',
    accents: '<path d="M43.5 6v7m5-4v6m5-5v12" stroke="#748bb5" stroke-width="1.4"/><ellipse cx="15.5" cy="39.5" rx="2.4" ry="1.1" fill="#f1fbfb" fill-opacity=".6" stroke="none"/><ellipse cx="43.5" cy="39.5" rx="2.4" ry="1.1" fill="#f1fbfb" fill-opacity=".6" stroke="none"/>'
  },
  {
    id: 'confused', name: '迷茫', color: '#d9c6b7', ink: '#89796a', lineWidth: 1.35,
    // Tired, hesitant gaze. No raised curious brow or question-mark expression.
    brows: '<path d="M15.5 22q5 .5 9-1.5m11 0q4 2 9 2"/>',
    eyes: '<path d="M16 27q4-2 8.5-.5m11 .5q4.5-2 8.5-.5"/><path d="M17 28.5q3.5 2 7-.3m12 0q3.5 2.3 7 .3" stroke="#a29e94" stroke-width="1"/><ellipse cx="20.5" cy="28" rx="1.5" ry="1.1" fill="#7b8888" stroke="none"/><ellipse cx="39" cy="28.4" rx="1.5" ry="1.1" fill="#7b8888" stroke="none"/><path d="M19.5 27.6h1m17.5.4h1" stroke="#e5e9df" stroke-width=".8"/>',
    mouth: '<path d="M26 39q3-2.8 6-.8l2.2.7" stroke-width="1.2"/>',
    accents: '<ellipse cx="16" cy="34" rx="4.5" ry="2.8" fill="url(#BLUSH)" stroke="none"/><ellipse cx="43" cy="34" rx="4.5" ry="2.8" fill="url(#BLUSH)" stroke="none"/><g fill="#f4f5ef" stroke="#c4c8c1" stroke-width="1" opacity=".9"><circle cx="46" cy="12" r="2"/><path d="M48 9c-4-3 0-8 3-6 4-3 7 2 4 4 1 4-4 5-7 2z"/></g>'
  },
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
  {
    id: 'alive', name: '生命', color: '#e8c6b8', ink: '#80708a', lineWidth: 1,
    // Fine, soft facial lines: gentle reflection, not a broad smile.
    brows: '<path d="M15.5 20q4.5-3.7 10-2.5m9 .5q5-2.4 9 1.8" stroke-width=".95"/>',
    eyes: '<path d="M15.3 27q4.5-6.6 10.4-1.4m8.7-.4q5.3-5.6 10.2.8" stroke-width="1.15"/><path d="M16.5 29q4.3 2.5 8.5-.3m10-.5q4.3 2.5 8.6 0" stroke="#a598ae" stroke-width=".8"/><ellipse cx="21" cy="26" rx="2.4" ry="3.2" fill="#756582" stroke="none"/><ellipse cx="39" cy="25.6" rx="2.4" ry="3.2" fill="#756582" stroke="none"/><circle cx="20.2" cy="24.4" r="1" fill="#f7eff8" stroke="none"/><circle cx="38.2" cy="24" r="1" fill="#f7eff8" stroke="none"/><path d="M17 29.4q3.5 1 7 .1m12-.6q3.5 1 7 .1" stroke="#e5e0ed" stroke-width=".75"/>',
    mouth: '<path d="M25.5 38.2q4.5-.8 9 .1" stroke-width=".95" opacity=".8"/>',
    // Screen-right outer eye corner: one tiny held tear, with a restrained glint.
    accents: '<ellipse cx="15.5" cy="33.5" rx="4" ry="2.5" fill="url(#BLUSH)" stroke="none"/><ellipse cx="44.5" cy="33" rx="3.5" ry="2.4" fill="url(#BLUSH)" stroke="none"/><path d="M44 28.7c-.6 1.5-1.8 3.2-1.2 4.4.6 1.1 2.2.7 2.3-.5.1-1.2-.4-2.6-1.1-3.9z" fill="#e1e9ef" fill-opacity=".8" stroke="#b7c6d8" stroke-width=".5"/><path d="M43.8 30.5l-.2 1" stroke="#fff" stroke-width=".55" opacity=".9"/>'
  }
];
let svgSerial = 0;
export function moodSVG(id) {
  const mood = MOODS.find(m => m.id === id);
  if (!mood) return '';
  // Unique gradient IDs prevent a calendar icon from picking up another SVG's paint.
  const key = `diary-mood-${mood.id}-${++svgSerial}`;
  const parts = ['accents', 'brows', 'eyes', 'mouth'].map(part => `<g data-part="${part}">${mood[part].replaceAll('BLUSH', `${key}-blush`)}</g>`).join('');
  const alivePaint = mood.id === 'alive' ? `<radialGradient id="${key}-blue" cx=".15" cy=".12" r=".78"><stop stop-color="#9bafe5" stop-opacity=".85"/><stop offset="1" stop-color="#9bafe5" stop-opacity="0"/></radialGradient><radialGradient id="${key}-gold" cx=".95" cy=".47" r=".64"><stop stop-color="#fff0b8" stop-opacity=".9"/><stop offset="1" stop-color="#efcf8d" stop-opacity="0"/></radialGradient>` : '';
  const aliveFace = mood.id === 'alive' ? `<circle cx="30" cy="30" r="25" fill="url(#${key}-blue)"/><circle cx="30" cy="30" r="25" fill="url(#${key}-gold)"/>` : '';
  return `<svg class="diary-face" viewBox="0 0 60 60" aria-hidden="true" focusable="false" style="color:${mood.ink}" data-mood-art="${mood.id}" data-mood-art-version="reference-20261001"><defs><radialGradient id="${key}-face" cx=".36" cy=".28" r=".8"><stop stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="${mood.color}" stop-opacity="0"/></radialGradient><radialGradient id="${key}-blush"><stop stop-color="#d58a99" stop-opacity=".5"/><stop offset="1" stop-color="#d58a99" stop-opacity="0"/></radialGradient>${alivePaint}</defs><circle cx="30" cy="30" r="25" fill="${mood.color}"/><circle cx="30" cy="30" r="25" fill="url(#${key}-face)"/>${aliveFace}<g fill="none" stroke="currentColor" stroke-width="${mood.lineWidth || 1.8}" stroke-linecap="round" stroke-linejoin="round">${parts}</g></svg>`;
}
