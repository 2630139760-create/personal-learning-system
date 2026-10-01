// Stable IDs are persisted; labels and artwork can be replaced independently.
export const MOODS = [
  { id: 'anguish', name: '痛苦', color: '#e8a4a5', ink: '#813d47', face: '<path d="M16 21l7 3-7 3m28-6-7 3 7 3M16 17l8 2m12 0 8-2M22 38q8-3 16 0m-15 2h14"/><path d="M44 30q-6 8 0 8t0-8" fill="#a9d8ef" stroke="#709bb1"/>' },
  { id: 'depressed', name: '抑郁', color: '#b1bfcc', ink: '#465d70', face: '<path d="M16 23h10m8 0h10M18 20l6 1m12 0 6-1M23 39q7-6 14 0"/><path d="M21 24v3m18-3v3"/>' },
  { id: 'downcast', name: '失落', color: '#c1dfeb', ink: '#587b91', face: '<path d="M16 18l9 3m10 0 9-3M23 38q7-4 14 0"/><ellipse cx="21" cy="27" rx="2" ry="3" fill="currentColor"/><ellipse cx="39" cy="27" rx="2" ry="3" fill="currentColor"/>' },
  { id: 'confused', name: '迷茫', color: '#cdc4db', ink: '#6c587d', face: '<path d="M16 18q5-5 10 0m9 4 8-1M25 38h10"/><circle cx="21" cy="26" r="2" fill="currentColor"/><circle cx="39" cy="27" r="2" fill="currentColor"/><path d="M46 10q6-3 6 1t-3 4v2m0 3v.1"/>' },
  { id: 'plain', name: '平淡', color: '#e2ddcf', ink: '#746d61', face: '<path d="M17 25q4 2 8 0m10 0q4 2 8 0M25 37h10"/>' },
  { id: 'amused', name: '有趣', color: '#f7ce83', ink: '#8c602e', face: '<path d="M16 17q5-4 10-1m9 4h9M23 36q9 7 17-2"/><circle cx="21" cy="26" r="3" fill="currentColor"/><circle cx="39" cy="26" r="3" fill="currentColor"/><path d="M20 24h2m16 0h2" stroke="white"/>' },
  { id: 'joyful', name: '快乐', color: '#f7df77', ink: '#876327', face: '<path d="M16 26q5-7 10 0m8 0q5-7 10 0"/><path d="M22 34h16q-1 12-8 12t-8-12" fill="#ad6458"/><ellipse cx="15" cy="33" rx="4" ry="2" fill="#edaaa0" stroke="none"/><ellipse cx="45" cy="33" rx="4" ry="2" fill="#edaaa0" stroke="none"/>' },
  { id: 'blessed', name: '幸福', color: '#f1c5ce', ink: '#925465', face: '<path d="M16 25q5 5 10 0m8 0q5 5 10 0M23 36q7 7 14 0"/><ellipse cx="15" cy="32" rx="4" ry="2" fill="#eaa3b7" stroke="none"/><ellipse cx="45" cy="32" rx="4" ry="2" fill="#eaa3b7" stroke="none"/><path d="M46 12c-5-6-10 0 0 5 10-5 5-11 0-5" fill="#c77693" stroke="none"/>' },
  { id: 'alive', name: '生命', color: '#b8a2d2', ink: '#574070', face: '<circle cx="30" cy="29" r="26" stroke="#dbbd75" stroke-width="2" opacity=".6"/><ellipse cx="21" cy="25" rx="3" ry="4" fill="currentColor"/><ellipse cx="39" cy="25" rx="3" ry="4" fill="currentColor"/><path d="M20 22h2m16 0h2" stroke="#fff3c4"/><path d="M24 37q6 4 12 0"/><path d="M43 29q-4 6 0 6t0-6" fill="#e0daf0" stroke="none"/>' }
];
export function moodSVG(id) {
  const mood = MOODS.find(m => m.id === id);
  if (!mood) return '';
  return `<svg class="diary-face" viewBox="0 0 60 60" aria-hidden="true" focusable="false" style="color:${mood.ink}"><circle cx="30" cy="30" r="25" fill="${mood.color}"/><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${mood.face}</g></svg>`;
}
