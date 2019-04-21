import {
  Directory,
  PropertySignatureStructure,
  SourceFile,
  WriterFunction,
  WriterFunctions,
} from "ts-morph"

import {
  ODataEntity,
  ODataEnumMember,
  ODataProperty,
  ODataSchema,
} from "./metadata/types"

const navigationPropertiesConstant = "Constant.navigationProperties"

function getType(property: ODataProperty): string | WriterFunction {
  const type = property.isCollection ? `${property.type}[]` : property.type
  return property.isNullable ? WriterFunctions.unionType(type, "null") : type
}

function getProperty(property: ODataProperty): PropertySignatureStructure {
  return {
    name: property.name,
    type: getType(property),
  }
}

function addEntitiesToSchemaFile(
  schemaFile: SourceFile,
  entities: ODataEntity[],
): void {
  for (const entity of entities) {
    const propertiesInterface = schemaFile.addInterface({
      name: entity.name,
      properties: entity.properties.map(getProperty),
      isExported: true,
    })

    if (entity.navigationProperties.length) {
      propertiesInterface.addProperty({
        name: `[${navigationPropertiesConstant}]`,
        type: WriterFunctions.objectType({
          properties: entity.navigationProperties.map(getProperty),
        }),
      })
    }
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
  let exportDeclaration =
    indexFile.getExportDeclaration(d => !d.hasModuleSpecifier()) ||
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
    directory.getSourceFile("index.ts") ||
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
    directory.getDirectory(firstSegment) ||
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
  return WriterFunctions.unionType(
    firstMemberNameType,
    secondMemberNameType,
    ...remainingMemberNameTypes,
  )
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
      properties: schema.entityContainer.entitySets.map<
        PropertySignatureStructure
      >(entitySet => ({
        name: entitySet.name,
        type: `${entitySet.type}[]`,
      })),
      isExported: true,
    })
  }

  for (const enumType of schema.enumTypes) {
    schemaFile.addTypeAlias({
      name: enumType.name,
      type: getEnumMembersType(enumType.members),
      isExported: true,
    })
  }

  addEntitiesToSchemaFile(schemaFile, [
    ...schema.complexTypes,
    ...schema.entityTypes,
  ])

  return schemaFile.fixMissingImports().organizeImports()
}
