import { Client, Databases, Storage, ID, Query } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const requiredEnv = [
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_DATABASE_ID',
  'APPWRITE_COLLECTION_ID',
  'APPWRITE_BUCKET_ID'
];

const getMissingEnv = () => requiredEnv.filter((key) => !process.env[key]);

export const createAppwriteServices = () => {
  const missingEnv = getMissingEnv();
  if (missingEnv.length > 0) {
    throw new Error(`Missing Appwrite configuration: ${missingEnv.join(', ')}`);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
    databaseId: process.env.APPWRITE_DATABASE_ID,
    collectionId: process.env.APPWRITE_COLLECTION_ID,
    bucketId: process.env.APPWRITE_BUCKET_ID,
    usersCollectionId: process.env.APPWRITE_USERS_COLLECTION_ID || 'users',
    printersCollectionId: process.env.APPWRITE_PRINTERS_COLLECTION_ID || 'printers',
    filesCollectionId: process.env.APPWRITE_FILES_COLLECTION_ID || 'encrypted_files'
  };
};

export const createFileInputFromBuffer = (buffer, filename = 'document.bin') =>
  InputFile.fromBuffer(buffer, filename);

export const generateUniqueId = () => ID.unique();

export const appwriteQuery = Query;
