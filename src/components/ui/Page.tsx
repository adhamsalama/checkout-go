import { ReactNode } from "react";
import { ArrowLeft } from "react-bootstrap-icons";
import { useNavigate } from "react-router-dom";

/** A screen: fixed top bar with title/actions, and scrollable content. */
export function Page({
  title,
  back,
  actions,
  children,
}: {
  title: string;
  back?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <>
      <header className="topbar">
        {back && (
          <button className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="topbar-title">{title}</h1>
        {actions}
      </header>
      <main className="app-main">{children}</main>
    </>
  );
}
