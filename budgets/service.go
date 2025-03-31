package budgets

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	dtos "checkout-go/budgets/dtos"
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

func (service *BudgetService) CreateTaggedBudget(userID int64, name string, value float64, tag string) (*queries.TaggedBudget, error) {
	q := queries.New(service.DB)
	params := queries.CreateTaggedBudgetParams{
		UserID: userID,
		Name:   name,
		Value:  value,
		Tag:    tag,
		Date:   time.Now().Format(time.RFC3339),
	}
	budget, err := q.CreateTaggedBudget(context.Background(), params)
	if err != nil {
		return nil, err
	}
	return &budget, nil
}

func (service *BudgetService) GetTaggedBudgets(userID int64) ([]queries.TaggedBudget, error) {
	q := queries.New(service.DB)
	budgets, err := q.GetTaggedBudgets(context.Background(), userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []queries.TaggedBudget{}, nil
		}
		return nil, err
	}
	// I hate whoever thought treating nil slices as empty slices was a good idea to bake into the type system
	if budgets == nil {
		budgets = []queries.TaggedBudget{}
	}
	return budgets, nil
}

func (service *BudgetService) DeleteTaggedBudget(userID int64, budgetID int64) (*queries.TaggedBudget, error) {
	q := queries.New(service.DB)
	getBudgetparams := queries.GetTaggedBudgetParams{
		UserID: userID,
		ID:     budgetID,
	}
	budget, err := q.GetTaggedBudget(context.Background(), getBudgetparams)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("no tagged budget found")
		}
		return nil, err
	}
	deleteBudgetParams := queries.DeleteTaggedBudgetParams{
		UserID: userID,
		ID:     budgetID,
	}
	deleteErr := q.DeleteTaggedBudget(context.Background(), deleteBudgetParams)
	if deleteErr != nil {
		return nil, deleteErr
	}
	return &budget, nil
}

func (service *BudgetService) GetTaggedBudgetsStats(userID int64) ([]dtos.GetTaggedBudgetStatsDTO, error) {
	q := queries.New(service.DB)
	params := queries.GetTaggedBudgetStatsParams{
		UserID:   userID,
		UserID_2: userID,
	}
	budgets, err := q.GetTaggedBudgetStats(context.Background(), params)
	budgetsDTO := []dtos.GetTaggedBudgetStatsDTO{}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return budgetsDTO, nil
		}
		return nil, err
	}
	// I hate whoever thought treating nil slices as empty slices was a good idea to bake into the type system
	if budgets == nil {
		return budgetsDTO, nil
	}
	for _, stat := range budgets {
		var totalPrice float64 = 0
		if stat.TotalPrice.Valid {
			totalPrice = stat.TotalPrice.Float64
		}
		budgetsDTO = append(budgetsDTO, dtos.GetTaggedBudgetStatsDTO{
			ID:         stat.ID,
			Name:       stat.Name,
			Value:      stat.Value,
			Tag:        stat.Tag,
			TotalPrice: totalPrice,
		})
	}
	return budgetsDTO, nil
}

func (service *BudgetService) UpdateTaggedBudget(userID int64, id int64, name string, value float64, tag string) (*queries.TaggedBudget, error) {
	q := queries.New(service.DB)
	if tag == "" {
		return nil, errors.New("empty tags are invalid")
	}
	params := queries.UpdateTaggedBudgetParams{
		ID:     id,
		UserID: userID,
		Name:   name,
		Value:  value,
		Tag:    tag,
	}
	err := q.UpdateTaggedBudget(context.Background(), params)
	if err != nil {
		return nil, err
	}
	return &queries.TaggedBudget{
		ID:     id,
		UserID: userID,
		Name:   name,
		Value:  value,
		Tag:    tag,
	}, nil
}
