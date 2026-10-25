export type Tone = 'blue' | 'amber' | 'violet' | 'green' | 'red' | 'muted';

export const LEAD_STATUSES: { v: string; c: Tone }[] = [
  { v: 'New', c: 'blue' },
  { v: 'No Answer', c: 'amber' },
  { v: 'Callback', c: 'violet' },
  { v: 'Contacted', c: 'blue' },
  { v: 'Interested', c: 'green' },
  { v: 'Sold', c: 'green' },
  { v: 'Not Interested', c: 'muted' },
  { v: 'Wrong Number', c: 'red' },
  { v: 'Out of Service', c: 'red' },
  { v: 'Do Not Call', c: 'red' },
];
export const CONTACT_STATUSES = ['Callback', 'Contacted', 'Interested', 'Sold', 'Not Interested', 'Do Not Call'];

export const DEAL_STATUSES: { v: string; c: Tone }[] = [
  { v: 'Submitted', c: 'blue' },
  { v: 'Pending', c: 'amber' },
  { v: 'Approved', c: 'violet' },
  { v: 'Premium Paying', c: 'green' },
  { v: 'Initial Premium Failed', c: 'red' },
  { v: 'Lapsed', c: 'red' },
  { v: 'Declined', c: 'muted' },
  { v: 'Cancelled', c: 'muted' },
];
export const DEAD_DEAL = ['Declined', 'Cancelled'];

export const toneOf = (list: { v: string; c: Tone }[], v: string): Tone => list.find((x) => x.v === v)?.c ?? 'muted';

export const STATE_TZ: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  DC: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver',
  NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver', PR: 'America/Puerto_Rico',
};
export const STATES = Object.keys(STATE_TZ).sort();

export const POLICY_TYPES = [
  'No coverage', 'Final expense / burial', 'Whole life', 'Term life', 'Universal / IUL', 'Guaranteed issue',
  'Through work (group)', 'Other',
];

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'puerto rico': 'PR',
};
/** Two-letter code → full name, e.g. FL → Florida. */
export const STATE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([n, c]) => [c, n.replace(/\b\w/g, (x) => x.toUpperCase()).replace(' Of ', ' of ')]),
);

export function normState(s?: string | null) {
  if (!s) return null;
  const t = s.trim();
  if (t.length === 2) return t.toUpperCase();
  return STATE_NAMES[t.toLowerCase()] ?? t.toUpperCase().slice(0, 2);
}

export { localTime } from './tz';

export const IMPORT_FIELDS: [key: string, label: string, synonyms: string[]][] = [
  ['first_name', 'First name', ['first', 'firstname', 'first name', 'fname', 'given name']],
  ['last_name', 'Last name', ['last', 'lastname', 'last name', 'lname', 'surname']],
  ['full_name', 'Full name (gets split)', ['name', 'full name', 'fullname', 'client', 'client name']],
  ['middle', 'Middle name', ['middle', 'mi', 'middle name', 'middle initial']],
  ['phone', 'Phone', ['phone', 'phone number', 'mobile', 'cell', 'primary phone', 'telephone', 'phone1']],
  ['alt_phones', 'Other phones', ['phone2', 'alt phone', 'secondary phone', 'home phone', 'other phone', 'landline']],
  ['email', 'Email', ['email', 'e-mail', 'email address']],
  ['dob', 'Date of birth', ['dob', 'birthdate', 'date of birth', 'birthday', 'birth date']],
  ['gender', 'Gender', ['gender', 'sex']],
  ['address', 'Street address (full addresses are split automatically)', ['address', 'street', 'address1', 'street address', 'address 1', 'full address', 'mailing address', 'home address', 'location']],
  ['city', 'City', ['city', 'town']],
  ['state', 'State', ['state', 'st', 'province', 'region']],
  ['zip', 'ZIP', ['zip', 'zipcode', 'zip code', 'postal', 'postal code']],
  ['desired_coverage', 'Desired coverage', ['coverage', 'face amount', 'desired coverage', 'benefit', 'face']],
  ['quoted_premium', 'Amount', ['amount', 'premium', 'quoted premium', 'quote', 'monthly premium']],
  ['notes', 'Notes', ['notes', 'note', 'comments', 'comment']],
];
