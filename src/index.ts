import { removeSync } from "fs-extra"
import { join, resolve } from "path"
import {
  Directory,
  EnumMemberStructure,
  IndentationText,
  Project,
  PropertySignatureStructure,
  SourceFile,
  WriterFunctions,
} from "ts-morph"

import {
  ODataEntity,
  ODataProperty,
  ODataSchema,
  parse,
} from "./parse-metadata"

const buildPath = resolve(__dirname, "../build")
const basePath = resolve(__dirname, "base")
const baseConstantPath = join(basePath, "constant.ts")
const baseEdmPath = join(basePath, "edm.ts")
const constantNamespace = "Constant"

function getType(property: ODataProperty): string {
  const type = property.type.replace(/^Collection\((.*)\)$/, "$1[]")
  return property.isNullable ? `${type} | null` : type
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
        name: `[${constantNamespace}.navigationProperties]`,
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
    schemaFile.addEnum({
      name: enumType.name,
      members: enumType.members.map<EnumMemberStructure>(member => ({
        name: member.name,
        value: member.value,
      })),
      isExported: true,
    })
  }

  addEntitiesToSchemaFile(schemaFile, [
    ...schema.complexTypes,
    ...schema.entityTypes,
  ])

  return schemaFile
}

async function run(metadataFilePath: string): Promise<void> {
  removeSync(buildPath)

  const project = new Project({
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })
  const buildDirectory = project.createDirectory(buildPath)

  const constantFile = project
    .addExistingSourceFile(baseConstantPath)
    .copyToDirectory(buildDirectory)
  const edmFile = project
    .addExistingSourceFile(baseEdmPath)
    .copyToDirectory(buildDirectory)
  const indexFile = buildDirectory.createSourceFile("index.ts")

  const metadata = await parse(metadataFilePath)

  const schemaFiles = metadata.schemas
    .filter(
      schema =>
        schema.entityTypes.length ||
        schema.complexTypes.length ||
        schema.enumTypes.length ||
        schema.entityContainer,
    )
    .map(schema => {
      const schemaFile = createSchemaFile(schema, buildDirectory)

      schemaFile.addImportDeclarations([
        {
          moduleSpecifier: schemaFile.getRelativePathAsModuleSpecifierTo(
            constantFile,
          ),
          namespaceImport: constantNamespace,
        },
        {
          moduleSpecifier: schemaFile.getRelativePathAsModuleSpecifierTo(
            edmFile,
          ),
          namespaceImport: "Edm",
        },
      ])

      return schemaFile
    })

  const exportNames = indexFile
    .getExportDeclarations()
    .map(declaration => declaration.getNamedExports())
    .flat(1)
    .map(specifier => specifier.getName())

  for (const schemaFile of schemaFiles) {
    schemaFile.addImportDeclaration({
      moduleSpecifier: schemaFile.getRelativePathAsModuleSpecifierTo(indexFile),
      namedImports: exportNames,
    })
  }

  await project.save()
}

// eslint-disable-next-line no-console
run(process.argv[2]).catch(error => console.error(error))
