package budgets

type CreateTaggedBudgetDTO struct {
	Name  string  `db:"name" goqu:"omitnil" json:"name"`
	Value float64 `db:"value" goqu:"omitnil" json:"value"`
	Tag   string  `db:"tag" goqu:"omitnil" json:"tag"`
}
