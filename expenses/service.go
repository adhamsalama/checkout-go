package expensesservice

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Expense struct {
	ID     int
	UserID string
	Name   string
	Price  float64
	Date   time.Time
	Tags   []string `json:"tags"`
}

type ExpensesService struct {
	db *sql.DB
}

func NewExpensesService(db *sql.DB) *ExpensesService {
	return &ExpensesService{db: db}
}

func (s *ExpensesService) CreateExpense(userID, name string, price float64, tags []string, date time.Time) (*Expense, error) {
	stmt, err := s.db.Prepare("INSERT INTO expense (user_id, name, price, tags, date) VALUES(?, ?, ?, ?, ?)")
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	res, err := stmt.Exec(userID, name, price, "["+strings.Join(tags, ",")+"]", date.Format(time.RFC3339))
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return &Expense{ID: int(id), UserID: userID, Name: name, Price: price, Tags: tags, Date: time.Now()}, nil
}

// func (s *ExpensesService) GetExpenses(userID string, priceGte, priceLte *float64, tags []string, name string, limit, offset int, startDate, endDate string) ([]Expense, error) {
type GetExpensesFilter struct {
	UserID    string
	PriceGte  *float64
	PriceLte  *float64
	Tags      []string
	Name      *string
	Limit     int
	Offset    int
	StartDate *string
	EndDate   *string
}

func (s *ExpensesService) GetExpenses(filter GetExpensesFilter) ([]Expense, error) {
	var queryParts []string
	var args []interface{}
	queryParts = append(queryParts, "SELECT id, user_id, name, price, tags, date FROM expense WHERE user_id = ?")
	args = append(args, filter.UserID)

	if filter.Name != nil {
		queryParts = append(queryParts, "AND name LIKE ?")
		args = append(args, "%"+*filter.Name+"%")
	}

	if filter.PriceGte != nil {
		queryParts = append(queryParts, "AND price >= ?")
		args = append(args, *filter.PriceGte)
	}
	if filter.PriceLte != nil {
		queryParts = append(queryParts, "AND price <= ?")
		args = append(args, *filter.PriceLte)
	}

	if len(filter.Tags) > 0 {
		queryParts = append(queryParts, "AND tags IN (?)")
		args = append(args, strings.Join(filter.Tags, ","))
	}

	if filter.StartDate != nil {
		queryParts = append(queryParts, "AND date >= ?")
		args = append(args, filter.StartDate)
	}
	if filter.EndDate != nil {
		queryParts = append(queryParts, "AND date <= ?")
		args = append(args, filter.EndDate)
	}

	queryParts = append(queryParts, "LIMIT ? OFFSET ?")
	args = append(args, filter.Limit, filter.Offset)

	query := strings.Join(queryParts, " ")
	fmt.Println(query)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var expenses []Expense
	for rows.Next() {
		var expense Expense
		if err := rows.Scan(&expense.ID, &expense.UserID, &expense.Name, &expense.Price, &expense.Tags, &expense.Date); err != nil {
			return nil, err
		}
		expenses = append(expenses, expense)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return expenses, nil
}

func (s *ExpensesService) UpdateExpense(id int, userID, name string, price float64, tags []string) (*Expense, error) {
	stmt, err := s.db.Prepare("UPDATE expense SET name = ?, price = ?, tags = ? WHERE id = ? AND user_id = ?")
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	_, err = stmt.Exec(name, price, tags, id, userID)
	if err != nil {
		return nil, err
	}

	return &Expense{ID: id, UserID: userID, Name: name, Price: price, Tags: tags, Date: time.Now()}, nil
}

func (s *ExpensesService) DeleteExpense(id int, userID string) error {
	stmt, err := s.db.Prepare("DELETE FROM expense WHERE id = ? AND user_id = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.Exec(id, userID)
	return err
}

type ExpenseStatistics struct {
	Tag        string    `json:"tag"`
	Count      int       `json:"count"`
	TotalPrice float64   `json:"totalPrice"`
	MaxPrice   float64   `json:"maxPrice"`
	MinPrice   float64   `json:"minPrice"`
	AvgPrice   float64   `json:"avgPrice"`
	MaxItems   []Expense `json:"maxItems"`
}

func (s *ExpensesService) GetStatistics(userID string) ([]ExpenseStatistics, error) {
	// Query to calculate the statistics based on tags stored as JSON array
	query := `
		SELECT
			tag,
			COUNT(*) as count,
			SUM(price) as totalPrice,
			MAX(price) as maxPrice,
			MIN(price) as minPrice,
			AVG(price) as avgPrice
		FROM (
			SELECT
				EXPENSES.id,
				EXPENSES.user_id,
				EXPENSES.name,
				EXPENSES.price,
				EXPENSES.date,
				json_extract(expenses.tags, '$') as tag
			FROM expense
			WHERE user_id = ?
		)
		GROUP BY tag
		ORDER BY totalPrice DESC, count DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []ExpenseStatistics
	for rows.Next() {
		var stat ExpenseStatistics
		err := rows.Scan(
			&stat.Tag,
			&stat.Count,
			&stat.TotalPrice,
			&stat.MaxPrice,
			&stat.MinPrice,
			&stat.AvgPrice,
		)
		if err != nil {
			return nil, err
		}

		// Fetching items with max price per tag
		maxItemsQuery := `
			SELECT id, user_id, name, price, tags, date
			FROM expense
			WHERE user_id = ? AND json_extract(tags, '$') = ? AND price = ?
		`

		maxItemsRows, err := s.db.Query(maxItemsQuery, userID, stat.Tag, stat.MaxPrice)
		if err != nil {
			return nil, err
		}
		defer maxItemsRows.Close()

		var maxItems []Expense
		for maxItemsRows.Next() {
			var item Expense
			err := maxItemsRows.Scan(&item.ID, &item.UserID, &item.Name, &item.Price, &item.Tags, &item.Date)
			if err != nil {
				return nil, err
			}
			maxItems = append(maxItems, item)
		}
		stat.MaxItems = maxItems

		stats = append(stats, stat)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return stats, nil
}

func (s *ExpensesService) GetMonthlyStatisticsForAYear(userID string, year int) (map[int]float64, error) {
	yearStart := fmt.Sprintf("%v-01-01", year)
	yearEnd := fmt.Sprintf("%v-21-31", year)
	summaryMap := make(map[int]float64)
	for i := 1; i <= 12; i++ {
		summaryMap[i] = 0
	}

	rows, err := s.db.Query(`
	SELECT
	  strftime('%m', date) AS month,
		SUM(price)
	FROM expense
	WHERE
	  user_id = ?
		AND date >= ? AND date <= ?
	GROUP BY month
	`, userID, yearStart, yearEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var month int
		var total float64
		if err := rows.Scan(&month, &total); err != nil {
			log.Fatalf("Failed to scan row: %v", err)
		}
		summaryMap[month] = total
	}

	if err := rows.Err(); err != nil {
		log.Fatalf("Row iteration error: %v", err)
	}
	return summaryMap, nil
}

func (s *ExpensesService) GetMonthlyStatistics(userID string, year, month int) ([]Expense, error) {
	rows, err := s.db.Query(`
		SELECT
		 strftime('%d', date) AS day,
		FROM 
			expense
		WHERE 
			user_id = ?
			AND strftime('%Y', date) = ?
			AND strftime('%m', date) = ?`, userID, fmt.Sprintf("%d", year), fmt.Sprintf("%02d", month))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []Expense
	for rows.Next() {
		var expense Expense
		if err := rows.Scan(&expense.ID, &expense.UserID, &expense.Name, &expense.Price, &expense.Tags, &expense.Date); err != nil {
			return nil, err
		}
		expenses = append(expenses, expense)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return expenses, nil
}
