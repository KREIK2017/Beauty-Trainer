import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  Leaf,
  RotateCcw,
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
        <Link className="button secondary" to={signedIn ? "/" : "/login"}>
          {signedIn ? "Мій простір" : "Увійти"}
        </Link>
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
          <aside className="welcome-preview" aria-label="Що є у тренуванні">
            <span className="question-type">
              <Brain size={18} />
              Від знайомства до впевненості
            </span>
            <h2>
              Не лише прочитати.
              <br />
              Пригадати й застосувати.
            </h2>
            <ul>
              <li>
                <span>01</span>
                <div>
                  <strong>Познайомтеся з лінійкою</strong>
                  <p>Типи волосся, призначення й переваги кожного продукту.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Перевірте себе</strong>
                  <p>
                    Запитання про продукти та клієнтські ситуації з поясненнями.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Поверніться до складного</strong>
                  <p>Повторення тем, у яких ще бракує впевненості.</p>
                </div>
              </li>
            </ul>
            <div className="welcome-session">
              <span>До 10 запитань</span>
              <span>3 життя</span>
              <span>Власний темп</span>
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
                title: "Особистий прогрес",
                text: "Слідкуйте за засвоєнням продуктів, накопичуйте XP та бачте результат своєї практики.",
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
        <section className="welcome-start">
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
        Beauty Trainer · Більше знань. Кращий догляд.
        <span>Навчальні матеріали з професійного догляду за волоссям.</span>
      </footer>
    </div>
  );
}
