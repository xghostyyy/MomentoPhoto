const { getDb } = require('../utils/db');

const Booking = {
  create({ client_name, client_phone, service, employee_id = null }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        `INSERT INTO bookings (client_name, client_phone, service, employee_id)
         VALUES (?, ?, ?, ?)`,
        [client_name, client_phone, service, employee_id],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  },

  findAll() {
    return new Promise((resolve, reject) => {
      getDb().all(
        `SELECT b.*, u.full_name AS employee_name
         FROM bookings b
         LEFT JOIN users u ON b.employee_id = u.id
         ORDER BY b.created_at DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  findById(id) {
    return new Promise((resolve, reject) => {
      getDb().get(
        `SELECT b.*, u.full_name AS employee_name
         FROM bookings b
         LEFT JOIN users u ON b.employee_id = u.id
         WHERE b.id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  },

  updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'UPDATE bookings SET status = ? WHERE id = ?',
        [status, id],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  },
};

module.exports = Booking;
