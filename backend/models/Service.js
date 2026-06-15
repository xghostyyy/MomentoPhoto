const { getDb } = require('../utils/db');

const Service = {
  findAll() {
    return new Promise((resolve, reject) => {
      getDb().all('SELECT * FROM services ORDER BY price ASC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  findById(id) {
    return new Promise((resolve, reject) => {
      getDb().get('SELECT * FROM services WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  findByName(name) {
    return new Promise((resolve, reject) => {
      getDb().get('SELECT * FROM services WHERE name = ?', [name], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  create({ name, price, duration, employee_type = 'photographer' }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'INSERT INTO services (name, price, duration, employee_type) VALUES (?, ?, ?, ?)',
        [name, price, duration, employee_type],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  },
};

module.exports = Service;
