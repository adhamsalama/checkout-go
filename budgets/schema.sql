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
    tag TEXT NOT NULL,
    date TEXT NOT NULL
)


CREATE TABLE transactions (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "date" TEXT NOT NULL,
    "tags" JSONB,
    "seller" TEXT,
    "note" TEXT
);
