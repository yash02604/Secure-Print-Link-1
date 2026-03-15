import { createAppwriteServices } from './appwrite.js';

const isExpired = (expiresAt) => expiresAt ? Date.now() >= new Date(expiresAt).getTime() : false;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const appwrite = createAppwriteServices();
    const id = req.query.id || req.body?.jobId || req.body?.id;
    const token = req.query.token || req.body?.token;
    const printerId = req.body?.printerId || null;
    const releasedBy = req.body?.releasedBy || null;

    if (!id || !token) {
      return res.status(400).json({ error: 'Missing job id or token' });
    }

    const jobDoc = await appwrite.databases.getDocument(appwrite.databaseId, appwrite.collectionId, id);
    if (token !== jobDoc.token) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (isExpired(jobDoc.expiresAt)) {
      return res.status(410).json({ error: 'Print link has expired' });
    }
    if (jobDoc.status === 'released') {
      return res.status(409).json({ error: 'Print job has already been released' });
    }
    if ((jobDoc.status || 'pending') === 'pending') {
      return res.status(403).json({
        error: 'Document must be viewed before releasing. Click the view button first.',
        requiresView: true
      });
    }

    await appwrite.databases.updateDocument(
      appwrite.databaseId,
      appwrite.collectionId,
      id,
      {
        status: 'released',
        releasedAt: new Date().toISOString(),
        printerId,
        releasedBy
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Print job released successfully!',
      status: 'released'
    });
  } catch (error) {
    console.error('release api error:', error);
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.status(500).json({ error: 'Server error', message: error?.message || 'Unknown error' });
  }
}
