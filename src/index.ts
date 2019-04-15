import { removeSync } from "fs-extra"
import { resolve } from "path"
import { Directory, IndentationText, Project } from "ts-morph"

import { createSchemaFile } from "./create-schema-file"
import { parse } from "./metadata/parse"

const buildPath = resolve(__dirname, "../build")
const basePath = resolve(__dirname, "base")

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
  }

  await project.save()
}

// eslint-disable-next-line no-console
run(process.argv[2]).catch(error => console.error(error))
