package transactions

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	goqu "github.com/doug-martin/goqu/v9"
)

type TransactionService struct {
	DB *goqu.Database
}

func (service *TransactionService) Create(userID int, name string, price float64, date time.Time, tags []string) (*Transaction, error) {
	transactions := service.DB.From("transactions")
	transaction := Transaction{
		ID:     0,
		UserID: userID,
		Name:   name,
		Price:  price,
		Date:   date,
		Tags:   tags,
	}
	result, err := transactions.Insert().Rows(
		goqu.Record{
			"user_id": userID,
			"name":    name,
			"price":   price,
			"date":    date,
			"tags":    "[" + strings.Join(tags, ",") + "]",
		},
	).Executor().Exec()
	if err != nil {
		return nil, err
	}

	insertID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	transaction.ID = int(insertID)
	return &transaction, nil
}

type TransactionUpdate struct {
	Name  *string    `json:"name,omitempty"`
	Price *float64   `json:"price,omitempty"`
	Tags  *[]string  `json:"tags,omitempty"`
	Date  *time.Time `json:"date,omitempty"`
}

func (service *TransactionService) Update(ID int, userID int, updateData TransactionUpdate) (*Transaction, error) {
	fields := map[string]interface{}{}

	if updateData.Name != nil {
		fields["name"] = *updateData.Name
	}
	if updateData.Price != nil {
		fields["price"] = *updateData.Price
	}
	if updateData.Tags != nil {
		// Convert the tags slice to a JSON string before storing
		tagsJSON, err := json.Marshal(*updateData.Tags)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal tags: %w", err)
		}
		fields["tags"] = string(tagsJSON)
	}
	if updateData.Date != nil {
		fields["date"] = updateData.Date.Format(time.RFC3339)
	}
	if len(fields) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	update := service.DB.Update("transactions").Set(fields).Where(goqu.Ex{"id": ID, "user_id": userID})

	res, err := update.Executor().ExecContext(context.TODO())
	if err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}
	numRowsAffected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if numRowsAffected == 0 {
		return nil, fmt.Errorf("transaction not found")
	}
	transaction := Transaction{}
	_, err = service.DB.From("transactions").Where(goqu.Ex{"id": ID, "user_id": userID}).ScanStruct(&transaction)
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}
