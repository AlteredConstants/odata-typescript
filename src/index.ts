import { removeSync } from "fs-extra"
import { resolve } from "path"
import {
  Directory,
  IndentationText,
  Project,
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
  parse,
} from "./parse-metadata"

const buildPath = resolve(__dirname, "../build")
const basePath = resolve(__dirname, "base")
const navigationPropertiesConstant = "Constant.navigationProperties"

function getType(property: ODataProperty): string | WriterFunction {
  const type = property.type.replace(/^Collection\((.*)\)$/, "$1[]")
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

function createSchemaFile(
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
      >(set => ({
        name: set.name,
        type: `${set.entityType}[]`,
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

  return schemaFile
}

function getBuildDirectory(project: Project): Directory {
  const baseDirectory = project.addExistingDirectory(basePath)
  const indexFile = baseDirectory.addExistingSourceFile("index.ts")

  const buildDirectory = baseDirectory.copy(buildPath)

  indexFile.forget()
  baseDirectory.forget()

  return buildDirectory
}

async function run(metadataFilePath: string): Promise<void> {
  removeSync(buildPath)

  const project = new Project({
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })
  const buildDirectory = getBuildDirectory(project)

  const metadata = await parse(metadataFilePath)

  const schemas = metadata.schemas.filter(
    schema =>
      schema.entityTypes.length ||
      schema.complexTypes.length ||
      schema.enumTypes.length ||
      schema.entityContainer,
  )

  for (const schema of schemas) {
    createSchemaFile(schema, buildDirectory)
      .fixMissingImports()
      .organizeImports()
  }

  await project.save()
}

// eslint-disable-next-line no-console
run(process.argv[2]).catch(error => console.error(error))
