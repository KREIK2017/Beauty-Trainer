import { useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Leaf,
  Flame,
  Zap,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  Target,
} from "lucide-react";
import { useData } from "./hooks/useData";
import { useAuth } from "./hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import { CatalogPage, LinePage, ProductPage } from "./pages/Catalog";
import Training from "./pages/Training";
import Flashcards from "./pages/Flashcards";
import { WeakAreas, ProgressPage } from "./pages/Progress";
import Admin from "./pages/Admin";
import {
  AdminLayout,
  AdminUsers,
  AdminUserDetail,
  AdminSettings,
} from "./pages/AdminPanel";
const nav = [
  ["/", "Огляд", LayoutDashboard],
  ["/training", "Тренування", Brain],
  ["/catalog", "Каталог продуктів", BookOpen],
  ["/weak", "Слабкі теми", Target],
  ["/progress", "Мій прогрес", ChartNoAxesCombined],
] as const;
export default function App() {
  const { stats } = useData();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("beauty-theme") === "dark",
  );
  function theme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("beauty-theme", next ? "dark" : "light");
  }
  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link className="logo" to="/">
          <span className="logo-icon">
            <Leaf size={24} />
          </span>
          <span>
            beauty<span className="logo-light">trainer</span>
            <small>БІЛЬШЕ ЗНАНЬ. КРАЩИЙ ДОГЛЯД.</small>
          </span>
        </Link>
        <div className="nav-label">ВАШ НАВЧАЛЬНИЙ ПРОСТІР</div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobile(false)}
            >
              <Icon size={19} />
              {label}
              {to === "/training" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>Малі кроки. Міцні знання.</span>
            <p>
              Кілька хвилин сьогодні.
              <br />
              Більше впевненості в роботі.
            </p>
            <div className="mini-leaves">
              <Leaf />
              <Leaf />
              <Leaf />
            </div>
          </div>
          {user.role === "admin" && (
            <>
              <NavLink
                className="manage-link"
                to="/admin/users"
                onClick={() => setMobile(false)}
              >
                <SlidersHorizontal size={18} />
                Панель адміністратора
              </NavLink>
              <NavLink
                className="manage-link"
                to="/admin"
                onClick={() => setMobile(false)}
              >
                <SlidersHorizontal size={18} />
                Керування продуктами
              </NavLink>
            </>
          )}
          <div className="profile">
            <span className="avatar">{user.username[0].toUpperCase()}</span>
            <div>
              <strong>{user.username}</strong>
              <small>Особистий профіль</small>
            </div>
            <span className="online-dot" />
          </div>
          <button className="text-link" onClick={() => void logout()}>
            Вийти з акаунта
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Відкрити або закрити меню"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Мій простір
            <ChevronRight size={13} />
            <span>
              {nav.find(([to]) => to === location.pathname)?.[1] ??
                (location.pathname.startsWith("/admin")
                  ? "Панель адміністратора"
                  : "Бібліотека продуктів")}
            </span>
          </div>
          <div className="top-actions">
            <span>
              <Flame size={17} className="orange" />
              {stats.streak}
              <span className="hide-mobile"> дн. поспіль</span>
            </span>
            <i />
            <span>
              <Zap size={16} className="gold" />
              {stats.xp} XP
            </span>
            <button
              className="icon-button"
              onClick={theme}
              aria-label={
                dark ? "Увімкнути світлу тему" : "Увімкнути темну тему"
              }
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar small-avatar" title={user.username}>
              {user.username[0].toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/lines/:id" element={<LinePage />} />
            <Route path="/lines/:id/cards" element={<Flashcards />} />
            <Route path="/products/:id" element={<ProductPage />} />
            <Route
              path="/training"
              element={<Training key={location.search} />}
            />
            <Route path="/weak" element={<WeakAreas />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Admin />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:id" element={<AdminUserDetail />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Сторінку не знайдено</h1>
                  <Link to="/">До огляду</Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer>
          Для більшої впевненості щодня.
          <span>Beauty Trainer · Ваш помічник у навчанні</span>
        </footer>
      </div>
    </div>
  );
}
