import { useEffect, useState } from "react";
import { Expense as ExpenseType } from "../types";
import { listExpenses } from "../api/transactions";
import { Col, Row } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Expense from "./Expense";
import "react-date-range/dist/styles.css"; // main css file
import "react-date-range/dist/theme/default.css"; // theme css file
import { DateRangePicker } from "react-date-range";

export function SearchPage() {
  function deleteExpense(id: number) {
    setExpenses(expenses?.filter((expense) => expense.id !== id));
  }

  const [expenses, setExpenses] = useState<ExpenseType[]>();
  // const date = new Date();
  // const year = date.getFullYear();
  // const month = date.getMonth() + 1;
  // const day = date.getDate();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [priceGte, setPriceGte] = useState<number>();
  const [priceLte, setPriceLte] = useState<number>();

  const [limit, setLimit] = useState<number>(20);
  const [tags, setTags] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [useDate, setUseDate] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searched, setSearched] = useState(false);
  const OFFSET_STEP = 20;

  const handleScroll = async () => {
    const bottom =
      Math.ceil(window.innerHeight + window.scrollY) >=
      document.documentElement.scrollHeight;

    if (bottom && searched) {
      const data = await search({
        name,
        priceGte,
        priceLte,
        useDate,
        startDate,
        endDate,
        // limit,
        offset: offset + OFFSET_STEP,
        tags,
      });
      setExpenses([...(expenses ?? []), ...data]);
      setOffset(offset + OFFSET_STEP);
      if (data.length < OFFSET_STEP) setSearched(false);
    }
  };
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  });

  async function search(s: {
    name?: string;
    priceGte?: number;
    priceLte?: number;
    useDate?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    tags?: string;
  }): Promise<ExpenseType[]> {
    const {
      name,
      priceGte,
      priceLte,
      useDate,
      startDate,
      endDate,
      // limit = 1,
      offset,
      tags,
    } = s;

    return listExpenses({
      name: name || undefined,
      minAmount: priceGte,
      maxAmount: priceLte,
      startDate: useDate ? startDate : undefined,
      endDate: useDate ? endDate : undefined,
      limit: OFFSET_STEP,
      offset,
      tags: tags ? tags.split(",") : undefined,
    });
  }
  const selectionRange = {
    startDate: startDate,
    endDate: endDate,
    key: "selection",
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = await search({
      name,
      priceGte,
      priceLte,
      useDate,
      startDate,
      endDate,
      limit,
      offset: 0,
      tags,
    });
    setExpenses(data);
    setSearched(true);
    setOffset(0);
    // group expenses by date
  };

  return (
    <>
      <Form onSubmit={submit}>
        <Form.Group className="mb-3" controlId="formBasicEmail">
          <Form.Label>Name</Form.Label>
          <Form.Control
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="formBasicEmail">
          <Form.Label>Price Greater than or equal</Form.Label>
          <Form.Control
            type="number"
            value={priceGte}
            onChange={(e) => setPriceGte(parseFloat(e.target.value))}
            placeholder="Price"
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="formBasicEmail">
          <Form.Label>Price Less than or equal</Form.Label>
          <Form.Control
            type="number"
            value={priceLte}
            onChange={(e) => setPriceLte(parseFloat(e.target.value))}
            placeholder="Price"
          />
        </Form.Group>
        {/* <Form.Group className="mb-3" controlId="formBasicEmail">
        <Form.Label>Quantity</Form.Label>
        <Form.Control
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value))}
          placeholder="Quantity"
        />
      </Form.Group> */}
        {/* <Form.Group className="mb-3" controlId="formBasicEmail">
        <Form.Label>Seller Name</Form.Label>
        <Form.Control
          type="text"
          value={sellerName}
          onChange={(e) => setSellerName(e.target.value)}
          placeholder="Seller"
        />
      </Form.Group> */}
        <Form.Group className="mb-3" controlId="formBasicEmail">
          <Form.Label>Tags</Form.Label>
          <Form.Control
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags"
          />
        </Form.Group>
        <Form.Check
          type="checkbox"
          label="Search with Date"
          checked={useDate}
          id={`default-checkbox`}
          onChange={(e) => {
            setUseDate(!useDate);
          }}
        />

        {useDate && (
          <Form.Group className="mb-3" controlId="formBasicEmail">
            <DateRangePicker
              ranges={[selectionRange]}
              onChange={(selection) => {
                // console.log({
                //   q: selection.selection.startDate,
                //   d: selection.selection.startDate?.toISOString().slice(0, 10),
                //   dd: selection.selection.endDate?.toISOString().slice(0, 10),
                // });

                if (selection.selection.startDate) {
                  setStartDate(selection.selection.startDate);
                }
                if (selection.selection.endDate)
                  setEndDate(selection.selection.endDate);
              }}
            />
          </Form.Group>
        )}
        {/* <Form.Group className="mb-3" controlId="formBasicPassword">
          <Form.Label>Date</Form.Label>
          <Form.Control
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="Date"
          />
        </Form.Group> */}
        {/* <Form.Group className="mb-3" controlId="formBasicPassword">
        <Form.Label>Comment</Form.Label>
        <Form.Control
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="comment"
        />
      </Form.Group> */}
        <Button variant="primary" type="submit">
          Search
        </Button>
      </Form>
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
