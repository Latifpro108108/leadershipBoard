import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { status } from './schedule.js';

const PEOPLE = ['latif', 'precious'];
const ALLOWED_POINTS = { talk: [-20], phone: [-50], phone_serious: [-10, 0] };

const Event = mongoose.model(
  'Event',
  new mongoose.Schema({
    person: String,
    type: String,
    points: Number,
    note: String,
    day: { type: String, index: true },
    at: { type: Date, default: Date.now },
  }),
);

const app = express();
app.use(express.json());

app.get('/api/board', async (req, res) => {
  const month = String(req.query.month || status().day.slice(0, 7));
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'bad month' });
  const events = await Event.find({ day: new RegExp(`^${month}-`) }).sort({ at: 1 });
  res.json({ events, status: status() });
});

app.post('/api/events', async (req, res) => {
  const { person, type, points, note } = req.body;
  const s = status();
  if (!PEOPLE.includes(person)) return res.status(400).json({ error: 'unknown person' });
  if (!ALLOWED_POINTS[type]?.includes(points)) return res.status(400).json({ error: 'bad points' });
  if (!s.locked) return res.status(403).json({ error: 'Free time: nothing can be logged now' });
  const event = await Event.create({ person, type, points, note: note || '', day: s.day });
  res.status(201).json(event);
});

app.delete('/api/events/:id', async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

await mongoose.connect(process.env.MONGODB_URI);
app.listen(process.env.PORT || 4000, () => console.log('api ready'));
