import {
  ODataBoundFunction,
  ODataEntity,
  ODataEntityContainer,
  ODataEntitySet,
  ODataEnum,
  ODataEnumMember,
  ODataFunction,
  ODataMetadata,
  ODataParameter,
  ODataProperty,
  ODataSchema,
  ODataUnboundFunction,
} from "./types"
import {
  XmlODataComplexType,
  XmlODataEntityContainer,
  XmlODataEntitySet,
  XmlODataEntityType,
  XmlODataEnumMember,
  XmlODataEnumType,
  XmlODataFunction,
  XmlODataMetadata,
  XmlODataNavigationProperty,
  XmlODataParameter,
  XmlODataProperty,
  XmlODataReturnType,
  XmlODataSchema,
} from "./xml-types"

function getBaseAttributes(
  value:
    | XmlODataProperty
    | XmlODataNavigationProperty
    | XmlODataParameter
    | XmlODataReturnType,
): {
  type: string
  isCollection: boolean
  isNullable: boolean
} {
  return {
    type: value.$.Type.name,
    isCollection: value.$.Type.isCollection,
    isNullable: value.$.Nullable ?? true,
  }
}

function getProperty(
  property: XmlODataProperty | XmlODataNavigationProperty,
): ODataProperty {
  return {
    ...getBaseAttributes(property),
    name: property.$.Name,
  }
}

function getEntity(
  entity: XmlODataEntityType | XmlODataComplexType,
): ODataEntity {
  return {
    name: entity.$.Name,
    properties: entity.Property?.map(getProperty) ?? [],
    navigationProperties: entity.NavigationProperty?.map(getProperty) ?? [],
  }
}

function getEnumMember(
  member: XmlODataEnumMember,
  index: number,
): ODataEnumMember {
  return {
    name: member.$.Name,
    value: member.$.Value ?? index,
  }
}

function getEnum(enumType: XmlODataEnumType): ODataEnum {
  return {
    name: enumType.$.Name,
    members: enumType.Member?.map(getEnumMember) ?? [],
  }
}

function getParameter(parameter: XmlODataParameter): ODataParameter {
  return {
    ...getBaseAttributes(parameter),
    name: parameter.$.Name,
  }
}

function getFunction(functionType: XmlODataFunction): ODataFunction {
  const returnType = functionType.ReturnType[0]
  const base = {
    name: functionType.$.Name,
    parameters: functionType.Parameter?.map(getParameter) ?? [],
    returnType: getBaseAttributes(returnType),
  }

  if (functionType.$.IsBound) {
    if (!functionType.Parameter) {
      // This should never happen since the codec checks for this.
      // Unfortunately, discriminated unions don't work from in nested objects.
      throw new Error("Bound function missing binding parameter.")
    }

    const bound: ODataBoundFunction = {
      ...base,
      boundType: getBaseAttributes(functionType.Parameter[0]),
    }
    return bound
  } else {
    const unbound: ODataUnboundFunction = base
    return unbound
  }
}

function getEntitySet(set: XmlODataEntitySet): ODataEntitySet {
  return {
    name: set.$.Name,
    type: set.$.EntityType,
  }
}

function getEntityContainer(
  container: XmlODataEntityContainer,
): ODataEntityContainer {
  return {
    name: container.$.Name,
    entitySets: container.EntitySet?.map(getEntitySet) ?? [],
  }
}

function getSchema(schema: XmlODataSchema): ODataSchema {
  return {
    namespace: schema.$.Namespace,
    entityTypes: schema.EntityType?.map(getEntity) ?? [],
    complexTypes: schema.ComplexType?.map(getEntity) ?? [],
    enumTypes: schema.EnumType?.map(getEnum) ?? [],
    functions: schema.Function?.map(getFunction) ?? [],
    entityContainer: schema.EntityContainer
      ? getEntityContainer(schema.EntityContainer[0])
      : null,
  }
}

export function transformMetadata(metadata: XmlODataMetadata): ODataMetadata {
  return {
    schemas: metadata["edmx:Edmx"]["edmx:DataServices"][0].Schema.map(
      getSchema,
    ),
  }
}
