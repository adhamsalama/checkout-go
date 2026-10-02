import { NavLink } from "react-router-dom";
import { BarChartLine, CloudArrowUp, Cash, ListUl, Bullseye } from "react-bootstrap-icons";

const tabs = [
  { to: "/", label: "Expenses", Icon: ListUl },
  { to: "/payments", label: "Payments", Icon: Cash },
  { to: "/budgets", label: "Budgets", Icon: Bullseye },
  { to: "/dashboard", label: "Stats", Icon: BarChartLine },
  { to: "/settings", label: "Backup", Icon: CloudArrowUp },
];

export function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end replace className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
          <span className="tab-icon">
            <Icon size={20} />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
