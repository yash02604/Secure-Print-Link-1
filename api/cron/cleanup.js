import { createAppwriteServices, appwriteQuery } from '../appwrite.js';

const deleteFileSilently = async (appwrite, fileId) => {
  if (!fileId || !appwrite.bucketId) return;
  try {
    await appwrite.storage.deleteFile(appwrite.bucketId, fileId);
  } catch (error) {
    if (error?.code !== 404) {
      console.error('Failed to delete Appwrite file:', fileId, error);
    }
  }
};

const deleteJobPermanently = async (appwrite, jobDoc) => {
  await deleteFileSilently(appwrite, jobDoc.fileId);
  await appwrite.databases.deleteDocument(appwrite.databaseId, appwrite.collectionId, jobDoc.$id || jobDoc.jobId);
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const appwrite = createAppwriteServices();
    const nowIso = new Date().toISOString();
    let offset = 0;
    let processed = 0;

    while (true) {
      const { documents, total } = await appwrite.databases.listDocuments(
        appwrite.databaseId,
        appwrite.collectionId,
        [appwriteQuery.lessThanEqual('expiresAt', nowIso), appwriteQuery.limit(100), appwriteQuery.offset(offset)]
      );
      for (const jobDoc of documents) {
        await deleteJobPermanently(appwrite, jobDoc);
        processed += 1;
      }
      offset += documents.length;
      if (offset >= total || documents.length === 0) break;
    }

    const legacyDeleted = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.collectionId,
      [appwriteQuery.equal('status', 'deleted'), appwriteQuery.limit(100)]
    );
    for (const jobDoc of legacyDeleted.documents) {
      await deleteJobPermanently(appwrite, jobDoc);
      processed += 1;
    }

    return res.status(200).json({ success: true, deletedCount: processed });
  } catch (error) {
    console.error('cleanup api error:', error);
    return res.status(500).json({ error: 'Server error', message: error?.message || 'Unknown error' });
  }
}
