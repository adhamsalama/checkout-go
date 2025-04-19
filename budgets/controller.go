package budgets

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"checkout-go/auth"
	dto "checkout-go/budgets/dtos"

	"github.com/go-chi/chi/v5"
)

type BudgetsController struct {
	BudgetService BudgetService
	AuthService   auth.UserContextReader
}

func (c *BudgetsController) CreateMonthlyBudget(w http.ResponseWriter, req *http.Request) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		fmt.Printf("could not read body: %s\n", err)
		http.Error(w, fmt.Sprintf("Something went wrong: %v", err), http.StatusInternalServerError)
		return
	}
	var budget dto.CreateMonthlyBudgetDTO
	err = json.Unmarshal(body, &budget)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}

	userID := c.AuthService.GetUserIDFromRequest(req)
	monthlyBudget, err := c.BudgetService.CreateMonthylBudget(userID, budget.Name, budget.Value)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	err = json.NewEncoder(w).Encode(monthlyBudget)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *BudgetsController) GetMonthlyBudget(w http.ResponseWriter, req *http.Request) {
	userID := c.AuthService.GetUserIDFromRequest(req)
	monthlyBudget, err := c.BudgetService.GetMonthylBudget(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(monthlyBudget)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *BudgetsController) UpdateMonthlyBudget(w http.ResponseWriter, req *http.Request) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		fmt.Printf("could not read body: %s\n", err)
		http.Error(w, fmt.Sprintf("Something went wrong: %v", err), http.StatusInternalServerError)
		return
	}
	var budget dto.UpdateMonthlyBudgetDTO
	err = json.Unmarshal(body, &budget)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}

	userID := c.AuthService.GetUserIDFromRequest(req)
	monthlyBudget, err := c.BudgetService.UpdateMonthylBudget(userID, budget.Name, budget.Value)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(monthlyBudget)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *BudgetsController) DeleteMonthlyBudget(w http.ResponseWriter, req *http.Request) {
	userID := c.AuthService.GetUserIDFromRequest(req)
	monthlyBudget, err := c.BudgetService.DeleteMonthlyBudget(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(monthlyBudget)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *BudgetsController) CreateTaggedBudget(w http.ResponseWriter, req *http.Request) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		fmt.Printf("could not read body: %s\n", err)
		http.Error(w, fmt.Sprintf("Something went wrong: %v", err), http.StatusInternalServerError)
		return
	}
	var budget dto.CreateTaggedBudgetDTO
	err = json.Unmarshal(body, &budget)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}

	userID := c.AuthService.GetUserIDFromRequest(req)
	monthlyBudget, err := c.BudgetService.CreateTaggedBudget(userID, budget.Name, budget.Value, budget.Tag)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	err = json.NewEncoder(w).Encode(monthlyBudget)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *BudgetsController) GetTaggedBudgets(w http.ResponseWriter, req *http.Request) {
	userID := c.AuthService.GetUserIDFromRequest(req)
	budgets, err := c.BudgetService.GetTaggedBudgets(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(budgets)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *BudgetsController) DeleteTaggedBudget(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(req, "id"))
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	userID := c.AuthService.GetUserIDFromRequest(req)
	transaction, err := c.BudgetService.DeleteTaggedBudget(userID, int64(id))
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

func (c *BudgetsController) GetTaggedBudgetStats(w http.ResponseWriter, req *http.Request) {
	userID := c.AuthService.GetUserIDFromRequest(req)
	budgetStats, err := c.BudgetService.GetTaggedBudgetsStats(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(budgetStats)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *BudgetsController) UpdateTaggedBudget(w http.ResponseWriter, req *http.Request) {
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
	var budget dto.UpdateTaggedBudgetDTO
	err = json.Unmarshal(body, &budget)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid body: %v", err), http.StatusBadRequest)
		return
	}
	userID := c.AuthService.GetUserIDFromRequest(req)
	updatedBudget, err := c.BudgetService.UpdateTaggedBudget(userID, int64(id), budget.Name, budget.Value, budget.Tag)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(updatedBudget)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}
