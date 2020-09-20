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
  ODataAction,
  ODataActionImport,
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
const returnTypeConstant = "[Constant.returnType]"

const entityCollectionTypeName = "ODataEntityCollection"
const navigationPropertyConfigTypeName =
  "ODataNavigationPropertyCollectionConfiguration"

/**
 * http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs01/odata-csdl-xml-v4.01-cs01.html#sec_StructuralProperty
 *
 * http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs01/odata-csdl-xml-v4.01-cs01.html#sec_Parameter
 */
function getStructuralPropertyOrParameter(
  property: ODataProperty | ODataParameter,
): OptionalKind<PropertySignatureStructure> {
  const type = property.isCollection ? `Array<${property.type}>` : property.type
  return {
    name: property.name,
    type: property.isNullable ? Writers.unionType(type, "null") : type,
  }
}

/** http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs01/odata-csdl-xml-v4.01-cs01.html#sec_NavigationProperty */
function getNavigationProperty(
  property: ODataProperty,
): OptionalKind<PropertySignatureStructure> {
  return {
    name: property.name,
    // Collection types aren't allowed to be null.
    type: property.isCollection
      ? `${navigationPropertyConfigTypeName}<${property.type}, "${property.name}@odata.count", "${property.name}@odata.nextLink">`
      : property.isNullable
      ? Writers.unionType(property.type, "null")
      : property.type,
  }
}

function getEntityProperties(
  entity: ODataEntity,
): OptionalKind<PropertySignatureStructure>[] {
  const properties = entity.properties.map(getStructuralPropertyOrParameter)
  if (entity.navigationProperties.length) {
    properties.push({
      name: navigationPropertiesConstant,
      type: Writers.objectType({
        properties: entity.navigationProperties.map(getNavigationProperty),
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
    type: `${entityCollectionTypeName}<${entitySet.type}>`,
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

function getActionOrFunctionImportProperty(
  actionImport: ODataActionImport | ODataFunctionImport,
): OptionalKind<PropertySignatureStructure> {
  return {
    name: actionImport.name,
    type:
      "actionName" in actionImport
        ? actionImport.actionName
        : actionImport.functionName,
  }
}

function getReturnType(returnType: ODataReturnType): string {
  // Nullable attribute applies to the value of the collection:
  // http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs01/odata-csdl-xml-v4.01-cs01.html#sec_ReturnType
  const baseReturnType = returnType.isNullable
    ? `${returnType.type} | null`
    : returnType.type

  return returnType.isCollection ? `Array<${baseReturnType}>` : baseReturnType
}

function getActionOrFunctionInterface(
  action: ODataAction | ODataFunction,
): OptionalKind<InterfaceDeclarationStructure> {
  const parameterProperties = action.parameters.map(
    getStructuralPropertyOrParameter,
  )
  return {
    name: action.name,
    properties: action.returnType
      ? [
          ...parameterProperties,
          {
            name: returnTypeConstant,
            type: getReturnType(action.returnType),
          },
        ]
      : parameterProperties,
    isExported: true,
  }
}

function bindActionsOrFunctions(
  schemaFile: SourceFile,
  actions: Array<ODataAction | ODataFunction>,
): void {
  const boundFunctions = new Map<
    string,
    OptionalKind<PropertySignatureStructure>[]
  >()

  for (const action of actions) {
    if (!("boundType" in action)) {
      continue
    }
    const properties = boundFunctions.get(action.boundType.type) ?? []
    boundFunctions.set(action.boundType.type, [
      ...properties,
      { name: action.name, type: action.name },
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

  const imports = [
    ...entityContainer.actionImports,
    ...entityContainer.functionImports,
  ]
  if (imports.length) {
    properties.push({
      name: functionsConstant,
      type: Writers.objectType({
        properties: imports.map(getActionOrFunctionImportProperty),
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
    ...schema.actions.map(getActionOrFunctionInterface),
    ...schema.functions.map(getActionOrFunctionInterface),
  ])

  bindActionsOrFunctions(schemaFile, [...schema.actions, ...schema.functions])

  return schemaFile.fixMissingImports().organizeImports()
}
