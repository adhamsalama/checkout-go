package budgets

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	dto "checkout-go/budgets/dtos"
)

type BudgetsController struct {
	BudgetService BudgetService
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

	monthlyBudget, err := c.BudgetService.CreateMonthylBudget(1, budget.Name, budget.Value)
	if err != nil {
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
	monthlyBudget, err := c.BudgetService.GetMonthylBudget(1)
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

	monthlyBudget, err := c.BudgetService.UpdateMonthylBudget(1, budget.Name, budget.Value)
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
	monthlyBudget, err := c.BudgetService.DeleteMonthlyBudget(1)
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
