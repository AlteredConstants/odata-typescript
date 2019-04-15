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
