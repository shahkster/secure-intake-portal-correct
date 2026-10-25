// Team resources. Edit this file to change the content on the Resources page.

export type PhoneRow = { carrier: string; label: string; phone: string; note?: string; email?: string };

export const PHONES: PhoneRow[] = [
  { carrier: 'Ethos', label: 'Agent support', phone: '(415) 797-0864', note: 'General queries, first/recurring premium, policy changes', email: 'agents@getethos.com' },
  { carrier: 'Ethos', label: 'Client service line', phone: '(415) 915-0665', note: 'Give this to clients — general queries and policy changes', email: 'support@getethos.com' },
  { carrier: 'TruStage', label: 'Claim support', phone: '1-800-779-5433', note: 'Claims on TruStage policies (agents and clients call the same line)' },
  { carrier: 'Transamerica', label: 'Agent support', phone: '877-234-4848' },
  { carrier: 'Transamerica', label: 'FE Express agent support', phone: '800-453-1448' },
  { carrier: 'Aetna', label: 'Broker support', phone: '888-542-3862' },
  { carrier: 'Corebridge', label: 'Agent support', phone: '877-246-4501' },
  { carrier: 'Corebridge', label: 'AIG / American General agent support', phone: '800-677-3311' },
  { carrier: 'Mutual of Omaha', label: 'Agent support', phone: '800-867-6873' },
  { carrier: 'Foresters', label: 'Agent support', phone: '866-466-7166' },
  { carrier: 'Aflac', label: 'Agent support', phone: '800-992-3522' },
  { carrier: 'Royal Neighbors', label: 'Agent support', phone: '800-627-4762' },
  { carrier: 'American Amicable', label: 'Agent support', phone: '800-736-7311' },
  { carrier: 'American Home Life', label: 'Agent support', phone: '833-504-0334' },
  { carrier: 'John Hancock', label: 'Agent support', phone: '888-888-8856' },
  { carrier: 'National Life Group', label: 'Agent support', phone: '800-906-3310' },
  { carrier: 'Americo', label: 'Agent support', phone: '800-231-0801' },
  { carrier: 'Baltimore Life', label: 'Agent support', phone: '877-533-2468' },
  { carrier: 'Fidelity Life', label: 'Agent support', phone: '800-369-3990' },
  { carrier: 'F&G', label: 'Fidelity & Guaranty agent support', phone: '888-513-8797' },
  { carrier: 'Combined Chubb', label: 'Agent support', phone: '800-225-4500' },
  { carrier: 'CICA Life', label: 'Agent support', phone: '800-255-2422' },
  { carrier: 'Columbus Life', label: 'Agent support', phone: '800-677-9696' },
  { carrier: 'GPM Life', label: 'Government Personnel Mutual agent support', phone: '800-426-2663' },
  { carrier: 'GTL', label: 'Guarantee Trust Life agent support', phone: '800-338-7452' },
  { carrier: 'Illinois Mutual', label: 'Agent support', phone: '800-437-7355' },
  { carrier: 'InstaBrain', label: 'Agent support', phone: '800-806-9714' },
  { carrier: 'Kansas City Life', label: 'Agent support', phone: '800-255-6202' },
  { carrier: 'Lafayette Life', label: 'Agent support', phone: '800-443-8793' },
  { carrier: 'Liberty Bankers Life', label: 'Agent support', phone: '800-745-4927' },
  { carrier: 'Manhattan Life', label: 'Agent support', phone: '800-669-9030' },
  { carrier: 'Polish Falcons', label: 'Agent support', phone: '800-535-2071' },
  { carrier: 'United Home Life', label: 'Agent support', phone: '800-428-3001' },
];

export type Guide = { id: string; title: string; subtitle: string; steps: string[]; tip?: string };

export const CLIENT_GUIDES: Guide[] = [
  {
    id: 'corebridge-hipaa', title: 'Corebridge HIPAA signature', subtitle: 'Client gets a text from (888) 902-2091 with a clickwrap2.ipipeline.com link',
    steps: [
      'Client receives a text from (888) 902-2091: “this is Corebridge Financial. The HIPAA authorization necessary for your life insurance application is ready for your review,” with a link on clickwrap2.ipipeline.com. Tell them it’s legit and they can open it.',
      'The page is Corebridge-branded and asks for the last 4 of their SSN, then Sign In.',
      'Terms of Use: have them tick “I agree to the terms of the Electronic Consent and Disclosure”.',
      'HIPAA Authorization: they must tap “View HIPAA Authorization” first (it opens the PDF with their name and DOB). The agree checkbox stays locked until they’ve opened it. They can close the PDF right away.',
      'Tick “I agree to the terms of the HIPAA Authorization”, then tap Apply Signature.',
      'A green “Signatures Complete” banner means done. Nothing else to sign.',
    ],
    tip: 'Watch the client’s screen with them as they go.',
  },
  {
    id: 'chubb-signature', title: 'Chubb / Combined signature', subtitle: 'Client gets a text from (855) 811-8339 with a b80.us short link',
    steps: [
      'Client receives a text from (855) 811-8339: “This message is from Combined Insurance. Here is the link you requested,” with a short https://b80.us/… link. Tell them Combined is Chubb — it’s legit.',
      'The link opens chubb.insuranceadmin.com with Combined “A Chubb Company” branding (Benchmark Administration runs the page).',
      'They enter the last 4 of their SSN to open the application.',
      'One page: “Review and sign the authorizations, certifications and disclosures” — release of medical information, MIB, fraud notice. They scroll to the bottom.',
      'At “If you agree, select below…” they pick I Agree in the dropdown — their signature appears automatically in cursive. Then Yes on consent to electronic submission.',
      'Done: “The document has been signed. Thank you.”',
    ],
    tip: 'The page says in red that the application is not final yet. It only authorizes the medical-info release; it submits after the premium is set and final review. Signing this does not mean the policy is issued.',
  },
];

export const CHEAT_SHEET = {
  defaultOrder: 'Default writing order: 1) Transamerica (baseline, no comp hit) 2) Aetna (7.5% hit) 3) Ethos (15% hit). Start with Transamerica unless age, health, product or coverage says otherwise.',
  byAge: [
    ['0–17', 'Transamerica', 'Combined'],
    ['18–49', 'Transamerica', 'Combined → United Home Life → Mutual of Omaha'],
    ['50–59', 'Transamerica + Aetna + Corebridge', 'Aflac → Royal Neighbors → Combined → UHL → MoO'],
    ['60–80', 'Transamerica + Aetna + Ethos + Corebridge', 'Aflac → Royal Neighbors → Foresters → UHL → MoO'],
    ['81–89', 'Transamerica (to 85) + Aetna', 'Royal Neighbors (to 85)'],
    ['90+', 'Nobody writes 90+', ''],
  ],
  byHealth: [
    ['Green', 'Healthy', 'Transamerica → Aetna → Ethos → Combined → MoO → Aflac → Corebridge Preferred'],
    ['Yellow', 'Tougher', 'Ethos → Transamerica → Corebridge Preferred → UHL (Ethos takes all health types — strongest here)'],
    ['Red', 'Very unhealthy', 'Foresters → Corebridge Guaranteed Issue → Royal Neighbors'],
  ],
  byProduct: [
    ['Large whole life', 'Royal Neighbors'],
    ['Term up to $1M', 'Ethos → MoO → Royal Neighbors → Foresters'],
    ['Term over $1M', 'Transamerica → Royal Neighbors (exams possible)'],
    ['IUL', 'Transamerica → MoO → Ethos'],
  ],
  goodToKnow: [
    'Ethos term/IUL needs an Ameritas appointment. It takes time — request it before you need it.',
    'Guaranteed/graded: go Corebridge — lightest GI comp hit (8%).',
    'Comp hits: Aetna 7.5, Corebridge 8, Combined 10, Ethos 15, Royal Neighbors 15, MoO 15, Aflac 17, Foresters 20, UHL 30.',
    'Aflac and Royal Neighbors pay less but price great — worth it when price closes the deal.',
  ],
};

export const BENEFICIARY_SCRIPT: [string, string][] = [
  ['Open', '“Hey, is this [Name]? This is [Agent] — I helped [Client Name] set up their life insurance.”'],
  ['Trust', '“I wanted to reach out so you have my direct number — if you ever have questions, or God forbid anything happens, I’m the one who handles the claim and makes sure everything gets taken care of.”'],
  ['Pivot (hit it early)', '“Now real quick — since I just set up [Client Name], I’ve already got the family details carriers ask about, which makes this a much quicker and smoother process for you than calling in cold. Most people don’t realize how easy it is at this point.”'],
  ['Reinforce', '“You’re in a better spot than a stranger calling in — I know the situation, I know what got approved, and the review costs nothing.”'],
  ['Control question', '“Do you already have a policy yourself — yes or no?”'],
  ['If no', '“Then let’s take a few minutes while everything’s fresh — you’re at the easiest point to get this done, and every year you wait the price only goes up.”'],
  ['If yes', '“Good — but I’ll be straight with you, most policies I review are overpriced or undersized. There’s a solid chance I can improve what you have, and if I can’t, you keep what you’ve got.”'],
  ['Close (assumptive)', '“Look, this is quick. I’ve got time later today and tomorrow — which one are we doing?”'],
  ['If they hesitate', '“I get it — but the review is free and takes a few minutes. If it doesn’t help you, nothing changes.”'],
  ['If they stall', '“No problem — let’s just lock in a quick time so it doesn’t slip. I’ll keep it short.”'],
];

export const REBUTTALS: [string, string][] = [
  ['“I don’t have any life insurance”', '“That’s exactly the reason why I’m reaching out to you, we wanted to go ahead and make sure that your family was protected. God forbid if anything happened to you so your family wouldn’t be coming out of pocket for any funeral or burial expenses and to also leave some money left over for your loved ones during a financial burden.”'],
  ['“I can’t afford it”', '“Well, that’s not a problem at all. We actually have options that can start as low as $20 a month. The goal is to make sure you have some coverage in place so your family isn’t left having to come out of pocket for funeral and final expenses during an already difficult time.”'],
  ['“I have insurance through my job”', '“That’s great. The problem is, that coverage won’t stay with you forever — if you leave your job or retire, that coverage won’t stick with you. We want to make sure that you have permanent coverage, God forbid you end up leaving your job or retiring.”'],
  ['“My spouse and I need to discuss it”', '“Absolutely. What questions do you think your spouse would have so we can make sure you have all the answers? Can we schedule a call this week with the three of us?”'],
  ['“I need to think about it”', '“I completely understand. Usually when someone says they need to think about it, it’s because they’re unsure about the coverage, the company, or the cost. Which one is it for you?”'],
  ['“Send me something to my house / email”', '“I’d be more than happy to send you some information. Before I do, I just need to see what you may qualify for and what the pricing would look like based on your individual situation. Give me two minutes so I can get you a personalized quote.”'],
  ['“I’m not interested / I already have insurance”', '“I hear you, [name] — quick one then: most people I talk to already have something. I do free reviews, and more often than not I find they’re overpaying or undersized. Two minutes to check yours costs you nothing.”'],
  ['“I cancelled that policy / I don’t have that anymore”', '“Got it — so did you replace it with something else, or are you going without coverage right now?” If uncovered: “Then honestly, that’s exactly why this call matters — let’s make sure your family isn’t left paying out of pocket.” If replaced: “Great — want me to take a quick look and make sure you’re not overpaying on the new one?”'],
  ['“Are you with (company)?”', '“I’m an independent broker — I work with A+ rated carriers, which is actually better for you: I’m not stuck selling one company’s product, I shop them so you get the most coverage at the lowest cost.”'],
  ['“Take me off your call list / stop calling me”', 'Honor it: “You got it — I’m marking you as do-not-call right now, and you won’t hear from us again.” Then press 9 (or set the status to Do Not Call). The number goes on the internal Do Not Call list and the dialer skips it for good. Continuing the pitch after a do-not-call request is a federal (TCPA) violation with fines per call.'],
];

export const GV_STEPS = [
  'Open Google Chrome on your computer — the extension only works in Chrome.',
  'Open the Chrome Web Store link below (or search the store for Google Voice — the one made by Google).',
  'Click Add to Chrome, then Add extension.',
  'Click the puzzle-piece icon at the top right of Chrome and pin Google Voice so the icon stays visible.',
  'Click the Google Voice icon and sign in with the Google account your Google Voice number is on.',
  'Done. Phone numbers on web pages become clickable and dial through Google Voice. You can also right-click a selected number and choose Call with Google Voice.',
];
export const GV_EXTENSION_URL = 'https://chrome.google.com/webstore/detail/google-voice-by-google/kcnhkahnjcbndmmehfkdnkjomaanaooo';

// Non-resident individual producer, Life line. NIPR estimate as of 9/1/2026 — fees change, treat as estimates.
export const NIPR_FEE = 5.6;
export const LICENSE_FEES: [string, number][] = [
  ['Michigan', 10], ['Ohio', 10], ['Virginia', 15], ['Guam', 25], ['South Carolina', 25], ['New Mexico', 30],
  ['South Dakota', 30], ['Kansas', 40], ['Iowa', 50], ['Texas', 50], ['West Virginia', 50], ['Maryland', 54],
  ['Florida', 55], ['Maine', 55], ['Washington', 55], ['Minnesota', 60], ['Colorado', 68], ['Arkansas', 70],
  ['Alaska', 75], ['Louisiana', 75], ['Utah', 75], ['Wisconsin', 75], ['Alabama', 80], ['Idaho', 80],
  ['Tennessee', 80], ['Indiana', 90], ['North Carolina', 94], ['District of Columbia', 100], ['Kentucky', 100],
  ['Missouri', 100], ['Montana', 100], ['Nebraska', 100], ['North Dakota', 100], ['Oregon', 100],
  ['Mississippi', 101], ['Pennsylvania', 110], ['Vermont', 110], ['Arizona', 120], ['Georgia', 120],
  ['Oklahoma', 120], ['Delaware', 125], ['Rhode Island', 130], ['Connecticut', 140], ['Wyoming', 150],
  ['New Jersey', 170], ['Nevada', 185], ['California', 188], ['New Hampshire', 210], ['Hawaii', 225],
  ['Massachusetts', 225], ['Illinois', 300.36], ['U.S. Virgin Islands', 700], ['Puerto Rico', 1682],
];

// Quick links start without web addresses. The boss adds each one on the Resources page;
// agents only see links that have an address, so nobody hits a dead link.
export const QUICK_LINK_SEED: [string, string, string | null][] = [
  ['Ethos', 'Client Status Cheat Sheet', null],
  ['Google Voice extension', 'Click-to-call from Chrome', GV_EXTENSION_URL],
  ['FEX Quoter', 'Insurance Toolkits', null],
  ['Carrier cheat sheet', 'Full PDF', null],
  ['Ethos', 'Agent login', null],
  ['Combined Chubb', 'Agent login', null],
  ['Transamerica', 'Agent Net (policies, commissions)', null],
  ['Aetna', 'Broker portal login', null],
  ['Corebridge', 'Connext agent login', null],
  ['Mutual of Omaha', 'Producer portal login', null],
  ['Royal Neighbors', 'Agent login', null],
  ['United Home Life', 'Agent portal', null],
  ['American Home Life', 'Agent site', null],
  ['SBLI', 'Agent portal', null],
  ['PFA', 'Agent login (iCover)', null],
  ['Liberty Bankers', 'LBIG agent portal', null],
  ['GTL', 'e-App login', null],
  ['Aflac', 'Agent portal login (senior plans)', null],
  ['Venmo Jonah', '', null],
];
