// Loads .env.test.local (gitignored) so integration tests can reach the
// Razorpay TEST API. Absent the file, those tests skip themselves.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '.env.test.local');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const key = t.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = t.slice(i + 1).trim();
  }
}
