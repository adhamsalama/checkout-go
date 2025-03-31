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
  user_id, name, value, tag, date
) VALUES (
  ?, ?, ?, ?, ?
)
RETURNING *;

-- name: GetTaggedBudgets :many
SELECT * FROM tagged_budgets
WHERE user_id = ?;

-- name: GetTaggedBudget :one
SELECT * FROM tagged_budgets
WHERE user_id = ? AND id = ?;



-- name: UpdateTaggedBudget :exec
UPDATE tagged_budgets
SET name = ?, value = ?, tag = ?
WHERE user_id = ? and id = ?
RETURNING *;


-- name: DeleteTaggedBudget :exec
DELETE FROM tagged_budgets WHERE user_id = ? AND id = ?;

-- name: GetTaggedBudgetStats :many
SELECT 
    b.id, 
    b.name, 
    b.value,
    b.tag,
    SUM(COALESCE(t.price, 0)) AS total_price
FROM tagged_budgets b
LEFT JOIN transactions t
    ON EXISTS (
        SELECT 1
        FROM json_each(t.tags)
        WHERE json_each.value = b.tag
    )
    AND t.user_id = ?
    AND t.price < 0
    AND t.date >= DATE('now', '-' || 
                         (SELECT strftime('%d', date('now', 'start of month', '+1 month', '-1 day')))
                        || ' days')
WHERE b.user_id = ?
GROUP BY b.id, b.name, b.value;
