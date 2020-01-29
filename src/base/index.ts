import * as Constant from "./Constant"
import * as Edm from "./Edm"

export { Constant, Edm }

export interface ODataEntityCollection<T> {
  "@odata.count"?: number
  value: T[]
  "@odata.nextLink"?: string
}

export interface ODataNavigationPropertyCollectionConfiguration<
  Entity,
  CountProperty extends string,
  NextLinkProperty extends string
> {
  value: Array<Entity>
  countProperty: CountProperty
  nextLinkProperty: NextLinkProperty
}
