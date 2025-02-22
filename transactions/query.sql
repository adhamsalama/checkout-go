-- name: GetSumOfExpensesOfAMonth :one
SELECT SUM(price)
FROM transactions
WHERE user_id = ? AND price < 0 AND CAST(strftime('%Y', date) AS  INT) = ? AND CAST(strftime('%m', date) AS INT) = ?;
