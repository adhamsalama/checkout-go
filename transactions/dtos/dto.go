package transactions

type IncomeSpentDTO struct {
	Month           string  `json:"month"`
	TotalIncome     float64 `json:"total_income"`
	TotalSpent      float64 `json:"total_spent"`
	SpentPercentage float64 `json:"spent_percentage"`
}

type CumulativeBalanceDTO struct {
	YearMonth         string  `json:"year_month"`
	CumulativeBalance float64 `json:"cumulative_balance"`
}
