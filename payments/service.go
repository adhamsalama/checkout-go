package paymentsservice

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type PaymentsService struct {
	db *sqlx.DB
}

type Payment struct {
	ID         int
	Value      float64
	Date       time.Time
	SellerName string
	UserID     int
}

func (s *PaymentsService) createExpense(value float64, sellerName string, userID int, date time.Time) (*Payment, error) {
	res, err := s.db.Exec(`
    INSERT INTO payment (value, date, seller_name, user_id) VALUES (?, ?, ?, ?);
    `, value, date, sellerName, userID)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	payment := Payment{ID: int(id), Value: value, Date: date, SellerName: sellerName, UserID: userID}
	return &payment, nil
}

func (s *PaymentsService) updateExpense(value float64, sellerName string, userID int, date time.Time) (*Payment, error) {
	res, err := s.db.Exec(`
    INSERT INTO payment (value, date, seller_name, user_id) VALUES (?, ?, ?, ?);
    `, value, date, sellerName, userID)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	payment := Payment{ID: int(id), Value: value, Date: date, SellerName: sellerName, UserID: userID}
	return &payment, nil
}
