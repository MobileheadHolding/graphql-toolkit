import { DefinitionNode, parse, ObjectTypeDefinitionNode, DocumentNode, Kind } from 'graphql';
import { groupBy, keyBy, isEqual, uniqBy, flatten } from 'lodash';
import { loadSingleFile, LoadTypedefsOptions } from '../load-typedefs';

import { completeDefinitionPool } from './definition';
import { Source, compareNodes } from '@graphql-toolkit/common';

/**
 * Describes the information from a single import line
 *
 */
export interface RawModule {
  imports: string[];
  from: string;
}

const rootFields = ['Query', 'Mutation', 'Subscription'];

const gqlExt = /\.g(raph)?ql(s)?$/;
function isGraphQLFile(f: string) {
  return gqlExt.test(f);
}

const IMPORT_FROM_REGEX = /^import\s+(\*|(.*))\s+from\s+('|")(.*)('|");?$/;
const IMPORT_DEFAULT_REGEX = /^import\s+('|")(.*)('|");?$/;

/**
 * Parse a single import line and extract imported types and schema filename
 *
 * @param importLine Import line
 * @returns Processed import line
 */
export function parseImportLine(importLine: string): RawModule {
  if (IMPORT_FROM_REGEX.test(importLine)) {
    // Apply regex to import line
    const matches = importLine.match(IMPORT_FROM_REGEX);

    if (matches?.length === 6 && matches[4]) {
      // Extract matches into named variables
      const [, wildcard, importsString, , from] = matches;

      // Extract imported types
      const imports = wildcard === '*' ? ['*'] : importsString.split(',').map(d => d.trim());

      // Return information about the import line
      return { imports, from };
    }
  } else if (IMPORT_DEFAULT_REGEX.test(importLine)) {
    const [, , from] = importLine.match(IMPORT_DEFAULT_REGEX);

    return { imports: ['*'], from };
  }
  throw new Error(`
    Import statement is not valid: ${importLine}
    If you want to have comments starting with '# import', please use ''' instead!
    You can only have 'import' statements in the following pattern;
    # import [Type].[Field] from [File]
  `);
}

/**
 * Parse a schema and analyze all import lines
 *
 * @param sdl Schema to parse
 * @returns Array with collection of imports per import line (file)
 */
export function parseSDL(sdl: string): RawModule[] {
  return sdl
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('# import ') || l.startsWith('#import '))
    .map(l => l.replace('#', '').trim())
    .map(parseImportLine);
}

/**
 * Main entry point. Recursively process all import statement in a schema
 *
 * @param filePath File path to the initial schema file
 * @returns Single bundled schema with all imported types
 */
export async function processImportSyntax(documentSource: Source, options: LoadTypedefsOptions, allDefinitions: DefinitionNode[][]): Promise<DefinitionNode[]> {
  const typeDefinitions: DefinitionNode[][] = [];

  // Recursively process the imports, starting by importing all types from the initial schema
  await collectDefinitions(['*'], documentSource, options, typeDefinitions, allDefinitions);

  // Post processing of the final schema (missing types, unused types, etc.)
  // Query, Mutation and Subscription should be merged
  // And should always be in the first set, to make sure they
  // are not filtered out.
  const firstTypes = flatten(typeDefinitions);
  const secondFirstTypes = typeDefinitions[0];
  const otherFirstTypes = flatten(typeDefinitions.slice(1));

  const firstSet = firstTypes.concat(secondFirstTypes, otherFirstTypes);
  const processedTypeNames: string[] = [];
  const mergedFirstTypes = [];
  for (const type of firstSet) {
    if ('name' in type) {
      if (!processedTypeNames.includes(type.name.value)) {
        processedTypeNames.push(type.name.value);
        mergedFirstTypes.push(type);
      } else {
        const existingType = mergedFirstTypes.find(t => t.name.value === type.name.value);

        if ('fields' in existingType) {
          (existingType as any).fields = uniqBy((existingType.fields as any).concat((type as ObjectTypeDefinitionNode).fields), 'name.value');
          if (options.sort) {
            (existingType as any).fields = (existingType.fields as any).sort(compareNodes);
          }
        }
      }
    }
  }

  return completeDefinitionPool(flatten(allDefinitions), firstSet, flatten(typeDefinitions));
}

/**
 * Parses a schema into a graphql DocumentNode.
 * If the schema is empty a DocumentNode with empty definitions will be created.
 *
 * @param sdl Schema to parse
 * @returns A graphql DocumentNode with definitions of the parsed sdl.
 */
export function getDocumentFromSDL(sdl: string): DocumentNode {
  if (isEmptySDL(sdl)) {
    return {
      kind: Kind.DOCUMENT,
      definitions: [],
    };
  } else {
    return parse(sdl, { noLocation: true });
  }
}

/**
 * Check if a schema contains any type definitions at all.
 *
 * @param sdl Schema to parse
 * @returns True if SDL only contains comments and/or whitespaces
 */
export function isEmptySDL(sdl: string): boolean {
  return (
    sdl
      .split('\n')
      .map(l => l.trim())
      .filter(l => !(l.length === 0 || l.startsWith('#'))).length === 0
  );
}

/**
 * Resolve the path of an import.
 * First it will try to find a file relative from the file the import is in, if that fails it will try to resolve it as a module so imports from packages work correctly.
 *
 * @param filePath Path the import was made from
 * @param importFrom Path given for the import
 * @returns Full resolved path to a file
 */
export async function resolveModuleFilePath(filePath: string, importFrom: string, options: LoadTypedefsOptions): Promise<string> {
  const { fs, path } = options;

  if (fs && path) {
    const fullPath = path.resolve(options.cwd, filePath);
    const dirName = path.dirname(fullPath);
    if (isGraphQLFile(fullPath) && isGraphQLFile(importFrom)) {
      try {
        return await new Promise((resolve, reject) => fs.realpath(path.join(dirName, importFrom), (err, data) => (err ? reject(err) : resolve(data))));
      } catch (e) {
        if (e.code === 'ENOENT') {
          const resolveFrom = await import('resolve-from').then(m => m.default);
          return resolveFrom(dirName, importFrom);
        }
      }
    }
  }

  return importFrom;
}

/**
 * Recursively process all schema files. Keeps track of both the filtered
 * type definitions, and all type definitions, because they might be needed
 * in post-processing (to add missing types)
 *
 * @param imports Types specified in the import statement
 * @param sdl Current schema
 * @param filePath File location for current schema
 * @param Tracking of processed schemas (for circular dependencies)
 * @param Tracking of imported type definitions per schema
 * @param Tracking of all type definitions per schema
 * @returns Both the collection of all type definitions, and the collection of imported type definitions
 */
export async function collectDefinitions(imports: string[], { location, document, rawSDL }: Source, options: LoadTypedefsOptions, typeDefinitions: DefinitionNode[][], allDefinitions: DefinitionNode[][]): Promise<void> {
  // Add all definitions to running total
  allDefinitions.push(document.definitions as DefinitionNode[]);

  // Filter TypeDefinitionNodes by type and defined imports
  const currentTypeDefinitions = filterImportedDefinitions(imports, document.definitions as DefinitionNode[], allDefinitions, options.sort);

  // Add typedefinitions to running total
  typeDefinitions.push(currentTypeDefinitions);

  // Read imports from current file
  const rawModules = parseSDL(rawSDL);

  // Process each file (recursively)
  await Promise.all(
    rawModules.map(async m => {
      // If it was not yet processed (in case of circular dependencies)
      const moduleFilePath = await resolveModuleFilePath(location, m.from, options);

      const processedFile = options.processedFiles.get(moduleFilePath);
      if (!processedFile || !processedFile.find(rModule => isEqual(rModule, m))) {
        // Mark this specific import line as processed for this file (for cicular dependency cases)
        options.processedFiles.set(moduleFilePath, processedFile ? processedFile.concat(m) : [m]);
        const result = await loadSingleFile(moduleFilePath, options);
        await collectDefinitions(m.imports, result, options, typeDefinitions, allDefinitions);
      }
    })
  );
}

/**
 * Filter the types loaded from a schema, first by relevant types,
 * then by the types specified in the import statement.
 *
 * @param imports Types specified in the import statement
 * @param typeDefinitions All definitions from a schema
 * @returns Filtered collection of type definitions
 */
function filterImportedDefinitions(imports: string[], typeDefinitions: DefinitionNode[], allDefinitions: DefinitionNode[][], sort: boolean): DefinitionNode[] {
  // This should do something smart with fields

  const filteredDefinitions = typeDefinitions;

  if (imports.includes('*')) {
    if (imports.length === 1 && imports[0] === '*' && allDefinitions.length > 1) {
      const previousTypeDefinitions: { [key: string]: DefinitionNode } = keyBy(
        flatten(allDefinitions.slice(0, allDefinitions.length - 1)).filter(def => 'name' in def && !rootFields.includes(def.name.value)),
        def => 'name' in def && def.name.value
      );
      return typeDefinitions.filter(typeDef => typeDef.kind === 'ObjectTypeDefinition' && previousTypeDefinitions[typeDef.name.value]) as ObjectTypeDefinitionNode[];
    }
    return filteredDefinitions;
  } else {
    const importedTypes = imports.map(i => i.split('.')[0]);
    const result = filteredDefinitions.filter(d => 'name' in d && importedTypes.includes(d.name.value));
    const fieldImports = imports.filter(i => i.split('.').length > 1);
    const groupedFieldImports = groupBy(fieldImports, x => x.split('.')[0]);

    for (const rootType in groupedFieldImports) {
      const fields = groupedFieldImports[rootType].map(x => x.split('.')[1]);
      const objectTypeDefinition: any = filteredDefinitions.find(def => 'name' in def && def.name.value === rootType);

      if (objectTypeDefinition && 'fields' in objectTypeDefinition && !fields.includes('*')) {
        objectTypeDefinition.fields = objectTypeDefinition.fields.filter((f: any) => fields.includes(f.name.value) || fields.includes('*'));
        if (sort) {
          objectTypeDefinition.fields.sort(compareNodes);
        }
      }
    }

    return result;
  }
}
