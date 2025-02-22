// Code generated by sqlc. DO NOT EDIT.
// versions:
//   sqlc v1.27.0

package budgets

import (
	"database/sql"
)

type MonthlyBudget struct {
	ID     int64   `json:"id"`
	UserID int64   `json:"userId"`
	Name   string  `json:"name"`
	Value  float64 `json:"value"`
	Date   string  `json:"date"`
}

type TaggedBudget struct {
	ID             int64   `json:"id"`
	UserID         int64   `json:"userId"`
	Name           string  `json:"name"`
	Value          float64 `json:"value"`
	IntervalInDays int64   `json:"intervalInDays"`
	Tag            string  `json:"tag"`
	Date           string  `json:"date"`
}

type Transaction struct {
	ID     int64          `json:"id"`
	UserID int64          `json:"userId"`
	Name   string         `json:"name"`
	Price  float64        `json:"price"`
	Date   string         `json:"date"`
	Tags   interface{}    `json:"tags"`
	Seller sql.NullString `json:"seller"`
	Note   sql.NullString `json:"note"`
}
