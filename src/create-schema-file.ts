import {
  Directory,
  InterfaceDeclarationStructure,
  OptionalKind,
  ParameterDeclarationStructure,
  PropertySignatureStructure,
  SourceFile,
  TypeAliasDeclarationStructure,
  WriterFunction,
  Writers,
} from "ts-morph"

import {
  ODataEntity,
  ODataEntityContainer,
  ODataEntitySet,
  ODataEnum,
  ODataEnumMember,
  ODataFunction,
  ODataFunctionImport,
  ODataParameter,
  ODataProperty,
  ODataReturnType,
  ODataSchema,
} from "./metadata/types"

const navigationPropertiesConstant = "[Constant.navigationProperties]"
const functionsConstant = "[Constant.functions]"

function getType(
  property: ODataProperty | ODataReturnType,
): string | WriterFunction {
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

function getFunctionImportProperty(
  functionImport: ODataFunctionImport,
): OptionalKind<PropertySignatureStructure> {
  return {
    name: functionImport.name,
    type: functionImport.functionName,
  }
}

function getFunctionParameter(
  parameter: ODataParameter,
): OptionalKind<ParameterDeclarationStructure> {
  return {
    name: parameter.name,
    type: getType(parameter),
  }
}

function getFunctionInterface(
  func: ODataFunction,
): OptionalKind<InterfaceDeclarationStructure> {
  return {
    name: func.name,
    callSignatures: [
      {
        parameters: func.parameters.map(getFunctionParameter),
        returnType: getType(func.returnType),
      },
    ],
    isExported: true,
  }
}

function bindFunctions(
  schemaFile: SourceFile,
  functions: ODataFunction[],
): void {
  const boundFunctions = new Map<
    string,
    OptionalKind<PropertySignatureStructure>[]
  >()

  for (const func of functions) {
    if (!("boundType" in func)) {
      continue
    }
    const properties = boundFunctions.get(func.boundType.type) ?? []
    boundFunctions.set(func.boundType.type, [
      ...properties,
      { name: func.name, type: func.name },
    ])
  }

  for (const [namespacedType, properties] of boundFunctions.entries()) {
    const [type] = namespacedType.split(".").reverse()
    schemaFile.getInterfaceOrThrow(type).addProperty({
      name: functionsConstant,
      type: Writers.objectType({ properties }),
    })
  }
}

function getContainerProperties(
  entityContainer: ODataEntityContainer,
): OptionalKind<PropertySignatureStructure>[] {
  const properties = entityContainer.entitySets.map(getEntitySetProperty)
  if (entityContainer.functionImports.length) {
    properties.push({
      name: functionsConstant,
      type: Writers.objectType({
        properties: entityContainer.functionImports.map(
          getFunctionImportProperty,
        ),
      }),
    })
  }
  return properties
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
      properties: getContainerProperties(schema.entityContainer),
      isExported: true,
    })
  }

  schemaFile.addTypeAliases(schema.enumTypes.map(getEnumInterface))

  schemaFile.addInterfaces([
    ...schema.complexTypes.map(getEntityInterface),
    ...schema.entityTypes.map(getEntityInterface),
    ...schema.functions.map(getFunctionInterface),
  ])

  bindFunctions(schemaFile, schema.functions)

  return schemaFile.fixMissingImports().organizeImports()
}
