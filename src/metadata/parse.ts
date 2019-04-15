import fs from "fs"
import { PathReporter } from "io-ts/lib/PathReporter"
import { promisify } from "util"
import { parseString as parseXmlString } from "xml2js"

import { transformMetadata } from "./transform-metadata"
import { ODataMetadata } from "./types"
import { XmlODataMetadataCodec } from "./xml-types"

const readFile = promisify(fs.readFile)

async function parseXmlFile(path: string): Promise<unknown> {
  const xml = await readFile(path, { encoding: "utf8" })

  return new Promise<unknown>(async (resolve, reject) => {
    parseXmlString(xml, async (error, result) =>
      error ? reject(error) : resolve(result),
    )
  })
}

async function decodeParsedXmlFile(value: unknown): Promise<ODataMetadata> {
  const metadata = XmlODataMetadataCodec.decode(value).map(transformMetadata)

  if (metadata.isLeft()) {
    throw new Error(
      `Decoding errors:\n${PathReporter.report(metadata).join("\n")}`,
    )
  }

  return metadata.value
}

export async function parse(path: string): Promise<ODataMetadata> {
  const parsed = await parseXmlFile(path)
  const decoded = await decodeParsedXmlFile(parsed)
  return decoded
}
