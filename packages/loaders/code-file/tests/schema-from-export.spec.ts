import { CodeFileLoader } from '../src';
import * as fs from 'fs';
import * as path from 'path';

describe('Schema From Export', () => {
  const loader = new CodeFileLoader();

  it('should load the schema correctly from module.exports', async () => {
    const result = await loader.load('./tests/test-files/loaders/module-exports.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema (with extend) correctly from module.exports', async () => {
    const result = await loader.load('./tests/test-files/loaders/with-extend.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema correctly from variable export', async () => {
    const result = await loader.load('./tests/test-files/loaders/schema-export.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema correctly from default export', async () => {
    const result = await loader.load('./tests/test-files/loaders/default-export.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema correctly from promise export', async () => {
    const result = await loader.load('./tests/test-files/loaders/promise-export.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });
});

describe('Schema From Export (sync)', () => {
  const loader = new CodeFileLoader();

  it('should load the schema correctly from module.exports', () => {
    const result = loader.loadSync('./tests/test-files/loaders/module-exports.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema (with extend) correctly from module.exports', () => {
    const result = loader.loadSync('./tests/test-files/loaders/with-extend.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema correctly from variable export', () => {
    const result = loader.loadSync('./tests/test-files/loaders/schema-export.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema correctly from default export', () => {
    const result = loader.loadSync('./tests/test-files/loaders/default-export.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });

  it('should load the schema correctly from promise export', () => {
    const result = loader.loadSync('./tests/test-files/loaders/promise-export.js', {
      fs,
      path,
    });
    expect(result).toBeDefined();
  });
});
