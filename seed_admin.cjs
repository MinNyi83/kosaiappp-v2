const crypto = require('crypto');
const salt = '1234567890abcdef';
const password = 'admin';
const hash = crypto
  .createHash('sha256')
  .update(password + salt)
  .digest('hex');
const pin = `$sha256$${salt}$${hash}`;
console.log(
  `INSERT INTO technicians (id, name, role, email, active, pin) VALUES ('ADMIN-001', 'Admin', 'Admin', 'admin@example.com', 1, '${pin}');`
);
