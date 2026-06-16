require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('./utils/db');

const services = [
  { name: 'Портретная съёмка',    price: 5000,  duration: 60,  employee_type: 'photographer' },
  { name: 'Семейная фотосессия',  price: 8000,  duration: 90,  employee_type: 'photographer' },
  { name: 'Предметная съёмка',    price: 3500,  duration: 45,  employee_type: 'photographer' },
  { name: 'Свадебная фотосессия', price: 25000, duration: 480, employee_type: 'photographer' },
  { name: 'Аренда помещения',     price: 2000,  duration: 60,  employee_type: 'manager'      },
];

const staff = [
  { email: 'admin@momento.ru',   full_name: 'Администратор',     role: 'admin',     employee_type: null           },
  { email: 'photo@momento.ru',   full_name: 'Алексей Смирнов',   role: 'employee',  employee_type: 'photographer' },
  { email: 'manager@momento.ru', full_name: 'Мария Иванова',     role: 'employee',  employee_type: 'manager'      },
  { email: 'dmitry@momento.ru',  full_name: 'Дмитрий Соколов',   role: 'employee',  employee_type: 'photographer' },
  { email: 'elena@momento.ru',   full_name: 'Елена Морозова',    role: 'employee',  employee_type: 'stylist'      },
  { email: 'igor@momento.ru',    full_name: 'Игорь Волков',      role: 'employee',  employee_type: 'retoucher'    },
  { email: 'anna@momento.ru',    full_name: 'Анна Кузнецова',    role: 'employee',  employee_type: 'photographer' },
];

const demoClients = [
  { email: 'client@demo.ru',   full_name: 'Иван Петров',     password: 'demo123' },
  { email: 'client2@demo.ru',  full_name: 'Ольга Захарова',  password: 'demo123' },
  { email: 'client3@demo.ru',  full_name: 'Сергей Николаев', password: 'demo123' },
];

const demoFeedback = [
  { name: 'Наталья К.',  email: 'natalia@mail.ru',  message: 'Очень довольна результатом! Фотографы профессиональные, атмосфера уютная. Буду рекомендовать всем друзьям!' },
  { name: 'Дмитрий В.',  email: 'dmitryv@gmail.com',message: 'Делали семейную фотосессию. Всё прошло отлично, дети не капризничали, что удивительно. Спасибо за терпение!' },
  { name: 'Анастасия М.', email: null,              message: 'Хотела бы узнать о корпоративной съёмке для нашей компании (20 человек). Как с вами связаться?' },
];

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    })
  );
}

function dbGet(db, sql, params) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );
}

async function seed() {
  await initDb();
  const db = getDb();

  // ── Services ────────────────────────────────────────────────────────
  await dbRun(db, 'DELETE FROM services', []);
  for (const s of services) {
    await dbRun(db, 'INSERT INTO services (name, price, duration, employee_type) VALUES (?, ?, ?, ?)', [s.name, s.price, s.duration, s.employee_type]);
    console.log(`  service: ${s.name}`);
  }

  // ── Staff ───────────────────────────────────────────────────────────
  const staffHash = await bcrypt.hash('test123', 10);
  const staffEmails = staff.map((e) => e.email);
  const ph = staffEmails.map(() => '?').join(',');
  await dbRun(db, `DELETE FROM users WHERE role = 'employee' AND email NOT IN (${ph})`, staffEmails);

  for (const e of staff) {
    await dbRun(db,
      `INSERT INTO users (email, password_hash, role, full_name, employee_type)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         full_name = excluded.full_name, role = excluded.role,
         employee_type = excluded.employee_type, password_hash = excluded.password_hash`,
      [e.email, staffHash, e.role, e.full_name, e.employee_type]
    );
    console.log(`  staff: ${e.email} (${e.role})`);
  }

  // ── Demo clients ─────────────────────────────────────────────────────
  const clientIds = {};
  for (const c of demoClients) {
    const hash = await bcrypt.hash(c.password, 10);
    await dbRun(db,
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES (?, ?, 'client', ?)
       ON CONFLICT(email) DO UPDATE SET full_name = excluded.full_name, password_hash = excluded.password_hash`,
      [c.email, hash, c.full_name]
    );
    const row = await dbGet(db, 'SELECT id FROM users WHERE email = ?', [c.email]);
    clientIds[c.email] = row.id;
    console.log(`  client: ${c.email} / ${c.password}`);
  }

  // ── Demo bookings ────────────────────────────────────────────────────
  // Wipe old demo bookings (those with demo client emails)
  const demoEmails = demoClients.map(() => '?').join(',');
  await dbRun(db, `DELETE FROM bookings WHERE client_email IN (${demoEmails})`, demoClients.map(c => c.email));

  const bookingDefs = [
    { client: demoClients[0], service: 'Портретная съёмка',    phone: '+7 (916) 123-45-67', date: '2026-07-05', time: '11:00', status: 'done'      },
    { client: demoClients[0], service: 'Семейная фотосессия',   phone: '+7 (916) 123-45-67', date: '2026-07-20', time: '14:00', status: 'confirmed'  },
    { client: demoClients[1], service: 'Свадебная фотосессия',  phone: '+7 (903) 987-65-43', date: '2026-08-10', time: '09:00', status: 'confirmed'  },
    { client: demoClients[1], service: 'Предметная съёмка',     phone: '+7 (903) 987-65-43', date: '2026-06-30', time: '16:00', status: 'pending'    },
    { client: demoClients[2], service: 'Аренда помещения',      phone: '+7 (926) 555-00-11', date: '2026-07-12', time: '10:00', status: 'done'      },
    { client: demoClients[2], service: 'Портретная съёмка',     phone: '+7 (926) 555-00-11', date: '2026-08-01', time: '13:00', status: 'pending'    },
    { client: demoClients[0], service: 'Предметная съёмка',     phone: '+7 (916) 123-45-67', date: '2026-06-25', time: '15:00', status: 'cancelled'  },
  ];

  const bookingIds = {};
  for (const b of bookingDefs) {
    const { lastID } = await dbRun(db,
      `INSERT INTO bookings (client_name, client_phone, client_email, service, status, booking_date, booking_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [b.client.full_name, b.phone, b.client.email, b.service, b.status, b.date, b.time]
    );
    const key = `${b.client.email}::${b.service}::${b.status}`;
    bookingIds[key] = lastID;
    console.log(`  booking #${lastID}: [${b.status}] ${b.client.full_name} — ${b.service}`);
  }

  // ── Demo reviews (on done/confirmed bookings) ─────────────────────────
  const reviewDefs = [
    {
      key:    `${demoClients[0].email}::Портретная съёмка::done`,
      rating: 5,
      text:   'Потрясающие фотографии! Я даже не ожидала, что получится так красиво. Алексей — настоящий профессионал, смог раскрепостить меня перед камерой. Обязательно вернусь!',
    },
    {
      key:    `${demoClients[2].email}::Аренда помещения::done`,
      rating: 4,
      text:   'Уютная студия, хорошее освещение, всё необходимое оборудование есть. Единственный минус — парковка поблизости платная. В целом очень доволен.',
    },
  ];

  // Delete old demo reviews tied to these bookings
  const doneKeys = reviewDefs.map(r => bookingIds[r.key]).filter(Boolean);
  if (doneKeys.length) {
    const rph = doneKeys.map(() => '?').join(',');
    await dbRun(db, `DELETE FROM reviews WHERE booking_id IN (${rph})`, doneKeys);
  }

  for (const r of reviewDefs) {
    const bid = bookingIds[r.key];
    if (!bid) { console.log(`  review skipped (booking not found): ${r.key}`); continue; }
    await dbRun(db,
      'INSERT INTO reviews (booking_id, rating, text, is_published) VALUES (?, ?, ?, 1)',
      [bid, r.rating, r.text]
    );
    console.log(`  review: booking #${bid} — ${r.rating}★`);
  }

  // ── Demo feedback ─────────────────────────────────────────────────────
  await dbRun(db, 'DELETE FROM feedback WHERE email IN (?, ?, ?)', [
    'natalia@mail.ru', 'dmitryv@gmail.com', null,
  ]);
  for (const f of demoFeedback) {
    await dbRun(db, 'INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)', [f.name, f.email, f.message]);
    console.log(`  feedback: ${f.name}`);
  }

  console.log('\nSeed complete.');
  console.log('\nDemo logins:');
  console.log('  admin@momento.ru   / test123  (admin)');
  console.log('  photo@momento.ru   / test123  (photographer)');
  console.log('  manager@momento.ru / test123  (manager)');
  console.log('  client@demo.ru     / demo123  (client)');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
