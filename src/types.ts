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
