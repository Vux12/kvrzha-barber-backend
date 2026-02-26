/**
 * Kvrzha Berber – Backend API
 * Node.js + Express
 *
 * Instalacija:
 *   npm init -y
 *   npm install express cors uuid
 *
 * Pokretanje:
 *   node server.js
 *
 * Server radi na: http://localhost:3001
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── In-memory "baza" (za produkciju koristiti pravu DB npr. SQLite/PostgreSQL) ──
let appointments = [];

// ── Helper: minimum datum (2 dana unapred) ──
function getMinDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  return d;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ── GET /api/slots?date=YYYY-MM-DD ──
// Vraća zauzete termine za dati datum
app.get('/api/slots', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Nedostaje parametar date.' });

  const taken = appointments
    .filter(a => a.date === date && a.status !== 'cancelled')
    .map(a => a.time);

  res.json({ date, taken });
});

// ── POST /api/book ──
// Zakazivanje novog termina
app.post('/api/book', (req, res) => {
  const { name, phone, service, date, time, note } = req.body;

  // Validacija obaveznih polja
  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Sva obavezna polja moraju biti popunjena.' });
  }

  // Validacija datuma (min 2 dana unapred)
  const appointmentDate = parseDate(date);
  const minDate = getMinDate();
  if (appointmentDate < minDate) {
    return res.status(400).json({ error: 'Termin mora biti rezervisan najmanje 2 dana unapred.' });
  }

  // Provera da li je termin već zauzet
  const alreadyTaken = appointments.some(
    a => a.date === date && a.time === time && a.status !== 'cancelled'
  );
  if (alreadyTaken) {
    return res.status(409).json({ error: 'Ovaj termin je već zauzet. Molimo izaberi drugi.' });
  }

  // Kreiranje termina
  const appointment = {
    id: uuidv4(),
    name: name.trim(),
    phone: phone.trim(),
    service,
    date,
    time,
    note: note ? note.trim() : '',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  appointments.push(appointment);
  console.log(`[NOVA REZERVACIJA] ${name} – ${date} u ${time} (${service})`);

  res.status(201).json({ message: 'Termin uspešno zakazan!', appointment });
});

// ── GET /api/appointments ──
// Lista svih aktivnih nadolazećih termina (sortirano po datumu)
app.get('/api/appointments', (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = appointments
    .filter(a => a.status !== 'cancelled' && parseDate(a.date) >= today)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
    });

  res.json({ appointments: upcoming, total: upcoming.length });
});

// ── DELETE /api/appointments/:id ──
// Otkazivanje termina
app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const appt = appointments.find(a => a.id === id);

  if (!appt) return res.status(404).json({ error: 'Termin nije pronađen.' });
  if (appt.status === 'cancelled') return res.status(400).json({ error: 'Termin je već otkazan.' });

  appt.status = 'cancelled';
  console.log(`[OTKAZAN TERMIN] ID: ${id} – ${appt.name} ${appt.date} ${appt.time}`);

  res.json({ message: 'Termin uspešno otkazan.' });
});

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), appointments: appointments.length });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n✂  Kvrzha Berber API pokrenut na http://localhost:${PORT}`);
  console.log(`   Dostupni endpointi:`);
  console.log(`   GET  /api/slots?date=YYYY-MM-DD`);
  console.log(`   POST /api/book`);
  console.log(`   GET  /api/appointments`);
  console.log(`   DEL  /api/appointments/:id\n`);
});
