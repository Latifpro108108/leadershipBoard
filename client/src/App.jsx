import { useCallback, useEffect, useState } from 'react';

const PEOPLE = [
  { id: 'latif', name: 'Latif' },
  { id: 'precious', name: 'Precious' },
];

const ACTIONS = [
  { type: 'talk', points: -20, label: 'Spoke (non-work)' },
  { type: 'phone', points: -50, label: 'Touched phone' },
  { type: 'phone_serious', points: -10, label: 'Phone, serious reason' },
  { type: 'phone_serious', points: 0, label: 'Phone, serious reason (excused)' },
];

const LEVELS = [
  { min: 100, color: '#15803d', label: '100' },
  { min: 80, color: '#4ade80', label: '80+' },
  { min: 50, color: '#fde047', label: '50+' },
  { min: 20, color: '#fb923c', label: '20+' },
  { min: 0, color: '#ef4444', label: '<20' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_START = 9 * 60;
const DAY_END = 17 * 60;

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const scoreColor = (s) => LEVELS.find((l) => s >= l.min).color;

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
}

function yearDays(year) {
  const first = new Date(year, 0, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, 0, 1 + i);
    return {
      key: `${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      month: date.getMonth() + 1,
      weekday: date.getDay(),
      col: Math.floor((offset + i) / 7),
      row: (offset + i) % 7,
    };
  });
}

function nextChange(status) {
  if (!status.workday) return null;
  const edges = status.blocks.flat().filter((e) => e > status.minutes);
  if (!edges.length) return null;
  const left = Math.min(...edges) - status.minutes;
  return `${Math.floor(left / 60)}h ${pad(left % 60)}m`;
}

function Timeline({ status }) {
  const span = DAY_END - DAY_START;
  const pct = (m) => ((m - DAY_START) / span) * 100;
  const now = status.minutes;
  const inDay = status.workday && now >= DAY_START && now <= DAY_END;
  return (
    <div className="timeline">
      <div className="bar">
        {status.blocks.map(([a, b]) => (
          <div key={a} className="block" style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }}>
            <span>{hhmm(a)}–{hhmm(b)}</span>
          </div>
        ))}
        {inDay && <div className="now" style={{ left: `${pct(now)}%` }} />}
      </div>
    </div>
  );
}

function Heatmap({ days, month, status, scoreOf }) {
  const labelCols = {};
  days.forEach((d) => {
    if (!labelCols[d.month]) labelCols[d.month] = d.col;
  });
  const counted = (d) => d.weekday !== 0 && d.weekday !== 6 && d.key <= status.day;
  const [, selMonth] = month.split('-').map(Number);

  return (
    <div className="heat-scroll">
      <div className="heat">
        {Object.entries(labelCols).map(([m, col]) => (
          <span
            key={m}
            className={`mlabel ${Number(m) === selMonth ? 'sel' : ''}`}
            style={{ gridColumn: col + 2, gridRow: 1 }}
          >
            {MONTHS[m - 1]}
          </span>
        ))}
        {['Mon', 'Wed', 'Fri'].map((w, i) => (
          <span key={w} className="wlabel" style={{ gridColumn: 1, gridRow: 2 + i * 2 }}>
            {w}
          </span>
        ))}
        {days.map((d) => {
          const show = counted(d);
          const score = scoreOf(d.key);
          const weekend = d.weekday === 0 || d.weekday === 6;
          return (
            <div
              key={d.key}
              className={`cell ${weekend ? 'wk' : ''} ${d.key === status.day ? 'today' : ''} ${
                d.month === selMonth ? '' : 'dim'
              }`}
              style={{
                gridColumn: d.col + 2,
                gridRow: d.row + 2,
                ...(show ? { background: scoreColor(score) } : {}),
              }}
              title={show ? `${d.key} · ${score} pts` : d.key}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [month, setMonth] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const year = month ? month.slice(0, 4) : null;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/board${year ? `?year=${year}` : ''}`);
      const data = await res.json();
      setBoard(data);
      setMonth((m) => m || data.status.day.slice(0, 7));
    } catch {
      setError('Cannot reach server');
    }
  }, [year]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function log(person, action) {
    setError('');
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, type: action.type, points: action.points }),
    });
    if (!res.ok) setError((await res.json()).error);
    load();
  }

  async function undo(id) {
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    load();
  }

  if (!board || !month) return <p className="boot">{error || 'Loading…'}</p>;

  const { status, events } = board;
  const days = yearDays(Number(year));
  const monthDaysList = days.filter((d) => d.key.startsWith(month));
  const countedDays = monthDaysList.filter(
    (d) => d.weekday !== 0 && d.weekday !== 6 && d.key <= status.day,
  );

  const dayScore = (person, key) => {
    const lost = events
      .filter((e) => e.person === person && e.day === key)
      .reduce((sum, e) => sum + e.points, 0);
    return Math.max(0, 100 + lost);
  };

  const stats = PEOPLE.map((p) => {
    const mine = events.filter((e) => e.person === p.id && e.day.startsWith(month));
    const total = countedDays.reduce((sum, d) => sum + dayScore(p.id, d.key), 0);
    return {
      total,
      avg: countedDays.length ? Math.round(total / countedDays.length) : 0,
      perfect: countedDays.filter((d) => dayScore(p.id, d.key) === 100).length,
      talks: mine.filter((e) => e.type === 'talk').length,
      phones: mine.filter((e) => e.type !== 'talk').length,
    };
  });

  const payer =
    stats[0].total === stats[1].total
      ? null
      : stats[0].total < stats[1].total
        ? PEOPLE[0].name
        : PEOPLE[1].name;
  const sum = stats[0].total + stats[1].total;
  const share = sum ? (stats[0].total / sum) * 100 : 50;
  const countdown = nextChange(status);

  return (
    <main>
      <header>
        <div>
          <h1>LOCK—IN</h1>
          <small>Office focus challenge · {status.tz}</small>
        </div>
        <div className="nav">
          <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <span>{monthLabel(month)}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
        <div className={`state ${status.locked ? 'on' : ''}`}>
          <b>{status.locked ? 'LOCK-IN' : status.workday ? 'FREE TIME' : 'WEEKEND'}</b>
          <small>
            {hhmm(status.minutes)}
            {countdown && ` · changes in ${countdown}`}
          </small>
        </div>
      </header>

      <Timeline status={status} />

      <section className="versus">
        <div className="versus-top">
          <span>{PEOPLE[0].name} {stats[0].total}</span>
          <strong>{payer ? `${payer} is paying at this rate` : 'All level'}</strong>
          <span>{stats[1].total} {PEOPLE[1].name}</span>
        </div>
        <div className="split">
          <div style={{ width: `${share}%` }} />
        </div>
      </section>

      <section className="cols">
        {PEOPLE.map((p, i) => {
          const today = events.filter((e) => e.person === p.id && e.day === status.day);
          const s = stats[i];
          return (
            <article key={p.id}>
              <div className="head">
                <h2>{p.name}</h2>
                <span>
                  today <b className="big">{dayScore(p.id, status.day)}</b>
                </span>
              </div>

              <div className="stats">
                <div><b>{s.total}</b><span>month pts</span></div>
                <div><b>{s.avg}</b><span>daily avg</span></div>
                <div><b>{s.perfect}</b><span>perfect</span></div>
                <div><b>{s.talks}</b><span>talks</span></div>
                <div><b>{s.phones}</b><span>phone</span></div>
              </div>

              <Heatmap
                days={days}
                month={month}
                status={status}
                scoreOf={(key) => dayScore(p.id, key)}
              />

              <div className="actions">
                {ACTIONS.map((a) => (
                  <button key={a.label} disabled={!status.locked} onClick={() => log(p.id, a)}>
                    {a.label} <b>{a.points}</b>
                  </button>
                ))}
                {!status.locked && <small>Logging opens during lock-in only</small>}
              </div>

              {today.length > 0 && (
                <ul className="log">
                  {today.map((e) => (
                    <li key={e._id}>
                      <span>
                        {new Date(e.at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {e.type.replace('_', ' ')} <b>{e.points}</b>
                      </span>
                      <button onClick={() => undo(e._id)}>undo</button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </section>

      <footer>
        <span>Less</span>
        {[...LEVELS].reverse().map((l) => (
          <i key={l.min} style={{ background: l.color }} title={l.label} />
        ))}
        <span>More</span>
        <small>Weekends are not scored. Lowest total pays at month end.</small>
      </footer>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
