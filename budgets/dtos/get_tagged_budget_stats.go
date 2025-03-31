package budgets

type GetTaggedBudgetStatsDTO struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Value      float64 `json:"value"`
	Tag        string  `json:"tag"`
	TotalPrice float64 `json:"totalPrice"`
}
