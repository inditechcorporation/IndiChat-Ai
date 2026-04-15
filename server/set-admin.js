require('dotenv').config();
const { db } = require('./db');
const email = process.argv[2] || process.env.ADMIN_EMAIL || 'aarifali4012@gmail.com';
db.run('UPDATE users SET is_admin=1 WHERE email=?', [email], function(e) {
  if (e) console.log('Error:', e.message);
  else console.log(`Admin set for ${email}: ${this.changes} row(s) updated`);
  setTimeout(() => process.exit(0), 300);
});
