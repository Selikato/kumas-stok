export type Roll = {
  id: string
  roll_number: string | null
  lot_number: string | null
  quantity: number
  unit_price: number | null
  location: string | null
  received_at: string | null
}

export type Variant = {
  id: string
  color_name: string
  color_code: string | null
  rolls: Roll[]
}

export type Fabric = {
  id: string
  name: string
  fabric_type: string | null
  unit: string | null
  variants: Variant[]
}
