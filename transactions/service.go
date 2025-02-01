package transactions

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"time"

	"checkout-go/customtypes"

	goqu "github.com/doug-martin/goqu/v9"
)

type TransactionService struct {
	DB *goqu.Database
}

func (service *TransactionService) Create(userID int, name string, price float64, seller string, note string, date time.Time, tags []string) (*Transaction, error) {
	transactions := service.DB.From("transactions")
	result, err := transactions.Insert().Rows(
		goqu.Record{
			"user_id": userID,
			"name":    name,
			"price":   price,
			"date":    date,
			"seller":  seller,
			"note":    note,
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
	transaction := Transaction{
		ID:     int(insertID),
		UserID: userID,
		Name:   name,
		Price:  price,
		Seller: seller,
		Note:   note,
		Date:   customtypes.TimeWrapper(date),
		Tags:   customtypes.StringSlice(tags),
	}
	return &transaction, nil
}

func (service *TransactionService) CreateExpense(userID int, name string, price float64, seller string, note string, date time.Time, tags []string) (*Transaction, error) {
	return service.Create(userID, name, -price, seller, note, date, tags)
}

func (service *TransactionService) CreatePayment(userID int, name string, price float64, seller string, note string, date time.Time, tags []string) (*Transaction, error) {
	if price < 1 {
		return nil, fmt.Errorf("payment price cannot be less than 1")
	}
	return service.Create(userID, name, price, seller, note, date, tags)
}

type TransactionUpdate struct {
	Name  *string    `json:"name,omitempty"`
	Price *float64   `json:"price,omitempty"`
	Tags  *[]string  `json:"tags,omitempty"`
	Date  *time.Time `json:"date,omitempty"`
}

func (service *TransactionService) Update(ID int, userID int, updateData TransactionUpdate) (*Transaction, error) {
	fields := map[string]any{}

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
	IDs      *[]int     `json:"ids,omitempty"`
	Name     *string    `json:"name,omitempty"`
	PriceGte *float64   `json:"pricegte,omitempty"`
	PriceLte *float64   `json:"pricelte,omitempty"`
	Tags     *[]string  `json:"tags,omitempty"`
	DateGte  *time.Time `json:"dategte,omitempty"`
	DateLte  *time.Time `json:"datelte,omitempty"`
	Limit    *int       `json:"limit"`
	Offset   *int       `json:"offset"`
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
	if filters.Limit != nil {
		fmt.Printf("filters.Limit: %v\n", *filters.Limit)
		selectStatement = selectStatement.Limit(uint(*filters.Limit))
	}
	if filters.Offset != nil {
		fmt.Printf("filters.Offset: %v\n", *filters.Offset)
		selectStatement = selectStatement.Offset(uint(*filters.Offset))
	}
	selectStatement = selectStatement.Order(goqu.L("date").Desc())
	sql, _, _ := selectStatement.ToSQL()
	fmt.Printf("selectStatement: %v\n", sql)
	transactions := []Transaction{}
	err := selectStatement.ScanStructs(&transactions)
	if err != nil {
		return nil, err
	}
	return &transactions, nil
}

type MonthlyExpenseSummary struct {
	Month   int     `db:"month" json:"month"`
	Count   int     `db:"count" json:"count"`
	Sum     float64 `db:"sum" json:"sum"`
	Average float64 `db:"avg" json:"avg"`
	Max     float64 `db:"max" json:"max" `
	Min     float64 `db:"min" json:"min"`
}

func (service *TransactionService) GetExpensesMonthlyStatisticsForYear(userID int, year int) (*[]MonthlyExpenseSummary, error) {
	selectStatement := service.DB.From("transactions").Select(
		goqu.L("CAST(strftime('%m', date) AS INTEGER)").As("month"),
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
			goqu.L("CAST(strftime('%Y', date) AS INTEGER) = ?", year),
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

type DailyExpenseSummary struct {
	Day     int     `db:"day" json:"day"`
	Count   int     `db:"count" json:"count"`
	Sum     float64 `db:"sum" json:"sum"`
	Average float64 `db:"avg" json:"avg"`
	Max     float64 `db:"max" json:"max"`
	Min     float64 `db:"min" json:"min"`
}

func (service *TransactionService) GetExpensesDailyStatisticsForMonthInYear(userID int, month int, year int) (*[]DailyExpenseSummary, error) {
	if month > 12 {
		return nil, fmt.Errorf("invalid month")
	}
	selectStatement := service.DB.From("transactions").Select(
		goqu.L("CAST(strftime('%d', date) AS INT)").As("day"),
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
			goqu.L("CAST(strftime('%m', date) AS INT) = ?", month),
			goqu.C("price").Lte(0),
		).
		GroupBy("day").
		Order(goqu.I("day").Asc())
	var summaries []DailyExpenseSummary
	if err := selectStatement.ScanStructs(&summaries); err != nil {
		fmt.Printf("err: %v\n", err)
		return nil, err
	}
	daysInMonth := daysInMonth(month, year)
	fmt.Printf("daysInMonth: %v\n", daysInMonth)
	if len(summaries) == daysInMonth {
		return &summaries, nil
	}
	daysMap := make(map[int]DailyExpenseSummary, daysInMonth)
	for _, expense := range summaries {
		daysMap[expense.Day+1] = expense
	}
	for i := range daysInMonth {
		dayIndex := i + 1
		_, ok := daysMap[dayIndex]
		if !ok {
			daysMap[dayIndex] = DailyExpenseSummary{Day: dayIndex}
			fmt.Printf("day not eixts %v\n", dayIndex)
		}
	}
	var fullDaySummaries []DailyExpenseSummary
	for _, expense := range daysMap {
		fullDaySummaries = append(fullDaySummaries, expense)
	}

	sort.Slice(fullDaySummaries, func(i, j int) bool {
		return fullDaySummaries[i].Day < fullDaySummaries[j].Day
	})
	for _, des := range fullDaySummaries {
		fmt.Printf("i: %v, v: %v\n", des.Day, des)
	}
	return &fullDaySummaries, nil
}

type TransactionTagsAggregationResult struct {
	Count int     `json:"count"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Avg   float64 `json:"avg"`
	Sum   float64 `json:"sum"`
	Tag   string  `json:"tag"`
}

func (service *TransactionService) GetTagsStatistics(userID int) (*[]TransactionTagsAggregationResult, error) {
	selectStatement := service.DB.From("transactions").
		Join(goqu.L("json_each(tags)").As("tag"), goqu.On(goqu.L("1 = 1"))).
		Where(
			goqu.C("price").Lte(0),
			goqu.C("user_id").Eq(userID),
		).
		Select(
			goqu.COUNT("*").As("count"),
			goqu.MAX("price").As("min"),
			goqu.MIN("price").As("max"),
			goqu.AVG("price").As("avg"),
			goqu.SUM("price").As("sum"),
			goqu.L("tag.value").As("tag"),
		).
		GroupBy(goqu.L("tag")).
		Order(goqu.L("sum").Asc(), goqu.L("count").Desc())
	var result []TransactionTagsAggregationResult
	if err := selectStatement.ScanStructs(&result); err != nil {
		fmt.Printf("err: %v\n", err)
		return nil, err
	}
	return &result, nil
}

func (service *TransactionService) GetBalance(userID int) (float64, error) {
	selectStatement := service.DB.From("transactions").
		Select(goqu.SUM("price").As("sum"))
	var balance float64
	_, err := selectStatement.ScanVal(&balance)
	if err != nil {
		return 0, err
	}
	return balance, nil
}

// Returns the number of days in a month for a given year.
func daysInMonth(m int, year int) int {
	return time.Date(year, time.Month(m+1), 0, 0, 0, 0, 0, time.UTC).Day()
}
