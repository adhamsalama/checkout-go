package transactions

import "time"

type Transaction struct {
	ID     int       `db:"id" goqu:"skipinsert"`
	UserID int       `db:"user_id" goqu:"omitnil"`
	Name   string    `db:"name" goqu:"omitnil"`
	Price  float64   `db:"price" goqu:"omitnil"`
	Date   time.Time `db:"date" goqu:"omitnil"`
	Tags   []string  `db:"tags" json:"tags" goqu:"omitnil"`
}
