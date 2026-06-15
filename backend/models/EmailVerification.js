const { getDb } = require('../utils/db');

const EmailVerification = {
  upsert({ email, code, password_hash, full_name, expires_at }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        `INSERT INTO email_verifications (email, code, password_hash, full_name, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           code          = excluded.code,
           password_hash = excluded.password_hash,
           full_name     = excluded.full_name,
           expires_at    = excluded.expires_at,
           created_at    = datetime('now')`,
        [email, code, password_hash, full_name, expires_at],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  },

  findByEmail(email) {
    return new Promise((resolve, reject) => {
      getDb().get('SELECT * FROM email_verifications WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  deleteByEmail(email) {
    return new Promise((resolve, reject) => {
      getDb().run('DELETE FROM email_verifications WHERE email = ?', [email], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  },
};

module.exports = EmailVerification;
