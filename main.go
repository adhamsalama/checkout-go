package main

import (
	"fmt"
	"net/http"
	"time"

	"checkout-go/transactions"

	goqu "github.com/doug-martin/goqu/v9"
	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// Initialize SQLite database
	db, err := sqlx.Open("sqlite3", "./sqlite3.db")
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// defer db.Close()
	// // Create table if not exists
	// _, err = db.Exec(`
	// --DROP TABLE IF EXISTS expense;
	// CREATE TABLE IF NOT EXISTS expense (
	// 	id INTEGER PRIMARY KEY AUTOINCREMENT,
	// 	user_id TEXT,
	// 	name TEXT,
	// 	price REAL,
	// 	tags JSONB,
	// 	date DATETIME
	// );
	// `)
	// if err != nil {
	// 	log.Fatal(err)
	// }
	//
	// // Create ExpensesService instance
	// expenseService := ExpenseService.NewExpensesService(db)

	// Example usage
	/*_, err = expenseService.CreateExpense("user123", "Lunch", 12.50, []string{"food", "whatever"}, time.Now()())
	if err != nil {
		log.Fatal(err)
	}*/
	/*
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
	*/
	// monthlyStats, _ := expenseService.GetMonthlyStatisticsForAYear("640c709394fd39b646316575", 2024)
	// fmt.Println(monthlyStats)
	// migration.MigrateExpensesFromMongoToSql(*expenseService)
	goquDB := goqu.New("sqlite3", db)
	_, err = goquDB.Exec(`
		
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- Auto-incrementing ID
    user_id INTEGER,                      -- User ID
    name TEXT,                            -- Name of the transaction
    price REAL,                           -- Price (floating-point)
    date TEXT,                            -- Date as ISO 8601 string
    tags                              -- Tags as a JSON-encoded array
);
		`)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	transactionsService := transactions.TransactionService{
		DB: goquDB,
	}
	createdTransaction, err := transactionsService.Create(1, "asd", 120, time.Now(), []string{})
	if err != nil {
		fmt.Printf("err: %v\n", err)

		return
	}
	fmt.Printf("createdTransaction: %v\n", createdTransaction)
	price := 420.0
	updateData := Transactions.TransactionUpdate{
		Price: &price,
	}
	res, err := transactionsService.Update(createdTransaction.ID, createdTransaction.UserID, updateData)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	fmt.Printf("res: %v\n", res)
	transactionController := transactions.TransactionController{
		TransactionsService: transactionsService,
	}
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Post("/expense", transactionController.CreateExpense)
	r.Get("/statistics/{year}", transactionController.GetExpensesMonthlyStatisticsForAYear)
	r.Get("/statistics/{year}/{month}", transactionController.GetExpensesDailyStatisticsForMonthInYear)
	r.Get("/transactions/{id}", transactionController.GetTransactionByID)
	r.Get("/statistics", transactionController.GetTagsStatistics)
	// Start the server
	http.ListenAndServe(":8080", r)
}
