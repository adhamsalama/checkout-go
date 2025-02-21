package budgets

type CreateMonthlyBudgetDTO struct {
	Name  string  `db:"name" goqu:"omitnil" json:"name"`
	Value float64 `db:"value" goqu:"omitnil" json:"value"`
}
