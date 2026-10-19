import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  Leaf,
  RotateCcw,
  Search,
} from "lucide-react";

export default function Welcome({
  signedIn = false,
  registrationOpen = true,
}: {
  signedIn?: boolean;
  registrationOpen?: boolean;
}) {
  const destination = signedIn
    ? "/"
    : registrationOpen
      ? "/register"
      : "/login";
  return (
    <div className="app welcome-page">
      <header className="welcome-header">
        <Link className="welcome-logo" to="/welcome">
          <Leaf aria-hidden="true" />
          <span>
            <strong>beauty</strong>trainer
          </span>
        </Link>
        <nav aria-label="Про платформу">
          <a href="#how-it-works">Можливості</a>
          <a href="#how-it-works">Як це працює</a>
          <a href="#for-whom">Для кого</a>
        </nav>
        <div className="actions">
          <Link className="button secondary" to={signedIn ? "/" : "/login"}>
            {signedIn ? "Мій простір" : "Увійти"}
          </Link>
          {!signedIn && registrationOpen && (
            <Link className="button primary" to="/register">
              Створити акаунт <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </header>
      <main className="welcome-main">
        <section className="welcome-hero">
          <div>
            <p className="eyebrow">НАВЧАННЯ ПРОФЕСІЙНОГО ДОГЛЯДУ ЗА ВОЛОССЯМ</p>
            <h1>
              Знайте продукт.
              <br />
              <em>Радьте впевнено.</em>
            </h1>
            <p className="welcome-lead">
              Beauty Trainer допомагає розібратися в лінійках і продуктах,
              запам’ятати їхні переваги та підбирати догляд під потреби клієнта.
            </p>
            <p>
              Для майстрів, консультантів і тих, хто знайомиться з професійною
              косметикою для волосся.
            </p>
            <div className="actions">
              <Link className="button primary" to={destination}>
                {signedIn
                  ? "Продовжити навчання"
                  : registrationOpen
                    ? "Створити акаунт"
                    : "Увійти у свій акаунт"}
                <ArrowRight size={18} />
              </Link>
              <a className="text-link" href="#how-it-works">
                Як це працює
              </a>
            </div>
            <p className="small muted">
              {registrationOpen
                ? "Ваші результати й прогрес зберігаються в особистому акаунті."
                : "Реєстрацію нових учасників тимчасово закрито. Наявні акаунти працюють."}
            </p>
          </div>
          <aside
            className="welcome-preview"
            aria-label="Приклад навчального простору"
          >
            <div className="welcome-product-preview">
              <div>
                <span className="eyebrow">ПРИКЛАД КАРТКИ</span>
                <h2>Insight Anti-Frizz</h2>
                <p>
                  Зволоження, розгладження та захист для неслухняного волосся.
                </p>
                <span className="welcome-progress">
                  <i /> 67%
                </span>
              </div>
              <img
                src="/images/insight/anti-frizz-zvolozhuiuchyi-shampun.webp"
                alt="Insight Anti-Frizz"
              />
            </div>
            <div className="welcome-route-preview">
              <strong>Ваш маршрут навчання</strong>
              <span>
                <b>1</b> Картки
              </span>
              <span>
                <b>2</b> Звичайний тест
              </span>
              <span>
                <b>3</b> Складний тест
              </span>
            </div>
            <div className="welcome-search-preview">
              <Search size={18} />
              <span>Знайти продукт, лінійку або потребу</span>
            </div>
          </aside>
        </section>
        <section id="how-it-works" className="welcome-features">
          <p className="eyebrow">ВАШ НАВЧАЛЬНИЙ ПРОСТІР</p>
          <h2>Навчайтеся крок за кроком</h2>
          <div className="welcome-feature-grid">
            {[
              {
                Icon: BookOpen,
                title: "Бібліотека та картки",
                text: "Переходьте від бренду до лінійки й продукту. Спочатку пригадайте відповідь на картці, потім відкрийте пояснення.",
              },
              {
                Icon: Brain,
                title: "Два режими тестування",
                text: "Почніть зі звичайного тесту. Коли будете готові, оберіть складний: фото, пари та запитання з кількома відповідями.",
              },
              {
                Icon: RotateCcw,
                title: "Повторення слабких тем",
                text: "Повертайтеся до помилок і тем, які настав час повторити. Пояснення допомагають зрозуміти правильну відповідь.",
              },
              {
                Icon: ChartNoAxesCombined,
                title: "Знання для роботи",
                text: "Швидко знаходьте потрібний продукт і повертайтеся до матеріалу перед консультацією клієнта.",
              },
            ].map(({ Icon, title, text }) => (
              <article key={title}>
                <Icon size={27} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="for-whom" className="welcome-start">
          <div>
            <h2>Почніть з однієї лінійки</h2>
            <p>
              Оберіть матеріал, вивчіть картки та пройдіть перший тест. Ваш
              прогрес збережеться для наступного входу.
            </p>
          </div>
          <Link className="button primary" to={destination}>
            {signedIn
              ? "До навчання"
              : registrationOpen
                ? "Почати навчання"
                : "Увійти"}
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="welcome-footer">
        <span>Beauty Trainer · Більше знань. Кращий догляд.</span>
        <span>Навчальні матеріали з професійного догляду за волоссям.</span>
        <Link to="/help">Допомога та приватність</Link>
      </footer>
    </div>
  );
}
