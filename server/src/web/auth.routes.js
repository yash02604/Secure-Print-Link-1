import { Router } from 'express';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { appwriteQuery } from '../storage/appwrite.js';

const router = Router();

const hashPassword = (password, salt) => {
  const key = crypto.scryptSync(password, salt, 32);
  return key.toString('base64');
};

const appwriteReady = (req, res) => {
  if (!req.appwrite) {
    res.status(500).json({ error: 'Appwrite is not configured on the server' });
    return false;
  }
  return true;
};

const sanitizeUser = (user) => ({
  id: user.userId || user.$id,
  username: user.username || '',
  name: user.name || '',
  email: user.email || '',
  role: user.role || 'user',
  department: user.department || ''
});

router.post('/signup', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { username, password, name, email } = req.body || {};

  if (!username || !password || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existing = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.usersCollectionId,
      [appwriteQuery.equal('username', username), appwriteQuery.limit(1)]
    );
    if (existing.total > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const id = nanoid();
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const now = new Date().toISOString();

    const created = await appwrite.databases.createDocument(
      appwrite.databaseId,
      appwrite.usersCollectionId,
      id,
      {
        userId: id,
        username,
        name,
        email,
        department: '',
        role: 'user',
        passwordHash,
        passwordSalt: salt,
        provider: 'local',
        providerId: null,
        createdAt: now
      }
    );

    const user = sanitizeUser(created);
    return res.json({ success: true, user });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to sign up' });
  }
});

router.post('/login', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const result = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.usersCollectionId,
      [appwriteQuery.equal('username', username), appwriteQuery.limit(1)]
    );
    const user = result.documents[0];
    if (!user || !user.passwordSalt || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const calculated = hashPassword(password, user.passwordSalt);
    if (calculated !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    return res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/google', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { idToken } = req.body || {};

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken' });
  }

  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid Google ID token' });
    }
    const payload = await response.json();
    const providerId = payload.sub;
    const email = payload.email;
    const name = payload.name || email;

    const existing = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.usersCollectionId,
      [
        appwriteQuery.equal('provider', 'google'),
        appwriteQuery.equal('providerId', providerId),
        appwriteQuery.limit(1)
      ]
    );
    let user = existing.documents[0];
    if (!user) {
      const id = nanoid();
      const now = new Date().toISOString();
      user = await appwrite.databases.createDocument(
        appwrite.databaseId,
        appwrite.usersCollectionId,
        id,
        {
          userId: id,
          username: email,
          name,
          email,
          department: '',
          role: 'user',
          provider: 'google',
          providerId,
          createdAt: now
        }
      );
    }

    return res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(500).json({ error: 'Failed to login with Google' });
  }
});

export default router;
