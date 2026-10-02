import { useEffect, useState } from "react";
import { Expense as ExpenseType } from "../types";
import { Expense } from "./Expense";
import { Button, Col, Modal, Row, Alert } from "react-bootstrap";
import AddProduct from "./AddExpense";
import { useAsync } from "../api";
import { getBalance, getCurrentMonthExpensesSum, listExpenses } from "../api/transactions";
import { getMonthlyBudget } from "../api/budgets";

export function ListExpenses() {
  function deleteExpense(id: number) {
    setExpenses(expenses?.filter((expense) => expense.id !== id));
    refreshTotals();
  }

  const { data: balance, reload: reloadBalance } = useAsync(getBalance);
  const { data: budget } = useAsync(getMonthlyBudget);
  const { data: currentMonthSum, reload: reloadMonthSum } = useAsync(() =>
    getCurrentMonthExpensesSum()
  );
  const refreshTotals = () => {
    reloadBalance();
    reloadMonthSum();
  };

  const [expenses, setExpenses] = useState<ExpenseType[]>();
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [remainingBudget, setRemainingBudget] = useState<number | null>(null);
  const [alertVariant, setAlertVariant] = useState("success");
  const OFFSET_STEP = 20;

  useEffect(() => {
    if (!hasMore) return;
    const handleScroll = () => {
      const bottom =
        Math.ceil(window.innerHeight + window.scrollY) >=
        document.documentElement.scrollHeight;
      if (bottom) setOffset((o) => o + OFFSET_STEP);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore]);

  useEffect(() => {
    listExpenses({ offset, limit: OFFSET_STEP }).then((data) => {
      if (data.length < OFFSET_STEP) setHasMore(false);
      setExpenses((prev) => {
        const seen = new Set((prev ?? []).map((e) => e.id));
        return [...(prev ?? []), ...data.filter((e) => !seen.has(e.id))];
      });
    });
  }, [offset]);

  useEffect(() => {
    if (budget && currentMonthSum !== null) {
      const spent = -(currentMonthSum ?? 0);
      const remaining = budget.value - spent;
      setRemainingBudget(remaining);

      const budgetPercentage = (remaining / budget.value) * 100;
      if (budgetPercentage >= 75) setAlertVariant("success");
      else if (budgetPercentage >= 50) setAlertVariant("primary");
      else if (budgetPercentage >= 25) setAlertVariant("warning");
      else setAlertVariant("danger");

      if (spent > budget.value) {
        setWarning("Warning: Your current expenses exceed your monthly budget!");
      } else {
        setWarning(null);
      }
    }
  }, [budget, currentMonthSum]);

  const [showEditModal, setShowEditModal] = useState(false);
  return (
    <>
      <h1>Balance: ${(balance ?? 0).toFixed(2)}</h1>
      {budget && currentMonthSum !== null && (
        <>
          <h2>Spent This Month: ${(-currentMonthSum).toFixed(2)}</h2>
          <h2>Monthly Budget: ${budget.value.toFixed(2)}</h2>
        </>
      )}
      {remainingBudget !== null && (
        <Alert variant={alertVariant}>Remaining Budget: ${remainingBudget.toFixed(2)}</Alert>
      )}
      {warning && <Alert variant="danger">{warning}</Alert>}
      <Button
        variant="primary"
        onClick={() => setShowEditModal(true)}
        style={{ margin: "10px" }}
      >
        Add Expense
      </Button>
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Expense</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AddProduct
            func={(expense: ExpenseType) => {
              setExpenses(expenses ? [expense, ...expenses] : [expense]);
              setShowEditModal(false);
              refreshTotals();
            }}
          />
        </Modal.Body>
      </Modal>
      {expenses ? (
        <Row xs={1} md={2} lg={4} className="g-4">
          {expenses.map((expense) => {
            return (
              <Col key={expense.id}>
                <Expense
                  key={expense.id}
                  {...expense}
                  deleteExpense={deleteExpense}
                />
              </Col>
            );
          })}
        </Row>
      ) : (
        <h1>No expenses</h1>
      )}
    </>
  );
}

