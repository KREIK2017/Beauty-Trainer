import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Settings, Users, SlidersHorizontal, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function AccountMenu({ onOpen }: { onOpen: () => void }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="account-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        aria-label={`Меню акаунта ${user.username}`}
        aria-expanded={open}
        aria-controls="account-dropdown"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
      >
        <span className="avatar small-avatar" aria-hidden="true">
          {user.username[0].toUpperCase()}
        </span>
      </button>
      {open && (
        <div id="account-dropdown" className="account-dropdown">
          <div className="account-identity">
            <strong>{user.username}</strong>
            <small>
              {user.role === "admin" ? "Власник сайту" : "Особистий акаунт"}
            </small>
          </div>
          <nav aria-label="Дії акаунта" onClick={() => setOpen(false)}>
            <Link to="/settings">
              <Settings size={18} aria-hidden="true" />
              Налаштування
            </Link>
            {user.role === "admin" && (
              <>
                <Link to="/admin/users">
                  <Users size={18} aria-hidden="true" />
                  Панель адміна
                </Link>
                <Link to="/admin">
                  <SlidersHorizontal size={18} aria-hidden="true" />
                  Керування продуктами
                </Link>
              </>
            )}
          </nav>
          <button
            disabled={busy}
            className="account-logout"
            onClick={async () => {
              setBusy(true);
              try {
                await logout();
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            {busy ? "Виходимо…" : "Вийти з акаунта"}
          </button>
        </div>
      )}
    </div>
  );
}
