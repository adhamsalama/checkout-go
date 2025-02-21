package budgets

import "checkout-go/customtypes"

type MonthlyBudget struct {
	ID     int                     `db:"id" goqu:"skipinsert" json:"id"`
	UserID int                     `db:"user_id" goqu:"omitnil" json:"userId" bson:"userId"`
	Name   string                  `db:"name" goqu:"omitnil" json:"name"`
	Value  float64                 `db:"value" goqu:"omitnil" json:"value"`
	Date   customtypes.TimeWrapper `db:"date" goqu:"omitnil" json:"date"`
}
