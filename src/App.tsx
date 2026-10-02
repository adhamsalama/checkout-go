import { Route, Routes } from "react-router";
import Dashboard from "./components/Dashboard";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import "bootstrap/dist/css/bootstrap.min.css";
import { Link } from "react-router-dom";
import { ListExpenses } from "./components/ListExpenses";
import { SearchPage } from "./components/SearchPage";
import PaymentPage from "./components/ListPayments";
import BudgetsPage from "./components/BudgetsPage";
import SettingsPage from "./components/SettingsPage";

function App() {
  return (
    <Container>
      <Navbar bg="light" expand="lg" collapseOnSelect style={{ marginBottom: "20px" }}>
        <Container>
          <Navbar.Brand as={Link} to="/">
            Checkout
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/" eventKey="/">Home</Nav.Link>
              <Nav.Link as={Link} to="/dashboard" eventKey="/dashboard">Dashboard</Nav.Link>
              <Nav.Link as={Link} to="/payments" eventKey="/payments">Payments</Nav.Link>
              <Nav.Link as={Link} to="/budgets" eventKey="/budgets">Budgets</Nav.Link>
              <Nav.Link as={Link} to="/search" eventKey="/search">Search</Nav.Link>
              <Nav.Link as={Link} to="/settings" eventKey="/settings">Backup</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Routes>
        <Route path="/search" element={<SearchPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<ListExpenses />} />
        <Route path="/payments" element={<PaymentPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Container>
  );
}

export default App;
