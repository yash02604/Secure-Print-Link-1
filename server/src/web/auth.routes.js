import { Router } from 'express';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

const router = Router();

const hashPassword = (password, salt) => {
  const key = crypto.scryptSync(password, salt, 32);
  return key.toString('base64');
};

router.post('/signup', (req, res) => {
  const db = req.db;
  const { username, password, name, email } = req.body || {};

  if (!username || !password || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const id = nanoid();
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, name, email, department, role, pin, passwordHash, passwordSalt, provider, providerId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, name, email, '', 'user', null, passwordHash, salt, 'local', null, now);

    const user = { id, username, name, email, role: 'user', department: '' };
    return res.json({ success: true, user });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to sign up' });
  }
});

router.post('/login', (req, res) => {
  const db = req.db;
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !user.passwordSalt || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const calculated = hashPassword(password, user.passwordSalt);
    if (calculated !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const { passwordHash, passwordSalt, pin, provider, providerId, createdAt, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// Google login using ID token verification (client obtains idToken via Google Identity Services)
router.post('/google', async (req, res) => {
  const db = req.db;
  const { idToken } = req.body || {};

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken' });
  }

  try {
    // Verify token with Google
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid Google ID token' });
    }
    const payload = await response.json();
    const providerId = payload.sub;
    const email = payload.email;
    const name = payload.name || email;

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE provider = ? AND providerId = ?').get('google', providerId);
    if (!user) {
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, username, name, email, department, role, pin, provider, providerId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, email, name, email, '', 'user', null, 'google', providerId, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    const { passwordHash, passwordSalt, pin, provider, providerId: pid, createdAt, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(500).json({ error: 'Failed to login with Google' });
  }
});

export default router;
