package migration

import (
	"context"
	"fmt"

	Transactions "checkout-go/transactions"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetMongoExpenses() []Transactions.Transaction {
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
	var results []Transactions.Transaction
	cursor, err := coll.Find(context.TODO(), bson.D{})
	if err == mongo.ErrNoDocuments {
		fmt.Printf("No document was found ")
		return []Transactions.Transaction{}
	}
	if err != nil {
		panic(err)
	}
	if err = cursor.All(context.TODO(), &results); err != nil {
		panic(err)
	}
	return results
}

func MigrateExpensesFromMongoToSql(transactionsService *Transactions.TransactionService) {
	mongoExpenses := GetMongoExpenses()
	fmt.Printf("mongoExpenses: %v\n", len(mongoExpenses))
	for _, expense := range mongoExpenses {
		_, err := transactionsService.CreateExpense(1, expense.Name, expense.Price, expense.Seller, expense.Note, expense.Date.Time(), expense.Tags)
		if err != nil {
			fmt.Printf("err: %v\n", err)
		}
	}
}
