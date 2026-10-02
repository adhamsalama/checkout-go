import { ReactNode, useEffect } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import { pushBackHandler } from "./backButton";

/** A bottom sheet, closable with the Android back button. */
export function Sheet({
  show,
  onClose,
  title,
  children,
}: {
  show: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => (show ? pushBackHandler(onClose) : undefined), [show, onClose]);
  return (
    <Offcanvas show={show} onHide={onClose} placement="bottom" className="sheet">
      <div className="sheet-handle" />
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>{title}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>{children}</Offcanvas.Body>
    </Offcanvas>
  );
}
