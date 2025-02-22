package budgets

type GetTaggedBudgetStatsDTO struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	Value          float64 `json:"value"`
	IntervalInDays int64   `json:"intervalInDays"`
	TotalPrice     float64 `json:"totalPrice"`
}
