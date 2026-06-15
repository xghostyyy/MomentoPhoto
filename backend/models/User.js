const { getDb } = require('../utils/db');

const User = {
  findByEmail(email) {
    return new Promise((resolve, reject) => {
      getDb().get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  findById(id) {
    return new Promise((resolve, reject) => {
      getDb().get(
        'SELECT id, email, role, full_name, employee_type, email_notifications FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  },

  create({ email, password_hash, role = 'client', full_name, employee_type = null, email_notifications = 1 }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        `INSERT INTO users (email, password_hash, role, full_name, employee_type, email_notifications)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email, password_hash, role, full_name, employee_type, email_notifications],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  },

  findAllEmployees() {
    return new Promise((resolve, reject) => {
      getDb().all(
        "SELECT id, full_name, employee_type FROM users WHERE role = 'employee'",
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },
};

module.exports = User;
