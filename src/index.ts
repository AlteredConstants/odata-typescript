import { removeSync } from "fs-extra"
import { join, resolve } from "path"
import {
  Directory,
  InterfaceDeclarationStructure,
  Project,
  PropertySignatureStructure,
  SourceFile,
} from "ts-morph"
import {
  decode,
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
  const type = property.type.replace(/^Collection\((.*)\)$/, "Array<$1>")
  return property.isNullable ? `${type} | null` : type
}

function getProperty(property: ODataProperty): PropertySignatureStructure {
  return {
    name: property.name,
    type: getType(property),
  }
}

function getPropertiesInterface(
  entity: ODataEntity,
): InterfaceDeclarationStructure {
  return {
    name: entity.name,
    properties: entity.properties
      ? entity.properties.map(getProperty)
      : undefined,
    isExported: true,
  }
}

function addEntitiesToSchemaFile(
  schemaFile: SourceFile,
  entities: ODataEntity[],
): void {
  for (const entity of entities) {
    const propertiesInterface = schemaFile.addInterface(
      getPropertiesInterface(entity),
    )
    if (entity.navigationProperties) {
      const name = `${propertiesInterface.getName()}NavigationProperties`
      schemaFile.addInterface({
        name,
        properties: entity.navigationProperties.map(getProperty),
      })
      propertiesInterface.addProperty({
        name: `[${constantNamespace}.navigationProperties]`,
        type: name,
      })
    }
  }
}

function updateNamespaceIndex(
  namespaceSegment: string,
  directory: Directory,
): void {
  const indexFile =
    directory.getSourceFile("index.ts") ||
    directory.createSourceFile("index.ts")

  indexFile.addImportDeclaration({
    moduleSpecifier: `./${namespaceSegment}`,
    namespaceImport: namespaceSegment,
  })

  const exportDeclaration =
    indexFile.getExportDeclaration(d => !d.hasModuleSpecifier()) ||
    indexFile.addExportDeclaration({})
  exportDeclaration.addNamedExport({ name: namespaceSegment })
}

function updateNamespaceDirectories(
  namespace: string[],
  directory: Directory,
): SourceFile {
  const [firstSegment, ...restSegments] = namespace

  updateNamespaceIndex(firstSegment, directory)

  if (restSegments.length) {
    const subDirectory =
      directory.getDirectory(firstSegment) ||
      directory.createDirectory(firstSegment)

    return updateNamespaceDirectories(restSegments, subDirectory)
  }

  return directory.createSourceFile(`${firstSegment}.ts`)
}

function createSchemaFile(
  schema: ODataSchema,
  directory: Directory,
): SourceFile {
  const schemaFile = updateNamespaceDirectories(
    schema.namespace.split("."),
    directory,
  )

  if (schema.entities) {
    addEntitiesToSchemaFile(schemaFile, schema.entities)
  }

  return schemaFile
}

async function run(metadataFilePath: string) {
  removeSync(buildPath)

  const project = new Project()
  const buildDirectory = project.createDirectory(buildPath)

  const constantFile = project
    .addExistingSourceFile(baseConstantPath)
    .copyToDirectory(buildDirectory)
  const edmFile = project
    .addExistingSourceFile(baseEdmPath)
    .copyToDirectory(buildDirectory)
  const indexFile = buildDirectory.createSourceFile("index.ts")

  const parsedValue = await parse(metadataFilePath)

  const metadata = await decode(parsedValue)
  const schemas = metadata.schemas.filter(s => s.entities)

  const schemaFiles = schemas.map(schema => {
    const schemaFile = createSchemaFile(schema, buildDirectory)

    schemaFile.addImportDeclarations([
      {
        moduleSpecifier: schemaFile.getRelativePathAsModuleSpecifierTo(
          constantFile,
        ),
        namespaceImport: constantNamespace,
      },
      {
        moduleSpecifier: schemaFile.getRelativePathAsModuleSpecifierTo(edmFile),
        namespaceImport: "Edm",
      },
    ])

    return schemaFile
  })

  const exportNames = indexFile
    .getExportDeclarations()
    .map(d => d.getNamedExports())
    .flat(1)
    .map(e => e.getName())

  for (const schemaFile of schemaFiles) {
    schemaFile.addImportDeclaration({
      moduleSpecifier: schemaFile.getRelativePathAsModuleSpecifierTo(indexFile),
      namedImports: exportNames,
    })
  }

  await project.save()
}

run(process.argv[2]).catch(error => console.error(error))
