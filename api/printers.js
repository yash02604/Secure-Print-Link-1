import { createAppwriteServices, appwriteQuery } from './appwrite.js';

const staticPrinters = [
  { id: 'printer1', name: 'Main Office Printer', location: 'Main Office', model: '', status: 'online', ip: '', capabilities: [], department: 'All' },
  { id: 'printer2', name: 'Marketing Printer', location: 'Marketing', model: '', status: 'online', ip: '', capabilities: [], department: 'All' },
  { id: 'printer3', name: 'IT Support Printer', location: 'IT Support', model: '', status: 'online', ip: '', capabilities: [], department: 'All' }
];

const parsePrinter = (doc) => ({
  id: doc.printerId || doc.$id,
  name: doc.name || '',
  location: doc.location || '',
  model: doc.model || '',
  status: doc.status || 'online',
  ip: doc.ip || '',
  capabilities: (() => {
    if (Array.isArray(doc.capabilities)) return doc.capabilities;
    if (typeof doc.capabilities === 'string' && doc.capabilities.trim()) {
      try {
        return JSON.parse(doc.capabilities);
      } catch {
        return [];
      }
    }
    return [];
  })(),
  department: doc.department || 'All'
});

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const appwrite = createAppwriteServices();
    const printers = [];
    let offset = 0;
    while (true) {
      const { documents, total } = await appwrite.databases.listDocuments(
        appwrite.databaseId,
        appwrite.printersCollectionId,
        [appwriteQuery.limit(100), appwriteQuery.offset(offset)]
      );
      printers.push(...documents);
      offset += documents.length;
      if (printers.length >= total || documents.length === 0) break;
    }
    if (printers.length === 0) {
      return res.status(200).json({ printers: staticPrinters });
    }
    return res.status(200).json({ printers: printers.map(parsePrinter) });
  } catch (error) {
    console.error('printers api error:', error);
    return res.status(200).json({ printers: staticPrinters });
  }
}
