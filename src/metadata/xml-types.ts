import * as t from "io-ts"
import { extendType } from "io-ts-promise"

const NumberFromXmlSchemaIntegerString = extendType(
  t.string,
  value => {
    if (/^[+-]?\d+$/.test(value)) {
      return Number(value)
    } else {
      throw new Error(`Value "${value}" is not a valid XML Schema integer.`)
    }
  },
  value => value.toString(),
  "NumberFromXmlSchemaIntegerString",
)

const BooleanFromString = extendType(
  t.keyof({ true: null, false: null }),
  value => value === "true",
  value => (value ? "true" : "false"),
  "BooleanFromString",
)

const simpleIdentifierRegExp = /^[_\p{L}\p{Nl}](?:[_\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}])*$/u
interface SimpleIdentifierBrand {
  readonly SimpleIdentifier: unique symbol
}
const SimpleIdentifier = t.brand(
  t.string,
  (value): value is t.Branded<string, SimpleIdentifierBrand> =>
    simpleIdentifierRegExp.test(value),
  "SimpleIdentifier",
)

interface QualifiedNameBrand {
  readonly QualifiedName: unique symbol
}
const QualifiedName = t.brand(
  t.string,
  (value): value is t.Branded<string, QualifiedNameBrand> =>
    value.split(".").every(part => SimpleIdentifier.is(part)),
  "QualifiedName",
)

export const collectionTypeQualifiedNameRegExp = /^Collection\((.+)\)$/
interface SingleOrCollectionTypeQualifiedNameBrand {
  readonly SingleOrCollectionTypeQualifiedName: unique symbol
}
const SingleOrCollectionTypeQualifiedName = t.brand(
  t.string,
  (
    value,
  ): value is t.Branded<string, SingleOrCollectionTypeQualifiedNameBrand> =>
    QualifiedName.is(value.replace(collectionTypeQualifiedNameRegExp, "$1")),
  "SingleOrCollectionTypeQualifiedName",
)

const XmlODataPropertyCodec = t.type(
  {
    $: t.intersection([
      t.type({
        Name: SimpleIdentifier,
        Type: SingleOrCollectionTypeQualifiedName,
      }),
      t.partial({
        Nullable: BooleanFromString,
      }),
    ]),
  },
  "ODataProperty",
)
export type XmlODataProperty = t.TypeOf<typeof XmlODataPropertyCodec>

const XmlODataNavigationPropertyCodec = t.type(
  {
    $: t.intersection([
      t.type({
        Name: SimpleIdentifier,
        Type: SingleOrCollectionTypeQualifiedName,
      }),
      t.partial({
        Nullable: BooleanFromString,
      }),
    ]),
  },
  "ODataNavigationProperty",
)
export type XmlODataNavigationProperty = t.TypeOf<
  typeof XmlODataNavigationPropertyCodec
>

const XmlODataEntityTypeCodec = t.intersection(
  [
    t.type({
      $: t.type({
        Name: SimpleIdentifier,
      }),
    }),
    t.partial({
      Property: t.array(XmlODataPropertyCodec),
      NavigationProperty: t.array(XmlODataNavigationPropertyCodec),
    }),
  ],
  "ODataEntityType",
)
export type XmlODataEntityType = t.TypeOf<typeof XmlODataEntityTypeCodec>

const XmlODataComplexTypeCodec = t.intersection(
  [
    t.type({
      $: t.type({
        Name: SimpleIdentifier,
      }),
    }),
    t.partial({
      Property: t.array(XmlODataPropertyCodec),
      NavigationProperty: t.array(XmlODataNavigationPropertyCodec),
    }),
  ],
  "ODataComplexType",
)
export type XmlODataComplexType = t.TypeOf<typeof XmlODataComplexTypeCodec>

const XmlODataEnumMemberCodec = t.type(
  {
    $: t.intersection([
      t.type({
        Name: SimpleIdentifier,
      }),
      t.partial({
        Value: NumberFromXmlSchemaIntegerString,
      }),
    ]),
  },
  "ODataEnumMember",
)
export type XmlODataEnumMember = t.TypeOf<typeof XmlODataEnumMemberCodec>

const XmlODataEnumTypeCodec = t.intersection(
  [
    t.type({
      $: t.type({
        Name: SimpleIdentifier,
      }),
    }),
    t.partial({
      Member: t.array(XmlODataEnumMemberCodec),
    }),
  ],
  "ODataEnumType",
)
export type XmlODataEnumType = t.TypeOf<typeof XmlODataEnumTypeCodec>

const XmlODataEntitySetCodec = t.type(
  {
    $: t.type({
      Name: SimpleIdentifier,
      EntityType: QualifiedName,
    }),
  },
  "ODataEntitySet",
)
export type XmlODataEntitySet = t.TypeOf<typeof XmlODataEntitySetCodec>

const XmlODataEntityContainerCodec = t.intersection(
  [
    t.type({
      $: t.type({
        Name: SimpleIdentifier,
      }),
    }),
    t.partial({
      EntitySet: t.array(XmlODataEntitySetCodec),
    }),
  ],
  "ODataEntityContainer",
)
export type XmlODataEntityContainer = t.TypeOf<
  typeof XmlODataEntityContainerCodec
>

const XmlODataSchemaCodec = t.intersection(
  [
    t.type({
      $: t.type({
        Namespace: QualifiedName,
      }),
    }),
    t.partial({
      ComplexType: t.array(XmlODataComplexTypeCodec),
      EntityContainer: t.tuple([XmlODataEntityContainerCodec]),
      EntityType: t.array(XmlODataEntityTypeCodec),
      EnumType: t.array(XmlODataEnumTypeCodec),
    }),
  ],
  "ODataSchema",
)
export type XmlODataSchema = t.TypeOf<typeof XmlODataSchemaCodec>

export const XmlODataMetadataCodec = t.type(
  {
    "edmx:Edmx": t.type({
      "edmx:DataServices": t.tuple([
        t.type({
          Schema: t.array(XmlODataSchemaCodec),
        }),
      ]),
    }),
  },
  "ODataMetadata",
)
export type XmlODataMetadata = t.TypeOf<typeof XmlODataMetadataCodec>
