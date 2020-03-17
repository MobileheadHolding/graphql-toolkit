import { isSchema } from 'graphql';
import { loadSchema, loadSchemaSync } from '@graphql-toolkit/core';
import { CodeFileLoader } from '@graphql-toolkit/code-file-loader';
import { runTests } from '@testing-utils';

describe('Schema From Export', () => {
  runTests({
    async: loadSchema,
    sync: loadSchemaSync
  })((load, mode) => {
    test('should load the schema correctly from module.exports', async () => {
      const result = await load('./tests/loaders/schema/test-files/loaders/module-exports.js', {
        loaders: [new CodeFileLoader()]
      });
      expect(isSchema(result)).toBeTruthy();
    });
  
    test('should load the schema (with extend) correctly from module.exports', async () => {
      const result = await load('./tests/loaders/schema/test-files/schema-dir/with-extend.js', {
        loaders: [new CodeFileLoader()]
      });
      expect(isSchema(result)).toBeTruthy();
      expect(result.getQueryType().getFields()['hello']).toBeDefined();
    });
  
    test('should load the schema correctly from variable export', async () => {
      const result = await load('./tests/loaders/schema/test-files/loaders/schema-export.js', {
        loaders: [new CodeFileLoader()]
      });
      expect(isSchema(result)).toBeTruthy();
    });
  
    test('should load the schema correctly from default export', async () => {
      const result = await load('./tests/loaders/schema/test-files/loaders/default-export.js', {
        loaders: [new CodeFileLoader()]
      });
      expect(isSchema(result)).toBeTruthy();
    });
  
    if (mode === 'async') {
      test('should load the schema correctly from promise export', async () => {
        const result = await load('./tests/loaders/schema/test-files/loaders/promise-export.js', {
          loaders: [new CodeFileLoader()]
        });
        expect(isSchema(result)).toBeTruthy();
      });
    
      test('should load the schema correctly from promise export', async () => {
        const result = await load('./tests/loaders/schema/test-files/loaders/promise-export.js', {
          loaders: [new CodeFileLoader()]
        });
        expect(isSchema(result)).toBeTruthy();
      });
    }
  
    test.only('should work with extensions (without schema definition)', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/extensions/export-schema.js';
      const schema = await load(schemaPath, {
        loaders: [new CodeFileLoader()]
      });
      const queryFields = Object.keys(schema.getQueryType().getFields());
  
      expect(queryFields).toContain('foo');
      expect(queryFields).toContain('bar');
    });
  
    test.only('should work with extensions (with schema definition)', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/extensions/export-schema-with-def.js';
      const schema = await load(schemaPath, {
        loaders: [new CodeFileLoader()]
      });
      const queryFields = Object.keys(schema.getQueryType().getFields());
  
      expect(queryFields).toContain('foo');
      expect(queryFields).toContain('bar');
    });
  })
});
