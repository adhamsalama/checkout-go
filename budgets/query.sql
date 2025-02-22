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

-- name: GetTaggedBudgetStats :many
SELECT 
    b.id, 
    b.name, 
    b.value,
    b.interval_in_days,
    SUM(t.price) AS total_price
FROM tagged_budgets b
JOIN transactions t ON EXISTS (
    SELECT 1
    FROM json_each(t.tags)
    WHERE json_each.value = b.tag
)
WHERE 
    b.user_id = ?
    AND t.price < 0
    AND t.date >= DATE('now', '-' || b.interval_in_days || ' days')
GROUP BY b.id, b.name, b.value;
