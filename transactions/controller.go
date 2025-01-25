package transactions

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

type TransactionController struct {
	TransactionsService TransactionService
}

func (c *TransactionController) CreateExpense(w http.ResponseWriter, req *http.Request) {
	type CreateExpenseBody struct {
		UserID int       `json:"userId"`
		Name   string    `json:"name"`
		Price  float64   `json:"price"`
		Date   time.Time `json:"date"`
		Tags   []string  `json:"tags"`
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		fmt.Printf("could not read body: %s\n", err)
		http.Error(w, fmt.Sprintf("Something went wrong: %v", err), http.StatusInternalServerError)
		return
	}
	var expense CreateExpenseBody
	err = json.Unmarshal(body, &expense)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}
	fmt.Printf("expense: %v\n", expense)
	transaction, err := c.TransactionsService.CreateExpense(expense.UserID, expense.Name, expense.Price, expense.Date, expense.Tags)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	// Encode the struct to JSON and write it to the response
	err = json.NewEncoder(w).Encode(transaction)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) GetExpensesDailyStatisticsForMonthInYear(w http.ResponseWriter, req *http.Request) {
	month, err := strconv.Atoi(chi.URLParam(req, "month"))
	if err != nil || month < 1 || month > 12 {
		http.Error(w, "Invalid Month", http.StatusBadRequest)
		return
	}

	year, err := strconv.Atoi(req.PathValue("year"))

	if err != nil || year < 1 {
		http.Error(w, "Invalid Year", http.StatusBadRequest)
		return
	}
	aggregation, err := c.TransactionsService.GetExpensesDailyStatisticsForMonthInYear(1, month, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(aggregation)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) GetExpensesMonthlyStatisticsForAYear(w http.ResponseWriter, req *http.Request) {
	year, err := strconv.Atoi(chi.URLParam(req, "year"))
	if err != nil || year < 1 {
		http.Error(w, "Invalid Year", http.StatusBadRequest)
		return
	}
	aggregation, err := c.TransactionsService.GetExpensesMonthlyStatisticsForYear(1, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(aggregation)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}
