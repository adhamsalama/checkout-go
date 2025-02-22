CREATE TABLE monthly_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    date TEXT NOT NULL
);


CREATE TABLE tagged_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    interval_in_days INTEGER NOT NULL,
    tag TEXT NOT NULL,
    date TEXT NOT NULL
)
