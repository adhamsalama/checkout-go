import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Modal,
} from "react-bootstrap";
import { Expense } from "../types";
import { alertError } from "../api";
import {
  createPayment,
  deleteTransaction,
  listPayments,
  updatePayment,
} from "../api/transactions";
import { toDateInput } from "../dates";

type Payment = Expense;

const PaymentPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [name, setName] = useState<string>("");
  const [value, setValue] = useState<number>(0);
  const [date, setDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);

  useEffect(() => {
    listPayments()
      .then((data) => setPayments(data))
      .catch((error) => console.error(error));
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(parseFloat(e.target.value));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  };

  const handleEditPayment = (paymentId: number) => {
    const payment = payments.find((p) => p.id === paymentId);
    if (payment) {
      setEditPaymentId(payment.id);
      setName(payment.name);
      setValue(payment.price);
      setDate(toDateInput(payment.date));
      setDescription(payment.comment ?? "");
      setShowEditModal(true);
    }
  };

  const handleDeletePayment = (payment: Payment) => {
    if (window.confirm(`Are you sure you want to delete ${payment.name}?`)) {
      deleteTransaction(payment.id)
        .then(() => setPayments(payments.filter((p) => p.id !== payment.id)))
        .catch(alertError);
    }
  };

  const handleCloseEditModal = () => {
    // setName("");
    // setValue(0);
    // setDate("");
    // setDescription("");
    // setEditPaymentId(null);
    setShowEditModal(false);
  };

  const handleSaveEditModal = () => {
    if (editPaymentId !== null) {
      updatePayment(editPaymentId, {
        name,
        price: value,
        date: date || undefined,
        comment: description,
      })
        .then((updated) => {
          setPayments(payments.map((p) => (p.id === updated.id ? updated : p)));
          handleCloseEditModal();
        })
        .catch(alertError);
    }
  };

  const handleAddPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createPayment({ name, price: value, date, comment: description })
      .then((data: Payment) => {
        setPayments([data, ...payments]);
        setName("");
        setValue(0);
        setDate("");
        setDescription("");
      })
      .catch(alertError);
  };

  return (
    <Container>
      <Row>
        <Col>
          <h1>Add Payment</h1>
          <Form onSubmit={handleAddPayment}>
            <Form.Group controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter payment name"
                value={name}
                onChange={handleNameChange}
              />
            </Form.Group>
            <Form.Group controlId="value">
              <Form.Label>Value</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter payment value"
                value={value}
                onChange={handleValueChange}
              />
            </Form.Group>
            <Form.Group controlId="date">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                placeholder="Enter payment date"
                value={date}
                onChange={handleDateChange}
              />
            </Form.Group>
            <Button variant="primary" type="submit">
              Save
            </Button>
          </Form>
        </Col>
      </Row>
      <Row>
        {payments.map((payment) => (
          <Col key={payment.id} md={4} style={{ marginBottom: "20px" }}>
            <Card>
              <Card.Body>
                <Card.Title>{payment.name}</Card.Title>
                <Card.Text>
                  Value: {payment.price}
                  <br />
                  Date: {new Date(payment.date).toDateString()}
                  <br />
                  Description: {payment.comment}
                </Card.Text>
                <Button
                  variant="primary"
                  onClick={() => handleEditPayment(payment.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDeletePayment(payment)}
                >
                  Delete
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter payment name"
                value={name}
                onChange={handleNameChange}
              />
            </Form.Group>
            <Form.Group controlId="value">
              <Form.Label>Value</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter payment value"
                value={value}
                onChange={handleValueChange}
              />
            </Form.Group>
            <Form.Group controlId="date">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                placeholder="Enter payment date"
                value={date}
                onChange={handleDateChange}
              />
            </Form.Group>
            <Form.Group controlId="description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter payment description"
                value={description}
                onChange={handleDescriptionChange}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEditModal}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSaveEditModal}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default PaymentPage;
