import { debugLog } from '@graphql-toolkit/common';
import { DocumentNode, DefinitionNode, Kind } from 'graphql';

export const filterKind = (content: DocumentNode, filterKinds: null | string[]) => {
  if (content?.definitions?.length && filterKinds?.length > 0) {
    const invalidDefinitions: DefinitionNode[] = [];
    const validDefinitions: DefinitionNode[] = [];
    for (const definitionNode of content.definitions) {
      if (filterKinds.includes(definitionNode.kind)) {
        invalidDefinitions.push(definitionNode);
      } else {
        validDefinitions.push(definitionNode);
      }
    }

    if (invalidDefinitions.length > 0) {
      invalidDefinitions.forEach(d => {
        debugLog(`Filtered document of kind ${d.kind} due to filter policy (${filterKinds.join(', ')})`);
      });
    }

    return {
      kind: Kind.DOCUMENT,
      definitions: validDefinitions,
    };
  }
  return content;
};
