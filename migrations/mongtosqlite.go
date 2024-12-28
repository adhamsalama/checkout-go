package migration

import (
	ExpenseService "checkout-go/expenses"
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetMongoExpenses() []ExpenseService.Expense {
	uri := "mongodb://localhost:27017"
	client, err := mongo.Connect(context.TODO(), options.Client().
		ApplyURI(uri))
	if err != nil {
		panic(err)
	}
	defer func() {
		if err := client.Disconnect(context.TODO()); err != nil {
			panic(err)
		}
	}()
	coll := client.Database("nest").Collection("expenses")
	var results []ExpenseService.Expense
	cursor, err := coll.Find(context.TODO(), bson.D{})
	if err == mongo.ErrNoDocuments {
		fmt.Printf("No document was found ")
		return []ExpenseService.Expense{}
	}
	if err != nil {
		panic(err)
	}
	if err = cursor.All(context.TODO(), &results); err != nil {
		panic(err)
	}
	return results
}

func MigrateExpensesFromMongoToSql(expenseService ExpenseService.ExpensesService) {

	mongoExpenses := GetMongoExpenses()
	for _, expense := range mongoExpenses {
		_, err := expenseService.CreateExpense(expense.UserID, expense.Name, expense.Price, expense.Tags, expense.Date)
		if err != nil {
			fmt.Printf("err: %v\n", err)
		}
	}
}
