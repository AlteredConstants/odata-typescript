export interface ODataProperty {
  name: string
  type: string
  isCollection: boolean
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

export interface ODataReturnType {
  type: string
  isCollection: boolean
  isNullable: boolean
}

export interface ODataParameter {
  name: string
  type: string
  isCollection: boolean
  isNullable: boolean
}

export interface ODataUnboundFunction {
  name: string
  parameters: ODataParameter[]
  returnType: ODataReturnType
}

export interface ODataBoundFunction extends ODataUnboundFunction {
  boundType: {
    type: string
    isCollection: boolean
    isNullable: boolean
  }
}

export type ODataFunction = ODataUnboundFunction | ODataBoundFunction

export interface ODataEntitySet {
  name: string
  type: string
}

export interface ODataFunctionImport {
  name: string
  functionName: string
}

export interface ODataEntityContainer {
  name: string
  entitySets: ODataEntitySet[]
  functionImports: ODataFunctionImport[]
}

export interface ODataSchema {
  namespace: string
  entityTypes: ODataEntity[]
  complexTypes: ODataEntity[]
  enumTypes: ODataEnum[]
  functions: ODataFunction[]
  entityContainer: ODataEntityContainer | null
}

export interface ODataMetadata {
  schemas: ODataSchema[]
}
