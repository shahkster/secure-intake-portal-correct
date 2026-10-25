/** Lead list sort options: label, which way it goes first, and how to describe each direction. */
export const LEAD_SORTS: { key: string; label: string; kind: 'num' | 'date' | 'text' | 'age' | 'soon' }[] = [
  { key: 'touch', label: 'Last touch', kind: 'date' },
  { key: 'added', label: 'Date added', kind: 'date' },
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'status', label: 'Status', kind: 'text' },
  { key: 'state', label: 'State', kind: 'text' },
  { key: 'age', label: 'Age', kind: 'age' },
  { key: 'coverage', label: 'Coverage', kind: 'num' },
  { key: 'amount', label: 'Amount', kind: 'num' },
  { key: 'attempts', label: 'Call attempts', kind: 'num' },
  { key: 'callback', label: 'Callback time', kind: 'soon' },
  { key: 'agent', label: 'Agent', kind: 'text' },
];

export const DEFAULT_DIR: Record<string, 'asc' | 'desc'> = {
  touch: 'desc', added: 'desc', name: 'asc', status: 'asc', state: 'asc', age: 'desc',
  coverage: 'desc', amount: 'desc', attempts: 'desc', callback: 'asc', agent: 'asc',
};

const WORDS = {
  num: ['Lowest first', 'Highest first'], date: ['Oldest first', 'Newest first'], text: ['A → Z', 'Z → A'],
  age: ['Youngest first', 'Oldest first'], soon: ['Soonest first', 'Latest first'],
} as const;

export function dirLabel(key: string, dir: 'asc' | 'desc') {
  const kind = LEAD_SORTS.find((s) => s.key === key)?.kind || 'num';
  return WORDS[kind][dir === 'asc' ? 0 : 1];
}
