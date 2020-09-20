import {
  ODataAction,
  ODataActionImport,
  ODataBoundAction,
  ODataBoundFunction,
  ODataEntity,
  ODataEntityContainer,
  ODataEntitySet,
  ODataEnum,
  ODataEnumMember,
  ODataFunction,
  ODataFunctionImport,
  ODataMetadata,
  ODataParameter,
  ODataProperty,
  ODataSchema,
  ODataUnboundAction,
  ODataUnboundFunction,
} from "./types"
import {
  XmlODataAction,
  XmlODataActionImport,
  XmlODataComplexType,
  XmlODataEntityContainer,
  XmlODataEntitySet,
  XmlODataEntityType,
  XmlODataEnumMember,
  XmlODataEnumType,
  XmlODataFunction,
  XmlODataFunctionImport,
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

function getAction(action: XmlODataAction): ODataAction {
  const returnType = action.ReturnType?.[0]
  const base = {
    name: action.$.Name,
    parameters: action.Parameter?.map(getParameter) ?? [],
    returnType: returnType ? getBaseAttributes(returnType) : null,
  }

  if (action.$.IsBound) {
    if (!action.Parameter) {
      // This should never happen since the codec checks for this.
      // Unfortunately, discriminated unions don't work from in nested objects.
      throw new Error("Bound action missing binding parameter.")
    }

    const [boundType, ...parameters] = base.parameters
    const bound: ODataBoundAction = { ...base, boundType, parameters }
    return bound
  } else {
    const unbound: ODataUnboundAction = base
    return unbound
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

    const [boundType, ...parameters] = base.parameters
    const bound: ODataBoundFunction = { ...base, boundType, parameters }
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

function getActionImport(value: XmlODataActionImport): ODataActionImport {
  return {
    name: value.$.Name,
    actionName: value.$.Action,
  }
}

function getFunctionImport(value: XmlODataFunctionImport): ODataFunctionImport {
  return {
    name: value.$.Name,
    functionName: value.$.Function,
  }
}

function getEntityContainer(
  container: XmlODataEntityContainer,
): ODataEntityContainer {
  return {
    name: container.$.Name,
    entitySets: container.EntitySet?.map(getEntitySet) ?? [],
    actionImports: container.ActionImport?.map(getActionImport) ?? [],
    functionImports: container.FunctionImport?.map(getFunctionImport) ?? [],
  }
}

function getSchema(schema: XmlODataSchema): ODataSchema {
  return {
    namespace: schema.$.Namespace,
    entityTypes: schema.EntityType?.map(getEntity) ?? [],
    complexTypes: schema.ComplexType?.map(getEntity) ?? [],
    enumTypes: schema.EnumType?.map(getEnum) ?? [],
    actions: schema.Action?.map(getAction) ?? [],
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
