package migration

import (
	"context"
	"fmt"

	"checkout-go/customtypes"
	Transactions "checkout-go/transactions"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoTransaction struct {
	ID int `db:"id" goqu:"skipinsert" json:"id"`
	// UserID int                     `db:"user_id" goqu:"omitnil" json:"userId" bson:"userId"` // Comment when running Mongo to SQL migration
	Name   string                  `db:"name" goqu:"omitnil" json:"name"`
	Price  float64                 `db:"price" goqu:"omitnil" json:"price"`
	Seller string                  `db:"seller" goqu:"omitnil" json:"sellerName" bson:"sellerName"`
	Note   string                  `db:"note" goqu:"omitnil" json:"comment" bson:"comment"`
	Date   customtypes.TimeWrapper `db:"date" goqu:"omitnil" json:"date"`
	Tags   customtypes.StringSlice `db:"tags" json:"tags" goqu:"omitnil"`
}

func GetMongoExpenses() []MongoTransaction {
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
	var results []MongoTransaction
	cursor, err := coll.Find(context.TODO(), bson.D{})
	if err == mongo.ErrNoDocuments {
		fmt.Printf("No document was found ")
		return []MongoTransaction{}
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
