/**
 * Run: node make-admin.js your@email.com
 * Makes a user admin
 */
require('dotenv').config();
const { run, get } = require('./db');

const email = process.argv[2];
if (!email) { console.log('Usage: node make-admin.js your@email.com'); process.exit(1); }

setTimeout(async () => {
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) { console.log('User not found:', email); process.exit(1); }
  await run('UPDATE users SET is_admin = 1 WHERE email = ?', [email]);
  console.log(`✅ ${email} is now admin`);
  process.exit(0);
}, 500);
