import { getDirectiveValues, GraphQLDirective, GraphQLSchema } from 'graphql';

export type DirectiveUseMap = { [key: string]: any };

export function getDirectives(schema: GraphQLSchema, node: any): DirectiveUseMap {
  const schemaDirectives: ReadonlyArray<GraphQLDirective> = schema?.getDirectives ? schema.getDirectives() : [];
  const astNode = node?.astNode;
  let result: DirectiveUseMap = {};

  if (astNode) {
    schemaDirectives.forEach((directive: GraphQLDirective) => {
      const directiveValue = getDirectiveValues(directive, astNode);

      if (directiveValue !== undefined) {
        result[directive.name] = directiveValue || {};
      }
    });
  }

  return result;
}
