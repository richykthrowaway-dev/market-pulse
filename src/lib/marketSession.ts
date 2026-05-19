export interface USMarketSession {
  open: boolean;
  label: string;
  minsToChange: number;
}

const OPEN = 9 * 60 + 30;   // 570
const CLOSE = 16 * 60;      // 960
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function etParts(now: Date): { dayIdx: number; mins: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  let hh = parseInt(get('hour'), 10);
  if (hh === 24) hh = 0;
  const mm = parseInt(get('minute'), 10);
  const dayIdx = DAY.indexOf(get('weekday'));
  return { dayIdx, mins: hh * 60 + mm };
}

const fmt = (m: number) => {
  const h = Math.floor(m / 60), x = m % 60;
  return h > 0 ? `${h}h ${x}m` : `${x}m`;
};

/** US regular session (NYSE 09:30–16:00 ET, Mon–Fri). Weekend-aware. Pure. */
export function usMarketSession(now: Date): USMarketSession {
  const { dayIdx, mins } = etParts(now);
  const weekday = dayIdx >= 1 && dayIdx <= 5;

  if (weekday && mins >= OPEN && mins < CLOSE) {
    return { open: true, label: `closes in ${fmt(CLOSE - mins)}`, minsToChange: CLOSE - mins };
  }

  let addDays: number;
  let minsToChange: number;
  if (weekday && mins < OPEN) {
    addDays = 0;
    minsToChange = OPEN - mins;
  } else {
    let d = 1;
    while (((dayIdx + d) % 7) === 0 || ((dayIdx + d) % 7) === 6) d++;
    addDays = d;
    minsToChange = (1440 - mins) + (addDays - 1) * 1440 + OPEN;
  }
  const when = addDays === 0 ? 'today' : addDays === 1 ? 'tomorrow' : DAY[(dayIdx + addDays) % 7];
  return { open: false, label: `opens ${when} 9:30 ET`, minsToChange };
}
