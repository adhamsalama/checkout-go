/** An expense or a payment. Expenses are stored with a negative price, payments positive. */
export type Expense = {
  id: number;
  name: string;
  price: number;
  quantity?: number;
  tags: string[];
  comment?: string;
  date: string;
  sellerName?: string;
  accountId: number;
};

/** Where money is kept, e.g. "Bank" or "Cash". Exactly one account is the default. */
export type Account = {
  id: number;
  name: string;
  openingBalance: number;
  isDefault: boolean;
  archived: boolean;
  sortOrder: number;
  /** Opening balance plus all of the account's transactions, plus transfers in, minus transfers out. */
  balance: number;
};

/** Money moved between two accounts. Transfers are never edited or deleted; a reversing transfer undoes one. */
export type Transfer = {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  fromName: string;
  toName: string;
  /** Always positive. */
  amount: number;
  date: string;
  note: string;
  /** The transfer this one undoes, if it's a reversal. */
  reversalOf: number | null;
  /** The transfer that undid this one, if any. */
  reversedBy: number | null;
};

export type MonthlyBudget = {
  id: number;
  name: string;
  value: number;
  date: string;
};

export type TaggedBudget = {
  id: number;
  name: string;
  value: number;
  tag: string;
  date: string;
};

export type TaggedBudgetStats = {
  id: number;
  name: string;
  value: number;
  tag: string;
  /** Sum of this month's expenses with the tag (negative or 0). */
  totalPrice: number;
};

export type PeriodStats = {
  count: number;
  sum: number;
  avg: number;
  max: number;
  min: number;
};

export type TagStats = PeriodStats & { tag: string };
