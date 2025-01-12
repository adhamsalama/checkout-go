package transactions

import (
	"checkout-go/customtypes"
)

type Transaction struct {
	ID     int                     `db:"id" goqu:"skipinsert"`
	UserID int                     `db:"user_id" goqu:"omitnil"`
	Name   string                  `db:"name" goqu:"omitnil"`
	Price  float64                 `db:"price" goqu:"omitnil"`
	Date   customtypes.TimeWrapper `db:"date" goqu:"omitnil"`
	Tags   customtypes.StringSlice `db:"tags" json:"tags" goqu:"omitnil"`
}
