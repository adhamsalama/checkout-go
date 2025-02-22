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



-- name: CreateTaggedBudget :one
INSERT INTO tagged_budgets (
  user_id, name, value, interval_in_days, tag, date
) VALUES (
  ?, ?, ?, ?, ?, ?
)
RETURNING *;

-- name: GetTaggedBudgets :many
SELECT * FROM tagged_budgets
WHERE user_id = ?;

-- name: GetTaggedBudget :one
SELECT * FROM tagged_budgets
WHERE user_id = ? AND id = ?;


-- name: DeleteTaggedBudget :exec
DELETE FROM tagged_budgets WHERE user_id = ? AND id = ?;


