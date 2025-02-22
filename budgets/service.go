package budgets

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	queries "checkout-go/budgets/generated"

	goqu "github.com/doug-martin/goqu/v9"
)

type BudgetService struct {
	DB *goqu.Database
}

func (service *BudgetService) CreateMonthylBudget(userID int64, name string, value float64) (*queries.MonthlyBudget, error) {
	q := queries.New(service.DB)
	params := queries.CreateMonthlyBudgetParams{
		UserID: userID,
		Name:   name,
		Value:  value,
		Date:   time.Now().Format(time.RFC3339),
	}
	monthylBudget, err := q.CreateMonthlyBudget(context.Background(), params)
	if err != nil {
		return nil, err
	}
	return &monthylBudget, nil
}

func (service *BudgetService) GetMonthylBudget(userID int64) (*queries.MonthlyBudget, error) {
	q := queries.New(service.DB)
	monthylBudget, err := q.GetMonthlyBudget(context.Background(), userID)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, nil
		}
		return nil, err
	}
	return &monthylBudget, nil
}

func (service *BudgetService) UpdateMonthylBudget(userID int64, name string, value float64) (*queries.MonthlyBudget, error) {
	q := queries.New(service.DB)
	params := queries.UpdateMonthlyBudgetParams{
		UserID: userID,
		Name:   name,
		Value:  value,
	}
	err := q.UpdateMonthlyBudget(context.Background(), params)
	if err != nil {
		return nil, err
	}
	return &queries.MonthlyBudget{
		UserID: userID,
		Name:   name,
		Value:  value,
	}, nil
}

func (service *BudgetService) DeleteMonthlyBudget(userID int64) (*queries.MonthlyBudget, error) {
	q := queries.New(service.DB)
	monthlyBudget, err := q.GetMonthlyBudget(context.Background(), userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("no monthly budget found")
		}
		return nil, err
	}
	deleteErr := q.DeleteMonthlyBudget(context.Background(), userID)
	if deleteErr != nil {
		return nil, deleteErr
	}
	return &monthlyBudget, nil
}
