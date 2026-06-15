const { getDb } = require('../utils/db');

const Booking = {
  create({ client_name, client_phone, service, employee_id = null, client_email = null }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        `INSERT INTO bookings (client_name, client_phone, service, employee_id, client_email)
         VALUES (?, ?, ?, ?, ?)`,
        [client_name, client_phone, service, employee_id, client_email],
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

  findByClientEmail(email, status = null) {
    return new Promise((resolve, reject) => {
      const sql = status
        ? 'SELECT * FROM bookings WHERE client_email = ? AND status = ? ORDER BY created_at DESC'
        : 'SELECT * FROM bookings WHERE client_email = ? ORDER BY created_at DESC';
      const params = status ? [email, status] : [email];
      getDb().all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  findForDashboard(employeeType = null) {
    return new Promise((resolve, reject) => {
      const sql = employeeType
        ? `SELECT b.*, s.employee_type as service_employee_type
           FROM bookings b
           LEFT JOIN services s ON s.name = b.service
           WHERE s.employee_type = ?
           ORDER BY b.created_at DESC`
        : `SELECT b.*, s.employee_type as service_employee_type
           FROM bookings b
           LEFT JOIN services s ON s.name = b.service
           ORDER BY b.created_at DESC`;
      const params = employeeType ? [employeeType] : [];
      getDb().all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  countSince(isoDate, employeeType = null) {
    return new Promise((resolve, reject) => {
      const sql = employeeType
        ? `SELECT COUNT(*) as count FROM bookings b
           LEFT JOIN services s ON s.name = b.service
           WHERE b.created_at > ? AND s.employee_type = ?`
        : `SELECT COUNT(*) as count FROM bookings WHERE created_at > ?`;
      const params = employeeType ? [isoDate, employeeType] : [isoDate];
      getDb().get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      });
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
