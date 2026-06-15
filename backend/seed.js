require('dotenv').config();
const { initDb, getDb } = require('./utils/db');

const services = [
  { name: 'Портретная съёмка',       price: 5000,  duration: 60  },
  { name: 'Семейная фотосессия',      price: 8000,  duration: 90  },
  { name: 'Предметная съёмка',        price: 3500,  duration: 45  },
  { name: 'Свадебная фотосессия',     price: 25000, duration: 480 },
];

async function seed() {
  await initDb();
  const db = getDb();

  for (const s of services) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO services (name, price, duration) VALUES (?, ?, ?)',
        [s.name, s.price, s.duration],
        (err) => (err ? reject(err) : resolve())
      );
    });
    console.log(`Seeded service: ${s.name}`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
