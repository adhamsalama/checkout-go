package transactions

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"checkout-go/customtypes"

	"github.com/go-chi/chi/v5"
)

type TransactionController struct {
	TransactionsService TransactionService
}

func (c *TransactionController) CreateExpense(w http.ResponseWriter, req *http.Request) {
	type CreateExpenseBody struct {
		Name   string                  `json:"name"`
		Price  float64                 `json:"price"`
		Seller string                  `json:"sellerName"`
		Note   string                  `json:"comment"`
		Date   customtypes.TimeWrapper `json:"date"`
		Tags   []string                `json:"tags"`
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

	transaction, err := c.TransactionsService.CreateExpense(1, expense.Name, expense.Price, expense.Seller, expense.Note, time.Time(expense.Date), expense.Tags)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
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

func (c *TransactionController) GetTransactionByID(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(req, "id"))
	if err != nil || id < 1 {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	filters := TransactionList{
		IDs: &[]int{id},
	}
	aggregation, err := c.TransactionsService.List(1, filters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(*aggregation) == 0 {
		http.Error(w, "Invalid ID", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode((*aggregation)[0])
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) GetTagsStatistics(w http.ResponseWriter, req *http.Request) {
	userID := 1
	aggregation, err := c.TransactionsService.GetTagsStatistics(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(*aggregation) == 0 {
		http.Error(w, "Invalid ID", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode((*aggregation))
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) ListExpenses(w http.ResponseWriter, req *http.Request) {
	limitStr := req.URL.Query().Get("limit")
	offsetStr := req.URL.Query().Get("offset")

	var filters TransactionList
	if limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		filters.Limit = &limit
	}
	if offsetStr != "" {
		offset, err := strconv.Atoi(offsetStr)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		filters.Offset = &offset
	}
	zero := 0.0
	filters.PriceLte = &zero
	list, err := c.TransactionsService.List(1, filters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode((*list))
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) GetBalance(w http.ResponseWriter, req *http.Request) {
	balance, err := c.TransactionsService.GetBalance(1)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err = json.NewEncoder(w).Encode((balance))
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) CreatePayment(w http.ResponseWriter, req *http.Request) {
	type CreatePaymentBody struct {
		Name   string                  `json:"name"`
		Price  float64                 `json:"value"`
		Seller string                  `json:"sellerName"`
		Note   string                  `json:"comment"`
		Date   customtypes.TimeWrapper `json:"date"`
		Tags   []string                `json:"tags"`
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		fmt.Printf("could not read body: %s\n", err)
		http.Error(w, fmt.Sprintf("Something went wrong: %v", err), http.StatusInternalServerError)
		return
	}
	var payment CreatePaymentBody
	err = json.Unmarshal(body, &payment)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}
	transaction, err := c.TransactionsService.CreatePayment(1, payment.Name, payment.Price, payment.Seller, payment.Note, time.Time(payment.Date), payment.Tags)
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

func (c *TransactionController) UpdateExpense(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(req, "id"))
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		fmt.Printf("could not read body: %s\n", err)
		http.Error(w, fmt.Sprintf("Something went wrong: %v", err), http.StatusInternalServerError)
		return
	}
	var expense TransactionUpdate
	err = json.Unmarshal(body, &expense)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}
	if *expense.Price > 0 {
		http.Error(w, fmt.Sprintf("Expense price cannot be higher than 0: %v", *expense.Price), http.StatusBadRequest)
		return
	}
	userID := 1
	transaction, err := c.TransactionsService.Update(userID, id, expense)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(transaction)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) UpdatePayment(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(req, "id"))
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		fmt.Printf("could not read body: %s\n", err)
		http.Error(w, fmt.Sprintf("Something went wrong: %v", err), http.StatusInternalServerError)
		return
	}
	var payment TransactionUpdate
	err = json.Unmarshal(body, &payment)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}
	if *payment.Price <= 0 {
		http.Error(w, fmt.Sprintf("Payment price cannot be lower than or equal to 0: %v", *payment.Price), http.StatusBadRequest)
		return
	}
	userID := 1
	transaction, err := c.TransactionsService.Update(userID, id, payment)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(transaction)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *TransactionController) DeleteExpense(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(req, "id"))
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	userID := 1
	transaction, err := c.TransactionsService.DeleteTransaction(userID, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(transaction)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}
