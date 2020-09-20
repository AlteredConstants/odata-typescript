import { isLeft, map } from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import * as C from "io-ts/Codec"
import * as D from "io-ts/Decoder"
import * as G from "io-ts/Guard"

const NumberFromXmlSchemaIntegerString = C.make(
  pipe(
    D.string,
    D.parse((value) => {
      if (/^[+-]?\d+$/.test(value)) {
        return D.success(Number(value))
      } else {
        return D.failure(value, "Not a valid XML Schema integer.")
      }
    }),
  ),
  { encode: String },
)

const BooleanFromString = C.make(
  pipe(
    D.literal("true", "false"),
    D.parse((value) => D.success(value === "true")),
  ),
  { encode: String },
)

const TrueFromString = pipe(
  BooleanFromString,
  C.refine((value): value is true => value === true, "True"),
)

const FalseFromString = pipe(
  BooleanFromString,
  C.refine((value): value is false => value === false, "False"),
)

const simpleIdentifierRegExp = /^[_\p{L}\p{Nl}](?:[_\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}])*$/u
interface SimpleIdentifierBrand {
  readonly SimpleIdentifier: unique symbol
}
const SimpleIdentifierGuard = pipe(
  G.string,
  G.refine((value): value is string & SimpleIdentifierBrand =>
    simpleIdentifierRegExp.test(value),
  ),
)
const SimpleIdentifier = C.fromDecoder(
  D.fromGuard(SimpleIdentifierGuard, "SimpleIdentifier"),
)

interface QualifiedNameBrand {
  readonly QualifiedName: unique symbol
}
const QualifiedName = pipe(
  C.string,
  C.refine(
    (value): value is string & QualifiedNameBrand =>
      value.split(".").every(SimpleIdentifierGuard.is),
    "QualifiedName",
  ),
)

const SingleOrCollectionTypeQualifiedName = C.make(
  pipe(
    D.string,
    D.parse((value) => {
      const matches = value.match(/^Collection\((.+)\)$/)
      const baseType = matches ? matches[1] : value
      return pipe(
        QualifiedName.decode(baseType),
        map((name) => ({ isCollection: !!matches, name })),
      )
    }),
  ),
  {
    encode: (value) =>
      value.isCollection ? `Collection(${value.name})` : value.name,
  },
)

const XmlODataPropertyDecoder = D.type({
  $: pipe(
    D.type({
      Name: SimpleIdentifier,
      Type: SingleOrCollectionTypeQualifiedName,
    }),
    D.intersect(
      D.partial({
        Nullable: BooleanFromString,
      }),
    ),
  ),
})
export type XmlODataProperty = D.TypeOf<typeof XmlODataPropertyDecoder>

const XmlODataNavigationPropertyDecoder = D.type({
  $: pipe(
    D.type({
      Name: SimpleIdentifier,
      Type: SingleOrCollectionTypeQualifiedName,
    }),
    D.intersect(
      D.partial({
        Nullable: BooleanFromString,
      }),
    ),
  ),
})
export type XmlODataNavigationProperty = D.TypeOf<
  typeof XmlODataNavigationPropertyDecoder
>

const XmlODataEntityTypeDecoder = pipe(
  D.type({
    $: D.type({
      Name: SimpleIdentifier,
    }),
  }),
  D.intersect(
    D.partial({
      Property: D.array(XmlODataPropertyDecoder),
      NavigationProperty: D.array(XmlODataNavigationPropertyDecoder),
    }),
  ),
)
export type XmlODataEntityType = D.TypeOf<typeof XmlODataEntityTypeDecoder>

const XmlODataComplexTypeDecoder = pipe(
  D.type({
    $: D.type({
      Name: SimpleIdentifier,
    }),
  }),
  D.intersect(
    D.partial({
      Property: D.array(XmlODataPropertyDecoder),
      NavigationProperty: D.array(XmlODataNavigationPropertyDecoder),
    }),
  ),
)
export type XmlODataComplexType = D.TypeOf<typeof XmlODataComplexTypeDecoder>

const XmlODataEnumMemberDecoder = D.type({
  $: pipe(
    D.type({
      Name: SimpleIdentifier,
    }),
    D.intersect(
      D.partial({
        Value: NumberFromXmlSchemaIntegerString,
      }),
    ),
  ),
})
export type XmlODataEnumMember = D.TypeOf<typeof XmlODataEnumMemberDecoder>

const XmlODataEnumTypeDecoder = pipe(
  D.type({
    $: D.type({
      Name: SimpleIdentifier,
    }),
  }),
  D.intersect(
    D.partial({
      Member: D.array(XmlODataEnumMemberDecoder),
    }),
  ),
)
export type XmlODataEnumType = D.TypeOf<typeof XmlODataEnumTypeDecoder>

const XmlODataParameterDecoder = D.type({
  $: pipe(
    D.type({
      Name: SimpleIdentifier,
      Type: SingleOrCollectionTypeQualifiedName,
    }),
    D.intersect(
      D.partial({
        Nullable: BooleanFromString,
      }),
    ),
  ),
})
export type XmlODataParameter = D.TypeOf<typeof XmlODataParameterDecoder>

const XmlODataReturnTypeDecoder = D.type({
  $: pipe(
    D.type({
      Type: SingleOrCollectionTypeQualifiedName,
    }),
    D.intersect(
      D.partial({
        Nullable: BooleanFromString,
      }),
    ),
  ),
})
export type XmlODataReturnType = D.TypeOf<typeof XmlODataReturnTypeDecoder>

const XmlODataBoundActionDecoder = pipe(
  D.type({
    $: D.type({
      Name: SimpleIdentifier,
      IsBound: TrueFromString,
    }),
    Parameter: D.array(XmlODataParameterDecoder),
  }),
  D.intersect(
    D.partial({
      ReturnType: D.tuple(XmlODataReturnTypeDecoder),
    }),
  ),
)

const XmlODataUnboundActionDecoder = pipe(
  D.type({
    $: pipe(
      D.type({
        Name: SimpleIdentifier,
      }),
      D.intersect(
        D.partial({
          IsBound: FalseFromString,
        }),
      ),
    ),
  }),
  D.intersect(
    D.partial({
      Parameter: D.array(XmlODataParameterDecoder),
      ReturnType: D.tuple(XmlODataReturnTypeDecoder),
    }),
  ),
)

const XmlODataActionDecoder = D.union(
  XmlODataBoundActionDecoder,
  XmlODataUnboundActionDecoder,
)
export type XmlODataAction = D.TypeOf<typeof XmlODataActionDecoder>

const XmlODataBoundFunctionDecoder = D.type({
  $: D.type({
    Name: SimpleIdentifier,
    IsBound: TrueFromString,
  }),
  Parameter: D.array(XmlODataParameterDecoder),
  ReturnType: D.tuple(XmlODataReturnTypeDecoder),
})

const XmlODataUnboundFunctionDecoder = pipe(
  D.type({
    $: pipe(
      D.type({
        Name: SimpleIdentifier,
      }),
      D.intersect(
        D.partial({
          IsBound: FalseFromString,
        }),
      ),
    ),
    ReturnType: D.tuple(XmlODataReturnTypeDecoder),
  }),
  D.intersect(
    D.partial({
      Parameter: D.array(XmlODataParameterDecoder),
    }),
  ),
)

const XmlODataFunctionDecoder = D.union(
  XmlODataBoundFunctionDecoder,
  XmlODataUnboundFunctionDecoder,
)
export type XmlODataFunction = D.TypeOf<typeof XmlODataFunctionDecoder>

const XmlODataEntitySetDecoder = D.type({
  $: D.type({
    Name: SimpleIdentifier,
    EntityType: QualifiedName,
  }),
})
export type XmlODataEntitySet = D.TypeOf<typeof XmlODataEntitySetDecoder>

const XmlODataActionImportDecoder = D.type({
  $: D.type({
    Name: SimpleIdentifier,
    Action: QualifiedName,
  }),
})
export type XmlODataActionImport = D.TypeOf<typeof XmlODataActionImportDecoder>

const XmlODataFunctionImportDecoder = D.type({
  $: D.type({
    Name: SimpleIdentifier,
    Function: QualifiedName,
  }),
})
export type XmlODataFunctionImport = D.TypeOf<
  typeof XmlODataFunctionImportDecoder
>

const XmlODataEntityContainerDecoder = pipe(
  D.type({
    $: D.type({
      Name: SimpleIdentifier,
    }),
  }),
  D.intersect(
    D.partial({
      EntitySet: D.array(XmlODataEntitySetDecoder),
      ActionImport: D.array(XmlODataActionImportDecoder),
      FunctionImport: D.array(XmlODataFunctionImportDecoder),
    }),
  ),
)
export type XmlODataEntityContainer = D.TypeOf<
  typeof XmlODataEntityContainerDecoder
>

const XmlODataSchemaDecoder = pipe(
  D.type({
    $: D.type({
      Namespace: QualifiedName,
    }),
  }),
  D.intersect(
    D.partial({
      ComplexType: D.array(XmlODataComplexTypeDecoder),
      EntityContainer: D.tuple(XmlODataEntityContainerDecoder),
      EntityType: D.array(XmlODataEntityTypeDecoder),
      EnumType: D.array(XmlODataEnumTypeDecoder),
      Action: D.array(XmlODataActionDecoder),
      Function: D.array(XmlODataFunctionDecoder),
    }),
  ),
)
export type XmlODataSchema = D.TypeOf<typeof XmlODataSchemaDecoder>

const XmlODataMetadataDecoder = D.type({
  "edmx:Edmx": D.type({
    "edmx:DataServices": D.tuple(
      D.type({
        Schema: D.array(XmlODataSchemaDecoder),
      }),
    ),
  }),
})
export type XmlODataMetadata = D.TypeOf<typeof XmlODataMetadataDecoder>

export function decodeXmlODataMetadata(value: unknown): XmlODataMetadata {
  const result = XmlODataMetadataDecoder.decode(value)
  if (isLeft(result)) {
    throw new Error(`Metadata XML is not valid:\n${D.draw(result.left)}`)
  }
  return result.right
}
