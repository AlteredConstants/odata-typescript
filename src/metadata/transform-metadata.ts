import {
  ODataEntity,
  ODataEntityContainer,
  ODataEntitySet,
  ODataEnum,
  ODataEnumMember,
  ODataMetadata,
  ODataProperty,
  ODataSchema,
} from "./types"
import {
  XmlODataComplexType,
  XmlODataEntityContainer,
  XmlODataEntitySet,
  XmlODataEntityType,
  XmlODataEnumMember,
  XmlODataEnumType,
  XmlODataMetadata,
  XmlODataNavigationProperty,
  XmlODataProperty,
  XmlODataSchema,
  collectionTypeQualifiedNameRegExp,
} from "./xml-types"

function getProperty(
  property: XmlODataProperty | XmlODataNavigationProperty,
): ODataProperty {
  const type = property.$.Type
  const typeMatch = collectionTypeQualifiedNameRegExp.exec(type)
  return {
    name: property.$.Name,
    type: typeMatch ? typeMatch[1] : type,
    isCollection: !!typeMatch,
    isNullable: property.$.Nullable === undefined ? true : property.$.Nullable,
  }
}

function getEntity(
  entity: XmlODataEntityType | XmlODataComplexType,
): ODataEntity {
  return {
    name: entity.$.Name,
    properties: entity.Property ? entity.Property.map(getProperty) : [],
    navigationProperties: entity.NavigationProperty
      ? entity.NavigationProperty.map(getProperty)
      : [],
  }
}

function getEnumMember(
  member: XmlODataEnumMember,
  index: number,
): ODataEnumMember {
  return {
    name: member.$.Name,
    value: member.$.Value === undefined ? index : member.$.Value,
  }
}

function getEnum(enumType: XmlODataEnumType): ODataEnum {
  return {
    name: enumType.$.Name,
    members: enumType.Member ? enumType.Member.map(getEnumMember) : [],
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
    entitySets: container.EntitySet
      ? container.EntitySet.map(getEntitySet)
      : [],
  }
}

function getSchema(schema: XmlODataSchema): ODataSchema {
  return {
    namespace: schema.$.Namespace,
    entityTypes: schema.EntityType ? schema.EntityType.map(getEntity) : [],
    complexTypes: schema.ComplexType ? schema.ComplexType.map(getEntity) : [],
    enumTypes: schema.EnumType ? schema.EnumType.map(getEnum) : [],
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
