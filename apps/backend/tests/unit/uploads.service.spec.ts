import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { UploadsService } from '../../src/uploads/uploads.service';

const mockUpload = jest.fn().mockResolvedValue(undefined);
const mockCreate = jest.fn().mockResolvedValue(undefined);
const mockDownload = jest.fn().mockResolvedValue({ readableStreamBody: Readable.from('bytes') });
const mockGetProperties = jest.fn().mockResolvedValue({ contentLength: 100 });
const mockContainer = {
  createIfNotExists: mockCreate,
  getBlockBlobClient: jest.fn(() => ({ uploadData: mockUpload })),
  getBlobClient: jest.fn(() => ({ getProperties: mockGetProperties, download: mockDownload })),
};
const mockGetContainer = jest.fn(() => mockContainer);
jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: Object.assign(jest.fn(() => ({ getContainerClient: mockGetContainer })), {
    fromConnectionString: jest.fn(() => ({ getContainerClient: mockGetContainer })),
  }),
}));
jest.mock('@azure/identity', () => ({ DefaultAzureCredential: jest.fn() }));

describe('UploadsService storage', () => {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0uUAAAAASUVORK5CYII=', 'base64');
  const file = { buffer: image, size: image.length, mimetype: 'image/png' } as Express.Multer.File;
  beforeEach(() => {
    jest.clearAllMocks();
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test' };
    delete env.AZURE_STORAGE_ACCOUNT_URL;
    delete env.AZURE_BLOB_CONNECTION_STRING;
    delete env.AZURE_TABLES_CONNECTION_STRING;
    delete env.AZURE_UPLOADS_CONTAINER;
    jest.replaceProperty(process, 'env', env);
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses managed identity and keeps the Blob container private', async () => {
    process.env.AZURE_STORAGE_ACCOUNT_URL = 'https://storage.example';
    const saved = await new UploadsService().save(file);
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith('https://storage.example', expect.anything(), expect.objectContaining({ retryOptions: expect.anything() }));
    expect(mockGetContainer).toHaveBeenCalledWith('keepit-uploads');
    expect(mockCreate).toHaveBeenCalledWith();
    expect(mockUpload).toHaveBeenCalledWith(image, expect.objectContaining({
      blobHTTPHeaders: expect.objectContaining({ blobContentType: 'image/png' }),
    }));
    expect(saved.url).toMatch(/^\/uploads\/.+\.png$/);
  });

  it('can reuse an existing storage connection configuration', async () => {
    process.env.AZURE_TABLES_CONNECTION_STRING = 'test-connection';
    await new UploadsService().save(file);
    expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith('test-connection', expect.anything());
  });

  it('does not silently put production uploads on ephemeral disk', async () => {
    process.env.NODE_ENV = 'production';
    await expect(new UploadsService().save(file)).rejects.toThrow('파일 저장소가 설정되지 않았습니다.');
  });

  it('downloads only the requested range from Blob storage', async () => {
    process.env.AZURE_STORAGE_ACCOUNT_URL = 'https://storage.example';
    const media = await new UploadsService().open('11111111-1111-1111-1111-111111111111.png');
    expect(media.size).toBe(100);
    await media.stream(10, 20);
    expect(mockDownload).toHaveBeenCalledWith(10, 11);
  });

  it('preserves local uploads across service restarts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'keepit-media-restart-'));
    process.env.UPLOADS_DIR = directory;
    try {
      const saved = await new UploadsService().save(file);
      const reopened = await new UploadsService().open(saved.url.split('/').pop()!);
      const chunks: Buffer[] = [];
      for await (const chunk of await reopened.stream(0, reopened.size - 1)) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks)).toEqual(image);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});