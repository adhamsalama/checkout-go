package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"

	ExpenseService "checkout-go/expenses"
)

func main() {
	// Initialize SQLite database
	db, err := sql.Open("sqlite3", "./sqlite3.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	// Create table if not exists
	_, err = db.Exec(`
	DROP TABLE IF EXISTS expenses;
	CREATE TABLE IF NOT EXISTS expenses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT,
		name TEXT,
		price REAL,
		tags JSONB,
		date DATETIME
	);
	`)
	if err != nil {
		log.Fatal(err)
	}

	// Create ExpensesService instance
	expenseService := ExpenseService.NewExpensesService(db)

	// Example usage
	_, err = expenseService.CreateExpense("user123", "Lunch", 12.50, []string{"food", "whatever"})
	if err != nil {
		log.Fatal(err)
	}
	priceGte := 12.0
	expenses, err := expenseService.GetExpenses(ExpenseService.GetExpensesFilter{
		UserID:   "user123",
		PriceGte: &priceGte,
		PriceLte: nil,
		Limit:    10,
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(expenses))
	for _, exp := range expenses {
		fmt.Println(exp)
	}
	stats, err := expenseService.GetStatistics("user123")
	if err != nil {
		log.Fatal(err)
	}
	for tag, price := range stats {
		fmt.Println(tag, price)
	}
}
