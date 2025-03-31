-- name: GetSumOfExpensesOfAMonth :one
SELECT SUM(price)
FROM transactions
WHERE user_id = ? AND price < 0 AND CAST(strftime('%Y', date) AS  INT) = ? AND CAST(strftime('%m', date) AS INT) = ?;

-- name: GetIncomeSpentPercentage :many
WITH stats AS (
SELECT 
    CAST(strftime('%Y-%m', date) AS TEXT) AS month,         
    CAST(COALESCE(SUM(CASE WHEN price > 0 THEN price END), 0) AS REAL) AS total_income,  
    CAST(ABS(COALESCE(SUM(CASE WHEN price <= 0 THEN price END), 0)) AS REAL) AS total_spent,
    CAST(
        CASE 
            WHEN COALESCE(SUM(CASE WHEN price > 0 THEN price END), 0) = 0 
            THEN 0
            ELSE ROUND((ABS(SUM(CASE WHEN price <= 0 THEN price END)) * 100.0) 
                / SUM(CASE WHEN price > 0 THEN price END), 2)
        END 
    AS REAL) AS spent_percentage
FROM transactions
WHERE user_id = ?
GROUP BY month
ORDER BY month DESC
LIMIT 12
)
SELECT * FROM stats ORDER BY month ASC;

