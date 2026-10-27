const TZ = process.env.TZ_NAME || 'Africa/Accra';

// minutes from midnight, [start, end)
const LOCKIN = [
  [9 * 60, 12 * 60],
  [13 * 60, 15 * 60 + 10],
  [16 * 60 + 10, 17 * 60],
];

export function clock(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

export function status(date = new Date()) {
  const c = clock(date);
  const workday = !['Sat', 'Sun'].includes(c.weekday);
  const locked = workday && LOCKIN.some(([a, b]) => c.minutes >= a && c.minutes < b);
  return { day: c.day, workday, locked, minutes: c.minutes, tz: TZ };
}
