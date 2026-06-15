require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('./utils/db');

const services = [
  { name: 'Портретная съёмка',    price: 5000,  duration: 60,  employee_type: 'photographer' },
  { name: 'Семейная фотосессия',  price: 8000,  duration: 90,  employee_type: 'photographer' },
  { name: 'Предметная съёмка',    price: 3500,  duration: 45,  employee_type: 'photographer' },
  { name: 'Свадебная фотосессия', price: 25000, duration: 480, employee_type: 'photographer' },
  { name: 'Аренда помещения',     price: 2000,  duration: 60,  employee_type: 'manager'      },
];

const employees = [
  { email: 'admin@momento.ru',   full_name: 'Администратор',     role: 'admin',     employee_type: null           },
  { email: 'photo@momento.ru',   full_name: 'Алексей Смирнов',   role: 'employee',  employee_type: 'photographer' },
  { email: 'manager@momento.ru', full_name: 'Мария Иванова',     role: 'employee',  employee_type: 'manager'      },
  { email: 'dmitry@momento.ru',  full_name: 'Дмитрий Соколов',   role: 'employee',  employee_type: 'photographer' },
  { email: 'elena@momento.ru',   full_name: 'Елена Морозова',    role: 'employee',  employee_type: 'stylist'      },
  { email: 'igor@momento.ru',    full_name: 'Игорь Волков',      role: 'employee',  employee_type: 'retoucher'    },
  { email: 'anna@momento.ru',    full_name: 'Анна Кузнецова',    role: 'employee',  employee_type: 'photographer' },
];

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, (err) => (err ? reject(err) : resolve()))
  );
}

async function seed() {
  await initDb();
  const db = getDb();

  // Wipe and re-insert so seed is idempotent regardless of UNIQUE constraints
  await dbRun(db, 'DELETE FROM services');
  for (const s of services) {
    await dbRun(
      db,
      'INSERT INTO services (name, price, duration, employee_type) VALUES (?, ?, ?, ?)',
      [s.name, s.price, s.duration, s.employee_type]
    );
    console.log(`Seeded service: ${s.name} → ${s.employee_type}`);
  }

  const passwordHash = await bcrypt.hash('test123', 10);

  // Remove stray employees left over from earlier tests (keep only seeded staff + real clients)
  const seededEmails = employees.map((e) => e.email);
  const placeholders = seededEmails.map(() => '?').join(',');
  await dbRun(db, `DELETE FROM users WHERE role = 'employee' AND email NOT IN (${placeholders})`, seededEmails);

  for (const e of employees) {
    await dbRun(
      db,
      `INSERT INTO users (email, password_hash, role, full_name, employee_type)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         full_name     = excluded.full_name,
         role          = excluded.role,
         employee_type = excluded.employee_type,
         password_hash = excluded.password_hash`,
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
