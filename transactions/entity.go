package transactions

import (
	"checkout-go/customtypes"
)

type Transaction struct {
	ID     int                     `db:"id" goqu:"skipinsert" json:"id"`
	UserID int                     `db:"user_id" goqu:"omitnil" json:"userId"`
	Name   string                  `db:"name" goqu:"omitnil" json:"name"`
	Price  float64                 `db:"price" goqu:"omitnil" json:"price"`
	Date   customtypes.TimeWrapper `db:"date" goqu:"omitnil" json:"date"`
	Tags   customtypes.StringSlice `db:"tags" json:"tags" goqu:"omitnil"`
}
