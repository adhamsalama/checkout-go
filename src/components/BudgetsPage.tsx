import React, { useState, useEffect } from "react";
import { Container, Row, Col, Button, Card, Modal, Form } from "react-bootstrap";
import { alertError } from "../api";
import {
  createTaggedBudget,
  deleteMonthlyBudget,
  deleteTaggedBudget,
  getMonthlyBudget,
  getTaggedBudgetStats,
  saveMonthlyBudget,
} from "../api/budgets";
import { TaggedBudgetStats } from "../types";

interface Budget {
  id: number;
  name: string;
  value: number;
}

const BudgetCard: React.FC<{ budget: Budget; onEdit: () => void; onDelete: () => void }> = ({ budget, onEdit, onDelete }) => (
  <Col md={4} className="mb-3">
    <Card>
      <Card.Body>
        <Card.Title>{budget.name}</Card.Title>
        <Card.Text>Value: ${budget.value}</Card.Text>
        <Button variant="warning" onClick={onEdit} className="me-2">
          Edit
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </Card.Body>
    </Card>
  </Col>
);


const BudgetPage: React.FC = () => {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [name, setName] = useState<string>("");
  const [value, setValue] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statsVersion, setStatsVersion] = useState(0);

  useEffect(() => {
    getMonthlyBudget()
      .then((data) => {
        setBudget(data);
        if (data) {
          setName(data.name);
          setValue(data.value);
        }
      })
      .catch((error) => console.error(error));
  }, []);

  const handleSaveBudget = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveMonthlyBudget({ name, value })
      .then((data: Budget) => {
        setBudget(data);
        setShowModal(false);
      })
      .catch(alertError);
  };

  const handleDeleteBudget = () => {
    if (window.confirm("Are you sure you want to delete this budget?")) {
      deleteMonthlyBudget()
        .then(() => {
          setBudget(null);
          setName("");
          setValue(0);
        })
        .catch(alertError);
    }
  };

  return (
    <Container>
      <Row className="mb-3">
        <Col>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
          >
            {budget ? "Edit Monthly Budget" : "Add Monthly Budget"}
          </Button>
        </Col>
      </Row>
      <Row>
        {budget && <BudgetCard budget={budget} onEdit={() => setShowModal(true)} onDelete={handleDeleteBudget} />}
      </Row>
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{budget ? "Edit Budget" : "Add Budget"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSaveBudget}>
            <Form.Group controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter budget name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="value" className="mt-3">
              <Form.Label>Value</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter budget value"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </Form.Group>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Close
              </Button>
              <Button variant="primary" type="submit">
                Save Budget
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Body>
      </Modal>
      <TaggedBudgetManager onCreated={() => setStatsVersion((v) => v + 1)} />
      <BudgetStats version={statsVersion} />
    </Container>
  );
};



const TaggedBudgetManager: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [newTaggedBudget, setNewTaggedBudget] = useState({ name: "", value: 0, tag: "" });

  const addBudget = () => {
    createTaggedBudget(newTaggedBudget)
      .then(() => {
        setNewTaggedBudget({ name: "", value: 0, tag: "" });
        onCreated();
      })
      .catch(alertError);
  };

  return (
    <div>
      <Form>
        <h2>Create Tagged Budget</h2>
        <Form.Group className="mb-2">
          <Form.Label>Name</Form.Label>
          <Form.Control
            type="text"
            value={newTaggedBudget.name}
            onChange={(e) =>
              setNewTaggedBudget({ ...newTaggedBudget, name: e.target.value })
            }
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Value</Form.Label>
          <Form.Control
            type="number"
            value={newTaggedBudget.value}
            onChange={(e) =>
              setNewTaggedBudget({
                ...newTaggedBudget,
                value: parseFloat(e.target.value),
              })
            }
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Tag</Form.Label>
          <Form.Control
            type="text"
            value={newTaggedBudget.tag}
            onChange={(e) =>
              setNewTaggedBudget({ ...newTaggedBudget, tag: e.target.value })
            }
          />
        </Form.Group>
        <Button variant="primary" onClick={addBudget}>
          Add Budget
        </Button>
      </Form>
    </div>
  );
};

const BudgetStatCard: React.FC<{ stat: TaggedBudgetStats, onDelete: () => void }> = ({ stat, onDelete }) => {
  const spent = -(stat.totalPrice ?? 0);
  const remaining = stat.value - spent;
  const percentageLeft = (remaining / stat.value) * 100;

  let bgColor = "bg-danger";
  if (percentageLeft >= 75) bgColor = "bg-success";
  else if (percentageLeft >= 50) bgColor = "bg-primary";
  else if (percentageLeft >= 25) bgColor = "bg-warning";

  return (
    <Card className={`mb-3 text-white ${bgColor}`}>
      <Card.Body>
        <Card.Title>{stat.name}</Card.Title>
        <Card.Text>
          <strong>Budget:</strong> ${stat.value.toFixed(2)} <br />
          <strong>Spent:</strong> ${spent.toFixed(2)} <br />
          <strong>Remaining:</strong> ${remaining.toFixed(2)} <br />
          <strong>Tag:</strong> {stat.tag} <br />
        </Card.Text>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </Card.Body>
    </Card>
  );
};

const BudgetStats: React.FC<{ version: number }> = ({ version }) => {
  const [budgetStats, setBudgetStats] = useState<TaggedBudgetStats[]>([]);

  useEffect(() => {
    getTaggedBudgetStats().then(setBudgetStats).catch(console.error);
  }, [version]);
  const deleteBudget = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this budget?")) return;
    deleteTaggedBudget(id)
      .then(() => setBudgetStats(budgetStats.filter((budget) => budget.id !== id)))
      .catch(alertError);
  };
  return (
    <div>
      <h2>Budget Stats</h2>
      {budgetStats.map((stat) => (
        <BudgetStatCard key={stat.id} stat={stat}
          onDelete={() => deleteBudget(stat.id)}
        />
      ))}
    </div>
  );
};

export default BudgetPage;

