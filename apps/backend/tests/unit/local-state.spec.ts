import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attachLocalState } from '../../src/db/local-state';

describe('Local state persistence', () => {
  let directory: string;
  const previous = process.env.LOCAL_STATE_DIR;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'keepit-state-'));
    process.env.LOCAL_STATE_DIR = directory;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.LOCAL_STATE_DIR;
    else process.env.LOCAL_STATE_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  });

  class RecordEntity {
    constructor(readonly createdAt = new Date()) {}
    label() { return 'restored'; }
  }
  class Store {
    records = new Map<string, RecordEntity>();
    likes = new Set<string>();
    constructor() {
      attachLocalState(this, 'test', ['records', 'likes'], ['save'], { records: RecordEntity.prototype });
    }
    async save() { this.records.set('record', new RecordEntity()); this.likes.add('user'); }
  }

  it('restores maps, sets, dates and entity behavior after reopening', async () => {
    await new Store().save();
    const restored = new Store();
    expect(Number.isFinite(restored.records.get('record')?.createdAt.getTime())).toBe(true);
    expect(restored.records.get('record')?.label()).toBe('restored');
    expect(restored.likes.has('user')).toBe(true);
    expect(statSync(join(directory, 'test.bin')).mode & 0o777).toBe(0o600);
  });

  it('fails closed on corrupted state instead of silently resetting data', async () => {
    await new Store().save();
    writeFileSync(join(directory, 'test.bin'), 'corrupted');
    expect(() => new Store()).toThrow();
    expect(readFileSync(join(directory, 'test.bin'), 'utf8')).toBe('corrupted');
  });
});