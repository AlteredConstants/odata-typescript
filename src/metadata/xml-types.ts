import * as t from "io-ts"
import { BooleanFromString, IntegerFromString } from "io-ts-types"
import { NonEmptyString } from "io-ts-types/lib/NonEmptyString"

const XmlODataPropertyCodec = t.type({
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
export type XmlODataProperty = t.TypeOf<typeof XmlODataPropertyCodec>

const XmlODataNavigationPropertyCodec = t.type({
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
export type XmlODataNavigationProperty = t.TypeOf<
  typeof XmlODataNavigationPropertyCodec
>

const XmlODataEntityTypeCodec = t.intersection([
  t.type({
    $: t.type({
      Name: NonEmptyString,
    }),
  }),
  t.partial({
    Property: t.array(XmlODataPropertyCodec),
    NavigationProperty: t.array(XmlODataNavigationPropertyCodec),
  }),
])
export type XmlODataEntityType = t.TypeOf<typeof XmlODataEntityTypeCodec>

const XmlODataComplexTypeCodec = t.intersection([
  t.type({
    $: t.type({
      Name: NonEmptyString,
    }),
  }),
  t.partial({
    Property: t.array(XmlODataPropertyCodec),
    NavigationProperty: t.array(XmlODataNavigationPropertyCodec),
  }),
])
export type XmlODataComplexType = t.TypeOf<typeof XmlODataComplexTypeCodec>

const XmlODataEnumMemberCodec = t.type({
  $: t.intersection([
    t.type({
      Name: NonEmptyString,
    }),
    t.partial({
      Value: IntegerFromString,
    }),
  ]),
})
export type XmlODataEnumMember = t.TypeOf<typeof XmlODataEnumMemberCodec>

const XmlODataEnumTypeCodec = t.intersection([
  t.type({
    $: t.type({
      Name: NonEmptyString,
    }),
  }),
  t.partial({
    Member: t.array(XmlODataEnumMemberCodec),
  }),
])
export type XmlODataEnumType = t.TypeOf<typeof XmlODataEnumTypeCodec>

const XmlODataEntitySetCodec = t.type({
  $: t.type({
    Name: NonEmptyString,
    EntityType: NonEmptyString,
  }),
})
export type XmlODataEntitySet = t.TypeOf<typeof XmlODataEntitySetCodec>

const XmlODataEntityContainerCodec = t.intersection([
  t.type({
    $: t.type({
      Name: NonEmptyString,
    }),
  }),
  t.partial({
    EntitySet: t.array(XmlODataEntitySetCodec),
  }),
])
export type XmlODataEntityContainer = t.TypeOf<
  typeof XmlODataEntityContainerCodec
>

const XmlODataSchemaCodec = t.intersection([
  t.type({
    $: t.type({
      Namespace: NonEmptyString,
    }),
  }),
  t.partial({
    EntityType: t.array(XmlODataEntityTypeCodec),
    ComplexType: t.array(XmlODataComplexTypeCodec),
    EnumType: t.array(XmlODataEnumTypeCodec),
    EntityContainer: t.tuple([XmlODataEntityContainerCodec]),
  }),
])
export type XmlODataSchema = t.TypeOf<typeof XmlODataSchemaCodec>

export const XmlODataMetadataCodec = t.type({
  "edmx:Edmx": t.type({
    "edmx:DataServices": t.tuple([
      t.type({
        Schema: t.array(XmlODataSchemaCodec),
      }),
    ]),
  }),
})
export type XmlODataMetadata = t.TypeOf<typeof XmlODataMetadataCodec>
