const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Auto-flag admin if email matches
    const adminEmail = process.env.ADMIN_EMAIL || 'aarifali4012@gmail.com';
    if (decoded.email && decoded.email.toLowerCase() === adminEmail.toLowerCase()) {
      req.user.is_admin = 1;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
