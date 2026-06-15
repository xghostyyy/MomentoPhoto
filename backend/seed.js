require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('./utils/db');

const services = [
  { name: 'Портретная съёмка',   price: 5000,  duration: 60  },
  { name: 'Семейная фотосессия', price: 8000,  duration: 90  },
  { name: 'Предметная съёмка',   price: 3500,  duration: 45  },
  { name: 'Свадебная фотосессия',price: 25000, duration: 480 },
];

const employees = [
  { email: 'photo@momento.ru',   full_name: 'Алексей Фотограф', role: 'employee', employee_type: 'photographer' },
  { email: 'manager@momento.ru', full_name: 'Мария Менеджер',   role: 'employee', employee_type: 'manager'      },
];

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, (err) => (err ? reject(err) : resolve()))
  );
}

async function seed() {
  await initDb();
  const db = getDb();

  for (const s of services) {
    await dbRun(
      db,
      'INSERT OR IGNORE INTO services (name, price, duration) VALUES (?, ?, ?)',
      [s.name, s.price, s.duration]
    );
    console.log(`Seeded service: ${s.name}`);
  }

  const passwordHash = await bcrypt.hash('test123', 10);

  for (const e of employees) {
    await dbRun(
      db,
      `INSERT OR IGNORE INTO users (email, password_hash, role, full_name, employee_type)
       VALUES (?, ?, ?, ?, ?)`,
      [e.email, passwordHash, e.role, e.full_name, e.employee_type]
    );
    console.log(`Seeded employee: ${e.email} (${e.employee_type})`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
