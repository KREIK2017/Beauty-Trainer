import { useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
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
import Dashboard from "./pages/Dashboard";
import { CatalogPage, LinePage, ProductPage } from "./pages/Catalog";
import Training from "./pages/Training";
import Flashcards from "./pages/Flashcards";
import { WeakAreas, ProgressPage } from "./pages/Progress";
import Admin from "./pages/Admin";
import AccountMenu from "./components/AccountMenu";
import AccountSettings from "./pages/AccountSettings";
import QualityReport from "./pages/QualityReport";
import { AdminLayout, AdminUsers, AdminUserDetail } from "./pages/AdminPanel";
const nav = [
  ["/", "Огляд", LayoutDashboard],
  ["/training", "Тренування", Brain],
  ["/catalog", "Каталог продуктів", BookOpen],
  ["/weak", "Слабкі теми", Target],
  ["/progress", "Мій прогрес", ChartNoAxesCombined],
] as const;
export default function App() {
  const { stats, catalog } = useData();
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
                (location.pathname === "/settings"
                  ? "Налаштування"
                  : location.pathname.startsWith("/admin")
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
            <AccountMenu key={location.key} onOpen={() => setMobile(false)} />
          </div>
        </header>
        <main>
          {!catalog.products.length && (
            <p className="detail-panel" role="status">
              Для вашого акаунта ще немає доступних продуктів. Зверніться до
              власника сайту, щоб отримати доступ до навчання.
            </p>
          )}
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
            <Route path="/settings" element={<AccountSettings />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Admin />} />
              <Route path="quality" element={<QualityReport />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:id" element={<AdminUserDetail />} />
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
