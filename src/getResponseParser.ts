import { TypeKind, IntrospectionObjectType } from 'graphql';
import { GET_LIST, GET_MANY, GET_MANY_REFERENCE } from 'react-admin';
import getFinalType from './utils/getFinalType';
import { IntrospectionResult, Resource } from './constants/interfaces';

const sanitizeResource = (
  introspectionResults: IntrospectionResult,
  resource: Resource
) => (data: { [key: string]: any }): any => {

  return Object.keys(data).reduce((acc, key) => {
    if (key.startsWith('_')) {
      return acc;
    }

    const field = (resource.type as IntrospectionObjectType).fields.find(
      f => f.name === key
    )!;
    console.log('field', field)

    const type = getFinalType(field.type);
    console.log('type', type)
    if (type.kind !== TypeKind.OBJECT) {
      return { ...acc, [field.name]: data[field.name] };
    }

    // FIXME: We might have to handle linked types which are not resources but will have to be careful about endless circular dependencies
    const linkedResource = introspectionResults.resources.find(
      r => r.type.name === type.name
    );
    console.log('linkedResource', linkedResource)
    if (linkedResource) {
      const linkedResourceData = data[field.name];
      console.log('linkedResourceData', linkedResourceData)

      if (Array.isArray(linkedResourceData)) {
        return {
          ...acc,
          [field.name]: data[field.name].map(
            sanitizeResource(introspectionResults, linkedResource)
          ),
          [`${field.name}Ids`]: data[field.name].map(
            (d: { id: string }) => d.id
          )
        };
      }

      return {
        ...acc,
        [`${field.name}.id`]: linkedResourceData
          ? data[field.name].id
          : undefined,
        [field.name]: linkedResourceData
          ? sanitizeResource(introspectionResults, linkedResource)(
            data[field.name]
          )
          : undefined
      };
    }
    return { ...acc, [field.name]: data[field.name] };
  }, {});
};

export default (introspectionResults: IntrospectionResult) => (
  aorFetchType: string,
  resource: Resource
) => (response: { [key: string]: any }) => {
  const sanitize = sanitizeResource(introspectionResults, resource);
  const data = response.data;
  console.log('sanitizeResource sanitize', sanitize)
  if (
    aorFetchType === GET_LIST ||
    aorFetchType === GET_MANY ||
    aorFetchType === GET_MANY_REFERENCE
  ) {
    console.log('response', response)
    console.log('datasan', response.data.clients.map(sanitize))
    return {
      data: response.data.clients.map(sanitize),
      total: response.data.clients.length
    };
  }
  console.log('data.data', data.data)
  return { data: sanitize(data) };
};
