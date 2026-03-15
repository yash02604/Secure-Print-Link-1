import { Router } from 'express';
import { nanoid } from 'nanoid';
import { appwriteQuery } from '../storage/appwrite.js';

const router = Router();
const staticPrinters = [
  { id: 'printer1', name: 'Main Office Printer', location: 'Main Office', model: '', status: 'online', ip: '', capabilities: [], department: 'All' },
  { id: 'printer2', name: 'Marketing Printer', location: 'Marketing', model: '', status: 'online', ip: '', capabilities: [], department: 'All' },
  { id: 'printer3', name: 'IT Support Printer', location: 'IT Support', model: '', status: 'online', ip: '', capabilities: [], department: 'All' }
];

const appwriteReady = (req, res) => {
  if (!req.appwrite) {
    res.status(500).json({ error: 'Appwrite is not configured on the server' });
    return false;
  }
  return true;
};

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

const listAllPrinters = async (appwrite) => {
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
    if (printers.length >= total || documents.length === 0) {
      break;
    }
  }
  return printers;
};

router.get('/', async (req, res) => {
  if (!req.appwrite) {
    return res.json({ printers: staticPrinters });
  }
  const appwrite = req.appwrite;
  try {
    const printers = await listAllPrinters(appwrite);
    if (printers.length === 0) {
      return res.json({ printers: staticPrinters });
    }
    return res.json({ printers: printers.map(parsePrinter) });
  } catch (error) {
    console.error('Error fetching printers from Appwrite:', error);
    return res.json({ printers: staticPrinters });
  }
});

router.post('/', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { name, location, model, status = 'online', ip, capabilities = [], department = 'All' } = req.body || {};
  const id = nanoid();
  try {
    const payload = {
      printerId: id,
      name: name || '',
      location: location || '',
      model: model || '',
      status,
      ip: ip || '',
      capabilities: JSON.stringify(Array.isArray(capabilities) ? capabilities : []),
      department
    };
    await appwrite.databases.createDocument(
      appwrite.databaseId,
      appwrite.printersCollectionId,
      id,
      payload
    );
    return res.json({ printer: { id, name, location, model, status, ip, capabilities, department } });
  } catch (error) {
    console.error('Error creating printer in Appwrite:', error);
    return res.status(500).json({ error: 'Failed to create printer' });
  }
});

router.patch('/:id', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { id } = req.params;
  const updates = req.body || {};
  const payload = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.model !== undefined) payload.model = updates.model;
  if (updates.ip !== undefined) payload.ip = updates.ip;
  if (updates.department !== undefined) payload.department = updates.department;
  if (updates.capabilities !== undefined) {
    payload.capabilities = JSON.stringify(Array.isArray(updates.capabilities) ? updates.capabilities : []);
  }
  try {
    await appwrite.databases.updateDocument(
      appwrite.databaseId,
      appwrite.printersCollectionId,
      id,
      payload
    );
    return res.json({ success: true });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Printer not found' });
    }
    console.error('Error updating printer in Appwrite:', error);
    return res.status(500).json({ error: 'Failed to update printer' });
  }
});

router.delete('/:id', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { id } = req.params;
  try {
    await appwrite.databases.deleteDocument(
      appwrite.databaseId,
      appwrite.printersCollectionId,
      id
    );
    return res.json({ success: true });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Printer not found' });
    }
    console.error('Error deleting printer from Appwrite:', error);
    return res.status(500).json({ error: 'Failed to delete printer' });
  }
});

export default router;
