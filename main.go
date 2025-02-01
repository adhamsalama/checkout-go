package main

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"path/filepath"

	"checkout-go/transactions"

	goqu "github.com/doug-martin/goqu/v9"
	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

//go:embed frontend/*
var content embed.FS

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

	// migration.MigrateExpensesFromMongoToSql(&transactionsService)
	// createdTransaction, err := transactionsService.CreateExpense(1, "asd", 120, time.Now(), []string{"hello", "world"})
	// if err != nil {
	// 	fmt.Printf("create err: %v\n", err)
	// 	return
	// }
	// fmt.Printf("createdTransaction: %v\n", createdTransaction)
	// price := -420.0
	// updateData := transactions.TransactionUpdate{
	// 	Price: &price,
	// }
	// res, err := transactionsService.Update(createdTransaction.ID, createdTransaction.UserID, updateData)
	// if err != nil {
	// 	fmt.Printf("update err: %v\n", err)
	// 	return
	// }
	// fmt.Printf("updated res: %v\n", res)
	// priceGte := 420.0
	// list, err := transactionsService.List(1, transactions.TransactionList{
	// 	PriceGte: &priceGte,
	// })
	// if err != nil {
	// 	fmt.Printf("list err: %v\n", err)
	// 	return
	// }
	// fmt.Printf("list: %v\n", list)
	stats, err := transactionsService.GetExpensesMonthlyStatisticsForYear(1, 2025)
	if err != nil {
		fmt.Printf("query err: %v\n", err)
		return
	}
	fmt.Printf("stats: %v\n", stats)
	yearlystats, err := transactionsService.GetExpensesMonthlyStatisticsForYears(1, 2024, 2025)
	if err != nil {
		fmt.Printf("query err: %v\n", err)
		return
	}
	fmt.Printf("stats: %v\n", yearlystats)
	dailyStats, err := transactionsService.GetExpensesDailyStatisticsForMonthInYear(1, 1, 2025)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	fmt.Printf("dailyStats: %v\n", dailyStats)
	transactionController := transactions.TransactionController{
		TransactionsService: transactionsService,
	}

	go func() {
		fs := http.FileServer(http.Dir("./frontend")) // Or "./dist" for Vite
		http.Handle("/assets/", fs)

		// Fallback handler for non-static routes, serving index.html
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// Serve index.html for any route that is not a static file
			if filepath.Ext(r.URL.Path) == "" {
				http.ServeFile(w, r, "./frontend/index.html") // Or "./dist/index.html" for Vite
				return
			}
			// Default behavior for other static file requests
			fs.ServeHTTP(w, r)
		})

		port := "8081"
		log.Println("Starting server on http://localhost:" + port)

		// Start the HTTP server in a goroutine so it doesn't block
		err := http.ListenAndServe(":"+port, nil)
		if err != nil {
			log.Fatal(err)
		}
	}()
	r := chi.NewRouter()

	// A good base middleware stack
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Post("/expenses", transactionController.CreateExpense)
	r.Get("/expenses/statistics/yearly/{year}", transactionController.GetExpensesMonthlyStatisticsForAYear)
	r.Get("/expenses/statistics/{year}/{month}", transactionController.GetExpensesDailyStatisticsForMonthInYear)
	r.Get("/transactions/{id}", transactionController.GetTransactionByID)
	r.Get("/expenses/statistics", transactionController.GetTagsStatistics)
	r.Get("/expenses", transactionController.ListExpenses)
	r.Get("/balance", transactionController.GetBalance)
	r.Post("/payments", transactionController.CreatePayment)
	// Start the server
	http.ListenAndServe(":8080", r)
}
