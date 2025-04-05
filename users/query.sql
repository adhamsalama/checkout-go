-- name: Createuser :one
INSERT INTO users (
  username, password, date
) VALUES (
  ?, ?, ?
)
RETURNING *;

-- name: GetUserPassword :one
SELECT password FROM users
WHERE username = ?;


-- name: GetUser :one
SELECT id, username, password FROM users
WHERE username = ?
