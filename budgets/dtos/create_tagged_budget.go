package budgets

type CreateTaggedBudgetDTO struct {
	Name           string  `db:"name" goqu:"omitnil" json:"name"`
	Value          float64 `db:"value" goqu:"omitnil" json:"value"`
	IntervalInDays int64   `db:"interval_in_days" goqu:"omitnil" json:"IntervalInDays"`
	Tag            string  `db:"tag" goqu:"omitnil" json:"tag"`
}
