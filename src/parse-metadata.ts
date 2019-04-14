import fs from "fs"
import * as t from "io-ts"
import { BooleanFromString, IntegerFromString } from "io-ts-types"
import { NonEmptyString } from "io-ts-types/lib/NonEmptyString"
import { PathReporter } from "io-ts/lib/PathReporter"
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
  properties: ODataProperty[]
  navigationProperties: ODataProperty[]
}

export interface ODataEnumMember {
  name: string
  value: number
}

export interface ODataEnum {
  name: string
  members: ODataEnumMember[]
}

export interface ODataEntitySet {
  name: string
  entityType: string
}

export interface ODataEntityContainer {
  name: string
  entitySets: ODataEntitySet[]
}

export interface ODataSchema {
  namespace: string
  entityTypes: ODataEntity[]
  complexTypes: ODataEntity[]
  enumTypes: ODataEnum[]
  entityContainer: ODataEntityContainer | null
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

const XmlODataEntityType = t.intersection([
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

const XmlODataComplexType = t.intersection([
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

const XmlODataEnumMember = t.type({
  $: t.intersection([
    t.type({
      Name: NonEmptyString,
    }),
    t.partial({
      Value: IntegerFromString,
    }),
  ]),
})

const XmlODataEnumType = t.intersection([
  t.type({
    $: t.type({
      Name: NonEmptyString,
    }),
  }),
  t.partial({
    Member: t.array(XmlODataEnumMember),
  }),
])

const XmlODataEntitySet = t.type({
  $: t.type({
    Name: NonEmptyString,
    EntityType: NonEmptyString,
  }),
})

const XmlODataEntityContainer = t.intersection([
  t.type({
    $: t.type({
      Name: NonEmptyString,
    }),
  }),
  t.partial({
    EntitySet: t.array(XmlODataEntitySet),
  }),
])

const XmlODataSchema = t.intersection([
  t.type({
    $: t.type({
      Namespace: NonEmptyString,
    }),
  }),
  t.partial({
    EntityType: t.array(XmlODataEntityType),
    ComplexType: t.array(XmlODataComplexType),
    EnumType: t.array(XmlODataEnumType),
    EntityContainer: t.tuple([XmlODataEntityContainer]),
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

function getEntity(
  entity:
    | t.TypeOf<typeof XmlODataEntityType>
    | t.TypeOf<typeof XmlODataComplexType>,
): ODataEntity {
  return {
    name: entity.$.Name,
    properties: entity.Property ? entity.Property.map(getProperty) : [],
    navigationProperties: entity.NavigationProperty
      ? entity.NavigationProperty.map(getProperty)
      : [],
  }
}

function getEnumMember(
  member: t.TypeOf<typeof XmlODataEnumMember>,
  index: number,
): ODataEnumMember {
  return {
    name: member.$.Name,
    value: member.$.Value === undefined ? index : member.$.Value,
  }
}

function getEnum(enumType: t.TypeOf<typeof XmlODataEnumType>): ODataEnum {
  return {
    name: enumType.$.Name,
    members: enumType.Member ? enumType.Member.map(getEnumMember) : [],
  }
}

function getEntitySet(set: t.TypeOf<typeof XmlODataEntitySet>): ODataEntitySet {
  return {
    name: set.$.Name,
    entityType: set.$.EntityType,
  }
}

function getEntityContainer(
  container: t.TypeOf<typeof XmlODataEntityContainer>,
): ODataEntityContainer {
  return {
    name: container.$.Name,
    entitySets: container.EntitySet
      ? container.EntitySet.map(getEntitySet)
      : [],
  }
}

function getSchema(schema: t.TypeOf<typeof XmlODataSchema>): ODataSchema {
  return {
    namespace: schema.$.Namespace,
    entityTypes: schema.EntityType ? schema.EntityType.map(getEntity) : [],
    complexTypes: schema.ComplexType ? schema.ComplexType.map(getEntity) : [],
    enumTypes: schema.EnumType ? schema.EnumType.map(getEnum) : [],
    entityContainer: schema.EntityContainer
      ? getEntityContainer(schema.EntityContainer[0])
      : null,
  }
}

function getMetadata(
  metadata: t.TypeOf<typeof XmlODataMetadata>,
): ODataMetadata {
  return {
    schemas: metadata["edmx:Edmx"]["edmx:DataServices"][0].Schema.map(
      getSchema,
    ),
  }
}

async function parseXmlFile(path: string): Promise<unknown> {
  const xml = await readFile(path, { encoding: "utf8" })

  return new Promise<unknown>(async (resolve, reject) => {
    parseXmlString(xml, async (error, result) =>
      error ? reject(error) : resolve(result),
    )
  })
}

async function decodeParsedXmlFile(value: unknown): Promise<ODataMetadata> {
  const metadata = XmlODataMetadata.decode(value).map(getMetadata)

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
