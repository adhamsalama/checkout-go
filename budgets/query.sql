-- name: GetMonthlyBudget :one
SELECT * FROM monthly_budgets
WHERE user_id = ? LIMIT 1;


-- name: CreateMonthlyBudget :one
INSERT INTO monthly_budgets (
  user_id, name, value, date
) VALUES (
  ?, ?, ?, ?
)
RETURNING *;



-- name: UpdateMonthlyBudget :exec
UPDATE monthly_budgets
SET name = ?, value = ?
WHERE user_id = ?
RETURNING *;


-- name: DeleteMonthlyBudget :exec
DELETE FROM monthly_budgets WHERE user_id = ?;
