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

