import fs from "fs"
import * as t from "io-ts"
import { PathReporter } from "io-ts/lib/PathReporter"
import { BooleanFromString } from "io-ts-types"
import { NonEmptyString } from "io-ts-types/lib/NonEmptyString"
import { promisify } from "util"
import { parseString as parseXmlString } from "xml2js"

const readFile = promisify(fs.readFile)

export interface ODataProperty {
  name: string
  type: string
  isNullable: boolean
}

export interface ODataEntity {
  name: string
  properties: ODataProperty[] | null
  navigationProperties: ODataProperty[] | null
}

export interface ODataSchema {
  namespace: string
  entities: ODataEntity[] | null
}

export interface ODataMetadata {
  schemas: ODataSchema[]
}

const XmlODataProperty = t.type({
  $: t.intersection([
    t.type({
      Name: NonEmptyString,
      Type: NonEmptyString,
    }),
    t.partial({
      Nullable: BooleanFromString,
    }),
  ]),
})

const XmlODataNavigationProperty = t.type({
  $: t.intersection([
    t.type({
      Name: NonEmptyString,
      Type: NonEmptyString,
    }),
    t.partial({
      Nullable: BooleanFromString,
    }),
  ]),
})

const XmlODataEntity = t.intersection([
  t.type({
    $: t.type({
      Name: NonEmptyString,
    }),
  }),
  t.partial({
    Property: t.array(XmlODataProperty),
    NavigationProperty: t.array(XmlODataNavigationProperty),
  }),
])

const XmlODataSchema = t.intersection([
  t.type({
    $: t.type({
      Namespace: NonEmptyString,
    }),
  }),
  t.partial({
    EntityType: t.array(XmlODataEntity),
  }),
])

const XmlODataMetadata = t.type({
  "edmx:Edmx": t.type({
    "edmx:DataServices": t.tuple([
      t.type({
        Schema: t.array(XmlODataSchema),
      }),
    ]),
  }),
})

function getProperty(
  property:
    | t.TypeOf<typeof XmlODataProperty>
    | t.TypeOf<typeof XmlODataNavigationProperty>,
): ODataProperty {
  return {
    name: property.$.Name,
    type: property.$.Type,
    isNullable: property.$.Nullable === undefined ? true : property.$.Nullable,
  }
}

function getEntity(entity: t.TypeOf<typeof XmlODataEntity>): ODataEntity {
  return {
    name: entity.$.Name,
    properties: entity.Property ? entity.Property.map(getProperty) : null,
    navigationProperties: entity.NavigationProperty
      ? entity.NavigationProperty.map(getProperty)
      : null,
  }
}

function getMetadata(
  metadata: t.TypeOf<typeof XmlODataMetadata>,
): ODataMetadata {
  return {
    schemas: metadata["edmx:Edmx"]["edmx:DataServices"][0].Schema.map(
      schema => ({
        namespace: schema.$.Namespace,
        entities: schema.EntityType ? schema.EntityType.map(getEntity) : null,
      }),
    ),
  }
}

export async function parse(path: string): Promise<unknown> {
  const xml = await readFile(path, { encoding: "utf8" })

  return new Promise<unknown>(async (resolve, reject) => {
    parseXmlString(xml, async (error, result) =>
      error ? reject(error) : resolve(result),
    )
  })
}

export async function decode(value: unknown): Promise<ODataMetadata> {
  const metadata = XmlODataMetadata.decode(value).map(getMetadata)

  if (metadata.isLeft()) {
    throw new Error(
      `Decoding errors:\n${PathReporter.report(metadata).join("\n")}`,
    )
  }

  return metadata.value
}
