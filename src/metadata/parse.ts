import fs from "fs"
import { promisify } from "util"
import { parseString as parseXmlString } from "xml2js"

import { transformMetadata } from "./transform-metadata"
import { ODataMetadata } from "./types"
import { decodeXmlODataMetadata } from "./xml-types"

const readFile = promisify(fs.readFile)

async function parseXmlFile(path: string): Promise<unknown> {
  const xml = await readFile(path, { encoding: "utf8" })

  return new Promise<unknown>((resolve, reject) => {
    parseXmlString(xml, (error, result) =>
      error ? reject(error) : resolve(result),
    )
  })
}

export async function parse(path: string): Promise<ODataMetadata> {
  const parsed = await parseXmlFile(path)
  const decoded = decodeXmlODataMetadata(parsed)
  return transformMetadata(decoded)
}
