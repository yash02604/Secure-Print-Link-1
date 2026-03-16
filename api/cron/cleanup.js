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

const isExpired = (expiresAt) => expiresAt ? Date.now() >= new Date(expiresAt).getTime() : false;

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
    const purgeBeforeIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let offset = 0;
    let markedExpired = 0;
    let deletedCount = 0;

    // Step 1: mark newly expired jobs
    while (true) {
      const { documents, total } = await appwrite.databases.listDocuments(
        appwrite.databaseId,
        appwrite.collectionId,
        [
          appwriteQuery.lessThanEqual('expiresAt', nowIso),
          appwriteQuery.notEqual('status', 'expired'),
          appwriteQuery.limit(100),
          appwriteQuery.offset(offset)
        ]
      );
      for (const jobDoc of documents) {
        if (!isExpired(jobDoc.expiresAt)) {
          continue;
        }
        await appwrite.databases.updateDocument(
          appwrite.databaseId,
          appwrite.collectionId,
          jobDoc.$id || jobDoc.jobId,
          { status: 'expired' }
        );
        markedExpired += 1;
      }
      offset += documents.length;
      if (offset >= total || documents.length === 0) break;
    }

    // Step 2: purge jobs that stayed expired for more than 1 hour
    offset = 0;
    while (true) {
      const { documents, total } = await appwrite.databases.listDocuments(
        appwrite.databaseId,
        appwrite.collectionId,
        [
          appwriteQuery.equal('status', 'expired'),
          appwriteQuery.lessThanEqual('expiresAt', purgeBeforeIso),
          appwriteQuery.limit(100),
          appwriteQuery.offset(offset)
        ]
      );
      for (const jobDoc of documents) {
        await deleteJobPermanently(appwrite, jobDoc);
        deletedCount += 1;
      }
      offset += documents.length;
      if (offset >= total || documents.length === 0) break;
    }

    return res.status(200).json({ success: true, markedExpired, deletedCount });
  } catch (error) {
    console.error('cleanup api error:', error);
    return res.status(500).json({ error: 'Server error', message: error?.message || 'Unknown error' });
  }
}
