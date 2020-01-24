import {
  Directory,
  InterfaceDeclarationStructure,
  OptionalKind,
  PropertySignatureStructure,
  SourceFile,
  TypeAliasDeclarationStructure,
  WriterFunction,
  Writers,
} from "ts-morph"

import {
  ODataEntity,
  ODataEntitySet,
  ODataEnum,
  ODataEnumMember,
  ODataParameter,
  ODataProperty,
  ODataSchema,
} from "./metadata/types"

const navigationPropertiesConstant = "[Constant.navigationProperties]"

function getType(property: ODataProperty): string | WriterFunction {
  const type = property.isCollection ? `${property.type}[]` : property.type
  return property.isNullable ? Writers.unionType(type, "null") : type
}

function getProperty(
  property: ODataProperty | ODataParameter,
): OptionalKind<PropertySignatureStructure> {
  return {
    name: property.name,
    type: getType(property),
  }
}

function getEntityProperties(
  entity: ODataEntity,
): OptionalKind<PropertySignatureStructure>[] {
  const properties = entity.properties.map(getProperty)
  if (entity.navigationProperties.length) {
    properties.push({
      name: navigationPropertiesConstant,
      type: Writers.objectType({
        properties: entity.navigationProperties.map(getProperty),
      }),
    })
  }
  return properties
}

function getEntityInterface(
  entity: ODataEntity,
): OptionalKind<InterfaceDeclarationStructure> {
  return {
    name: entity.name,
    properties: getEntityProperties(entity),
    isExported: true,
  }
}

function getEntitySetProperty(
  entitySet: ODataEntitySet,
): OptionalKind<PropertySignatureStructure> {
  return {
    name: entitySet.name,
    type: `${entitySet.type}[]`,
  }
}

function addNamespaceImport(
  indexFile: SourceFile,
  namespaceSegment: string,
): void {
  const moduleSpecifier = `./${namespaceSegment}`
  if (!indexFile.getImportDeclaration(moduleSpecifier)) {
    indexFile.addImportDeclaration({
      moduleSpecifier,
      namespaceImport: namespaceSegment,
    })
  }
}

function addNamespaceExport(
  indexFile: SourceFile,
  namespaceSegment: string,
): void {
  const exportDeclaration =
    indexFile.getExportDeclaration(d => !d.hasModuleSpecifier()) ??
    indexFile.addExportDeclaration({})

  const namedExportExists = exportDeclaration
    .getNamedExports()
    .some(specifier => specifier.getName() === namespaceSegment)

  if (!namedExportExists) {
    exportDeclaration.addNamedExport({ name: namespaceSegment })
  }
}

function getIndexFile(directory: Directory): SourceFile {
  return (
    directory.getSourceFile("index.ts") ??
    directory.createSourceFile("index.ts")
  )
}

function getNamespacedSchemaFile(
  directory: Directory,
  namespace: string[],
): SourceFile {
  const [firstSegment, ...remainingSegments] = namespace

  const indexFile = getIndexFile(directory)
  addNamespaceImport(indexFile, firstSegment)
  addNamespaceExport(indexFile, firstSegment)
  indexFile.organizeImports()

  const namespaceDirectory =
    directory.getDirectory(firstSegment) ??
    directory.createDirectory(firstSegment)

  if (!remainingSegments.length) {
    const schemaFileName = `${firstSegment}-schema`

    getIndexFile(namespaceDirectory).addExportDeclaration({
      moduleSpecifier: `./${schemaFileName}`,
    })

    return namespaceDirectory.createSourceFile(`${schemaFileName}.ts`)
  }

  return getNamespacedSchemaFile(namespaceDirectory, remainingSegments)
}

function getEnumMembersType(
  members: ODataEnumMember[],
): string | WriterFunction {
  const [
    firstMemberNameType,
    secondMemberNameType,
    ...remainingMemberNameTypes
  ] = members.map(member => `"${member.name}"`)

  if (!firstMemberNameType) {
    return "string"
  }
  if (!secondMemberNameType) {
    return firstMemberNameType
  }
  return Writers.unionType(
    firstMemberNameType,
    secondMemberNameType,
    ...remainingMemberNameTypes,
  )
}

function getEnumInterface(
  enumType: ODataEnum,
): OptionalKind<TypeAliasDeclarationStructure> {
  return {
    name: enumType.name,
    type: getEnumMembersType(enumType.members),
    isExported: true,
  }
}

export function createSchemaFile(
  schema: ODataSchema,
  directory: Directory,
): SourceFile {
  const schemaFile = getNamespacedSchemaFile(
    directory,
    schema.namespace.split("."),
  )

  if (schema.entityContainer) {
    schemaFile.addInterface({
      name: schema.entityContainer.name,
      properties: schema.entityContainer.entitySets.map(getEntitySetProperty),
      isExported: true,
    })
  }

  schemaFile.addTypeAliases(schema.enumTypes.map(getEnumInterface))

  schemaFile.addInterfaces([
    ...schema.complexTypes.map(getEntityInterface),
    ...schema.entityTypes.map(getEntityInterface),
  ])

  return schemaFile.fixMissingImports().organizeImports()
}
