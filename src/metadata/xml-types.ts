import { chain, map } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/pipeable"
import * as t from "io-ts"
import { extendType } from "io-ts-promise"

const NumberFromXmlSchemaIntegerString = extendType(
  t.string,
  (value) => {
    if (/^[+-]?\d+$/.test(value)) {
      return Number(value)
    } else {
      throw new Error(`Value "${value}" is not a valid XML Schema integer.`)
    }
  },
  (value) => value.toString(),
  "NumberFromXmlSchemaIntegerString",
)

const BooleanFromString = extendType(
  t.keyof({ true: null, false: null }),
  (value) => value === "true",
  (value) => (value ? "true" : "false"),
  "BooleanFromString",
)

const True = new t.Type<true, boolean, boolean>(
  "True",
  (value): value is true => value === true,
  (value, context) => (value ? t.success(value) : t.failure(value, context)),
  t.identity,
)
const TrueFromString = BooleanFromString.pipe(True, "TrueFromString")

const False = new t.Type<false, boolean, boolean>(
  "False",
  (value): value is false => value === false,
  (value, context) => (!value ? t.success(value) : t.failure(value, context)),
  t.identity,
)
const FalseFromString = BooleanFromString.pipe(False, "FalseFromString")

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
    value.split(".").every((part) => SimpleIdentifier.is(part)),
  "QualifiedName",
)

const TypeInfo = t.type({ name: t.string, isCollection: t.boolean })
const SingleOrCollectionTypeQualifiedName = new t.Type<
  t.TypeOf<typeof TypeInfo>,
  unknown,
  unknown
>(
  "SingleOrCollectionTypeQualifiedName",
  TypeInfo.is,
  (value, context) => {
    return pipe(
      t.string.validate(value, context),
      chain((stringValue) => {
        const matches = /^Collection\((.+)\)$/.exec(stringValue)
        const baseType = matches ? matches[1] : stringValue
        return pipe(
          QualifiedName.validate(baseType, context),
          map((name) => ({ name, isCollection: !!matches })),
        )
      }),
    )
  },
  (value) => (value.isCollection ? `Collection(${value.name})` : value.name),
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

const XmlODataParameterCodec = t.type(
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
  "ODataParameter",
)
export type XmlODataParameter = t.TypeOf<typeof XmlODataParameterCodec>

const XmlODataReturnTypeCodec = t.type(
  {
    $: t.intersection([
      t.type({
        Type: SingleOrCollectionTypeQualifiedName,
      }),
      t.partial({
        Nullable: BooleanFromString,
      }),
    ]),
  },
  "ODataReturnType",
)
export type XmlODataReturnType = t.TypeOf<typeof XmlODataReturnTypeCodec>

const XmlODataBoundActionCodec = t.intersection(
  [
    t.type({
      $: t.type({
        Name: SimpleIdentifier,
        IsBound: TrueFromString,
      }),
      Parameter: t.array(XmlODataParameterCodec),
    }),
    t.partial({
      ReturnType: t.tuple([XmlODataReturnTypeCodec]),
    }),
  ],
  "ODataBoundAction",
)

const XmlODataUnboundActionCodec = t.intersection(
  [
    t.type({
      $: t.intersection([
        t.type({
          Name: SimpleIdentifier,
        }),
        t.partial({
          IsBound: FalseFromString,
        }),
      ]),
    }),
    t.partial({
      Parameter: t.array(XmlODataParameterCodec),
      ReturnType: t.tuple([XmlODataReturnTypeCodec]),
    }),
  ],
  "ODataUnboundAction",
)

const XmlODataActionCodec = t.union([
  XmlODataBoundActionCodec,
  XmlODataUnboundActionCodec,
])
export type XmlODataAction = t.TypeOf<typeof XmlODataActionCodec>

const XmlODataBoundFunctionCodec = t.type(
  {
    $: t.type({
      Name: SimpleIdentifier,
      IsBound: TrueFromString,
    }),
    Parameter: t.array(XmlODataParameterCodec),
    ReturnType: t.tuple([XmlODataReturnTypeCodec]),
  },
  "ODataBoundFunction",
)

const XmlODataUnboundFunctionCodec = t.intersection(
  [
    t.type({
      $: t.intersection([
        t.type({
          Name: SimpleIdentifier,
        }),
        t.partial({
          IsBound: FalseFromString,
        }),
      ]),
      ReturnType: t.tuple([XmlODataReturnTypeCodec]),
    }),
    t.partial({
      Parameter: t.array(XmlODataParameterCodec),
    }),
  ],
  "ODataUnboundFunction",
)

const XmlODataFunctionCodec = t.union([
  XmlODataBoundFunctionCodec,
  XmlODataUnboundFunctionCodec,
])
export type XmlODataFunction = t.TypeOf<typeof XmlODataFunctionCodec>

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

const XmlODataActionImportCodec = t.type(
  {
    $: t.type({
      Name: SimpleIdentifier,
      Action: QualifiedName,
    }),
  },
  "ODataActionImport",
)
export type XmlODataActionImport = t.TypeOf<typeof XmlODataActionImportCodec>

const XmlODataFunctionImportCodec = t.type(
  {
    $: t.type({
      Name: SimpleIdentifier,
      Function: QualifiedName,
    }),
  },
  "ODataFunctionImport",
)
export type XmlODataFunctionImport = t.TypeOf<
  typeof XmlODataFunctionImportCodec
>

const XmlODataEntityContainerCodec = t.intersection(
  [
    t.type({
      $: t.type({
        Name: SimpleIdentifier,
      }),
    }),
    t.partial({
      EntitySet: t.array(XmlODataEntitySetCodec),
      ActionImport: t.array(XmlODataActionImportCodec),
      FunctionImport: t.array(XmlODataFunctionImportCodec),
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
      Action: t.array(XmlODataActionCodec),
      Function: t.array(XmlODataFunctionCodec),
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
