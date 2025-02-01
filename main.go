package main

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"path/filepath"

	// migration "checkout-go/migrations"
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
	transactionController := transactions.TransactionController{
		TransactionsService: transactionsService,
	}

	go func() {
		http.Handle("/assets/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			filePath := "frontend" + r.URL.Path
			data, err := content.ReadFile(filePath)
			if err != nil {
				http.NotFound(w, r)
				return
			}

			switch ext := filepath.Ext(r.URL.Path); ext {
			case ".js":
				w.Header().Set("Content-Type", "application/javascript")
			case ".css":
				w.Header().Set("Content-Type", "text/css")
			case ".html":
				w.Header().Set("Content-Type", "text/html")
			default:
				w.Header().Set("Content-Type", "application/octet-stream")
			}

			w.Write(data)
		}))

		// Fallback handler for non-static routes, serving index.html
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// Serve index.html for any route that is not a static file (e.g., React routes)
			if filepath.Ext(r.URL.Path) == "" {
				// Read the embedded index.html file
				data, err := content.ReadFile("frontend/index.html")
				if err != nil {
					http.NotFound(w, r)
					return
				}
				// Set the appropriate Content-Type and write the file
				w.Header().Set("Content-Type", "text/html")
				w.Write(data)
				return
			}

			// Default behavior for other static file requests
			http.ServeFile(w, r, "frontend"+r.URL.Path)
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
	// r.Use(middleware.RequestID)
	// r.Use(middleware.RealIP)
	// r.Use(middleware.Logger)
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
