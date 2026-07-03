import type { Formation, FormationShape, PitchSlot } from '@/types';

// All coordinates: x ∈ [10, 90], y ∈ [10, 90] where y=90 is the GK end.
const gk: PitchSlot = { position: 'GK', x: 50, y: 92 };

function back4(): PitchSlot[] {
  return [
    { position: 'LB', x: 14, y: 75 },
    { position: 'CB', x: 36, y: 78 },
    { position: 'CB', x: 64, y: 78 },
    { position: 'RB', x: 86, y: 75 },
  ];
}
function back3(): PitchSlot[] {
  return [
    { position: 'CB', x: 22, y: 78 },
    { position: 'CB', x: 50, y: 80 },
    { position: 'CB', x: 78, y: 78 },
  ];
}

export const FORMATIONS: Formation[] = [
  {
    shape: '4-3-3',
    label: '4-3-3',
    description: 'Classic — wide front three, midfield triangle.',
    slots: [
      gk,
      ...back4(),
      { position: 'CDM', x: 50, y: 58 },
      { position: 'CM',  x: 28, y: 48 },
      { position: 'CM',  x: 72, y: 48 },
      { position: 'LW',  x: 16, y: 22 },
      { position: 'ST',  x: 50, y: 16 },
      { position: 'RW',  x: 84, y: 22 },
    ],
  },
  {
    shape: '4-2-3-1',
    label: '4-2-3-1',
    description: 'Two pivots, attacking 10.',
    slots: [
      gk,
      ...back4(),
      { position: 'CDM', x: 36, y: 56 },
      { position: 'CDM', x: 64, y: 56 },
      { position: 'LM',  x: 18, y: 32 },
      { position: 'CAM', x: 50, y: 30 },
      { position: 'RM',  x: 82, y: 32 },
      { position: 'ST',  x: 50, y: 14 },
    ],
  },
  {
    shape: '4-4-2',
    label: '4-4-2',
    description: 'Flat midfield two strikers.',
    slots: [
      gk,
      ...back4(),
      { position: 'LM',  x: 16, y: 48 },
      { position: 'CM',  x: 36, y: 50 },
      { position: 'CM',  x: 64, y: 50 },
      { position: 'RM',  x: 84, y: 48 },
      { position: 'ST',  x: 38, y: 18 },
      { position: 'ST',  x: 62, y: 18 },
    ],
  },
  {
    shape: '4-4-2-Diamond',
    label: '4-4-2 Diamond',
    description: 'Diamond mid, narrow.',
    slots: [
      gk,
      ...back4(),
      { position: 'CDM', x: 50, y: 60 },
      { position: 'CM',  x: 28, y: 44 },
      { position: 'CM',  x: 72, y: 44 },
      { position: 'CAM', x: 50, y: 30 },
      { position: 'ST',  x: 38, y: 16 },
      { position: 'ST',  x: 62, y: 16 },
    ],
  },
  {
    shape: '4-1-4-1',
    label: '4-1-4-1',
    description: 'Single pivot, four-band mid.',
    slots: [
      gk,
      ...back4(),
      { position: 'CDM', x: 50, y: 58 },
      { position: 'LM',  x: 16, y: 40 },
      { position: 'CM',  x: 38, y: 40 },
      { position: 'CM',  x: 62, y: 40 },
      { position: 'RM',  x: 84, y: 40 },
      { position: 'ST',  x: 50, y: 16 },
    ],
  },
  {
    shape: '4-3-2-1',
    label: '4-3-2-1 Christmas Tree',
    description: 'Christmas tree — two 10s behind a lone striker.',
    slots: [
      gk,
      ...back4(),
      { position: 'CDM', x: 50, y: 58 },
      { position: 'CM',  x: 30, y: 48 },
      { position: 'CM',  x: 70, y: 48 },
      { position: 'CAM', x: 36, y: 30 },
      { position: 'CAM', x: 64, y: 30 },
      { position: 'ST',  x: 50, y: 14 },
    ],
  },
  {
    shape: '4-2-2-2',
    label: '4-2-2-2 Box',
    description: 'Box midfield, twin strikers.',
    slots: [
      gk,
      ...back4(),
      { position: 'CDM', x: 36, y: 56 },
      { position: 'CDM', x: 64, y: 56 },
      { position: 'CAM', x: 32, y: 32 },
      { position: 'CAM', x: 68, y: 32 },
      { position: 'ST',  x: 40, y: 16 },
      { position: 'ST',  x: 60, y: 16 },
    ],
  },
  {
    shape: '3-5-2',
    label: '3-5-2',
    description: 'Wing-backs do everything.',
    slots: [
      gk,
      ...back3(),
      { position: 'LM',  x: 12, y: 50 },
      { position: 'CDM', x: 36, y: 54 },
      { position: 'CM',  x: 50, y: 46 },
      { position: 'CDM', x: 64, y: 54 },
      { position: 'RM',  x: 88, y: 50 },
      { position: 'ST',  x: 38, y: 16 },
      { position: 'ST',  x: 62, y: 16 },
    ],
  },
  {
    shape: '3-4-3',
    label: '3-4-3',
    description: 'Front three, attacking wing-backs.',
    slots: [
      gk,
      ...back3(),
      { position: 'LM',  x: 12, y: 48 },
      { position: 'CM',  x: 38, y: 50 },
      { position: 'CM',  x: 62, y: 50 },
      { position: 'RM',  x: 88, y: 48 },
      { position: 'LW',  x: 18, y: 20 },
      { position: 'ST',  x: 50, y: 14 },
      { position: 'RW',  x: 82, y: 20 },
    ],
  },
];

export const FORMATIONS_BY_SHAPE = Object.fromEntries(
  FORMATIONS.map((f) => [f.shape, f]),
) as Record<FormationShape, Formation>;
