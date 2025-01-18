package transactions

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"checkout-go/customtypes"

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
		Date:   customtypes.TimeWrapper(date),
		Tags:   customtypes.StringSlice(tags),
	}
	result, err := transactions.Insert().Rows(
		goqu.Record{
			"user_id": userID,
			"name":    name,
			"price":   price,
			"date":    date,
			"tags":    customtypes.StringSlice(tags),
		},
	).Executor().Exec()
	if err != nil {
		return nil, fmt.Errorf("err in inserting row: %s", err)
	}
	insertID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	transaction.ID = int(insertID)
	return &transaction, nil
}

func (service *TransactionService) CreateExpense(userID int, name string, price float64, date time.Time, tags []string) (*Transaction, error) {
	return service.Create(userID, name, -price, date, tags)
}

func (service *TransactionService) CreatePayment(userID int, name string, price float64, date time.Time, tags []string) (*Transaction, error) {
	return service.Create(userID, name, price, date, tags)
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

type TransactionList struct {
	IDs      *[]string  `json:"ids,omitempty"`
	Name     *string    `json:"name,omitempty"`
	PriceGte *float64   `json:"pricegte,omitempty"`
	PriceLte *float64   `json:"pricelte,omitempty"`
	Tags     *[]string  `json:"tags,omitempty"`
	DateGte  *time.Time `json:"dategte,omitempty"`
	DateLte  *time.Time `json:"datelte,omitempty"`
}

func (service *TransactionService) List(userID int, filters TransactionList) (*[]Transaction, error) {
	selectStatement := service.DB.From("transactions").Select("*").Where(goqu.Ex{
		"user_id": userID,
	})
	if filters.IDs != nil {
		selectStatement = selectStatement.Where(goqu.Ex{"id": filters.IDs})
	}
	if filters.Name != nil {
		selectStatement = selectStatement.Where(goqu.Ex{
			"name": goqu.Op{
				"like": "%" + *filters.Name + "%",
			},
		})
	}
	if filters.PriceLte != nil {
		selectStatement = selectStatement.Where(goqu.Ex{
			"price": goqu.Op{"lte": filters.PriceLte},
		})
	}
	if filters.PriceGte != nil {
		selectStatement = selectStatement.Where(goqu.Ex{
			"price": goqu.Op{"gte": filters.PriceGte},
		})
	}
	if filters.Tags != nil {
		selectStatement = selectStatement.Where(goqu.L("EXISTS (SELECT 1 FROM json_each(tags) WHERE value IN ?)", filters.Tags))
	}
	if filters.DateGte != nil {
		selectStatement = selectStatement.Where(goqu.Ex{
			"date": goqu.Op{"gte": filters.DateGte},
		})
	}
	if filters.DateLte != nil {
		selectStatement = selectStatement.Where(goqu.Ex{
			"date": goqu.Op{"lte": filters.DateLte},
		})
	}
	transactions := []Transaction{}
	err := selectStatement.ScanStructs(&transactions)
	if err != nil {
		return nil, err
	}
	return &transactions, nil
}

type MonthlyExpenseSummary struct {
	Month   string  `db:"month"`
	Count   int     `db:"count"`
	Total   float64 `db:"sum"`
	Average float64 `db:"avg"`
	Max     float64 `db:"max"`
	Min     float64 `db:"min"`
}

func (service *TransactionService) GetExpensesMonthlyStatisticsForYear(userID int, year int) (*[]MonthlyExpenseSummary, error) {
	selectStatement := service.DB.From("transactions").Select(
		goqu.L("strftime('%m', date)").As("month"),
		goqu.COUNT("*").As("count"),
		goqu.SUM("price").As("sum"),
		goqu.AVG("price").As("avg"),
		goqu.MAX("price").As("max"),
		goqu.MIN("price").As("min"),
	).
		Where(
			goqu.Ex{
				"user_id": userID,
			},
			goqu.L("strftime('%Y', date) = ?", strconv.Itoa(year)),
			goqu.C("price").Lte(0),
		).
		GroupBy(goqu.L("strftime('%m', date)"))
	var summaries []MonthlyExpenseSummary
	if err := selectStatement.ScanStructs(&summaries); err != nil {
		fmt.Printf("err: %v\n", err)
		return nil, err
	}
	return &summaries, nil
}

type YearlyExpenseSummary struct {
	Month   string  `db:"month"`
	Year    string  `db:"year"`
	Count   int     `db:"count"`
	Total   float64 `db:"sum"`
	Average float64 `db:"avg"`
	Max     float64 `db:"max"`
	Min     float64 `db:"min"`
}

func (service *TransactionService) GetExpensesMonthlyStatisticsForYears(userID int, years ...int) (*[]YearlyExpenseSummary, error) {
	yearStrings := make([]string, len(years))

	for _, year := range years {
		yearStrings = append(yearStrings, strconv.Itoa(year))
	}
	selectStatement := service.DB.From("transactions").Select(
		goqu.L("strftime('%m', date)").As("month"),
		goqu.L("strftime('%Y', date)").As("year"),
		goqu.COUNT("*").As("count"),
		goqu.SUM("price").As("sum"),
		goqu.AVG("price").As("avg"),
		goqu.MAX("price").As("max"),
		goqu.MIN("price").As("min"),
	).
		Where(
			goqu.Ex{
				"user_id": userID,
			},
			goqu.L("strftime('%Y', date)").In(yearStrings),
			goqu.C("price").Lte(0),
		).
		GroupBy(goqu.L("strftime('%m', date)")).
		Order(
			goqu.L("strftime('%Y', date)").Desc(),
			goqu.L("strftime('%m', date)").Desc(),
		)

	var summaries []YearlyExpenseSummary
	if err := selectStatement.ScanStructs(&summaries); err != nil {
		fmt.Printf("err: %v\n", err)
		return nil, err
	}
	return &summaries, nil
}
