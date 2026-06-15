const { getDb } = require('../utils/db');

class Feedback {
  create({ name, email, message }) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.run(
        'INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)',
        [name, email, message],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }
}

module.exports = new Feedback();
