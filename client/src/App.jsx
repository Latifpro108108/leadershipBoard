import { useCallback, useEffect, useState } from 'react';

const PEOPLE = [
  { id: 'latif', name: 'Latif' },
  { id: 'precious', name: 'Precious' },
];

const ACTIONS = [
  { type: 'talk', points: -20, label: 'Spoke (non-work)' },
  { type: 'phone', points: -50, label: 'Touched phone' },
  { type: 'phone_serious', points: -10, label: 'Phone, serious reason' },
  { type: 'phone_serious', points: 0, label: 'Phone, serious reason (free)' },
];

const pad = (n) => String(n).padStart(2, '0');

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthDays(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(y, m - 1, i + 1);
    return { n: i + 1, key: `${month}-${pad(i + 1)}`, weekday: date.getDay() };
  });
}

function scoreColor(score) {
  return `hsl(${Math.round(score * 1.2)} 70% 55%)`;
}

export default function App() {
  const [month, setMonth] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/board${month ? `?month=${month}` : ''}`);
      const data = await res.json();
      setBoard(data);
      setMonth((m) => m || data.status.day.slice(0, 7));
    } catch {
      setError('Cannot reach server');
    }
  }, [month]);

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
  const days = monthDays(month);

  const dayScore = (person, key) => {
    const lost = events
      .filter((e) => e.person === person && e.day === key)
      .reduce((sum, e) => sum + e.points, 0);
    return Math.max(0, 100 + lost);
  };

  const isWorkday = (d) => d.weekday !== 0 && d.weekday !== 6;
  const counted = (d) => isWorkday(d) && d.key <= status.day;
  const total = (person) =>
    days.filter(counted).reduce((sum, d) => sum + dayScore(person, d.key), 0);

  const totals = PEOPLE.map((p) => total(p.id));
  const payer =
    totals[0] === totals[1] ? null : totals[0] < totals[1] ? PEOPLE[0].name : PEOPLE[1].name;

  return (
    <main>
      <header>
        <h1>LOCK—IN</h1>
        <div className="nav">
          <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <span>{month}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
        <div className={`state ${status.locked ? 'on' : ''}`}>
          {status.locked ? 'LOCK-IN · logging open' : 'FREE TIME · logging closed'}
        </div>
      </header>

      <p className="payer">
        {payer ? `Most talkative so far: ${payer} pays` : 'All level. Nobody pays yet'}
      </p>

      <section className="cols">
        {PEOPLE.map((p, i) => {
          const today = events.filter((e) => e.person === p.id && e.day === status.day);
          return (
            <article key={p.id}>
              <div className="head">
                <h2>{p.name}</h2>
                <strong>{totals[i]} pts</strong>
              </div>

              <div className="grid">
                {Array.from({ length: (days[0].weekday + 6) % 7 }).map((_, k) => (
                  <i key={`pad${k}`} />
                ))}
                {days.map((d) => {
                  const show = counted(d);
                  const score = dayScore(p.id, d.key);
                  return (
                    <div
                      key={d.key}
                      className={`box ${d.key === status.day ? 'today' : ''} ${
                        !isWorkday(d) ? 'off' : ''
                      }`}
                      style={show ? { background: scoreColor(score) } : undefined}
                      title={show ? `${d.key}: ${score}` : d.key}
                    >
                      <span>{d.n}</span>
                    </div>
                  );
                })}
              </div>

              <div className="actions">
                {ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    disabled={!status.locked}
                    onClick={() => log(p.id, a)}
                  >
                    {a.label} <b>{a.points}</b>
                  </button>
                ))}
              </div>

              <ul className="log">
                {today.map((e) => (
                  <li key={e._id}>
                    <span>
                      {e.type.replace('_', ' ')} {e.points}
                    </span>
                    <button onClick={() => undo(e._id)}>undo</button>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
