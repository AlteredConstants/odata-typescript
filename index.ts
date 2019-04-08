import { removeSync } from "fs-extra"
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

// import { writeFileSync } from 'fs'
// import { format } from 'prettier'

removeSync("./build")

const constantNamespace = "Constant"

// function mapType(type: string): string {
//   switch (type) {
//     case 'Edm.Boolean':
//       return 'boolean'
//     case 'Edm.Byte':
//     case 'Edm.SByte':
//     case 'Edm.Int16':
//     case 'Edm.Int32':
//     case 'Edm.Int64':
//     case 'Edm.Single':
//     case 'Edm.Double':
//     case 'Edm.Decimal':
//       return 'number'
//     case 'Edm.Binary':
//     case 'Edm.Date':
//     case 'Edm.DateTimeOffset':
//     case 'Edm.Duration':
//     case 'Edm.Guid':
//     case 'Edm.TimeOfDay':
//     case 'Edm.String':
//       return 'string'
//     default:
//       return type
//   }
// }

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

async function run() {
  const metadataFilePath = process.argv[2]

  const project = new Project()
  const buildDirectory = project.createDirectory("./build")

  const constantFile = project
    .addExistingSourceFile("./base/constant.ts")
    .copyToDirectory(buildDirectory)
  const edmFile = project
    .addExistingSourceFile("./base/edm.ts")
    .copyToDirectory(buildDirectory)
  const indexFile = buildDirectory.createSourceFile("index.ts")

  const parsedValue = await parse(metadataFilePath)

  // writeFileSync(
  //   metadataFilePath.replace(/\.xml$/, '') + '.json',
  //   format(JSON.stringify(parsedValue), { parser: 'json' }),
  // )

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

run().catch(error => console.error(error))
