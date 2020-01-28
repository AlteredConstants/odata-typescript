import * as Constant from "./Constant"
import * as Edm from "./Edm"

export { Constant, Edm }

export interface ODataEntityCollection<T> {
  "@count"?: number
  value: T[]
  "@nextLink"?: string
}
