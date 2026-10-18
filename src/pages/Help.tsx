import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, KeyRound, ShieldCheck } from "lucide-react";

export default function HelpPage({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="app help-page">
      <header className="help-header">
        <Link className="back-link" to={signedIn ? "/" : "/welcome"}>
          <ArrowLeft size={17} aria-hidden="true" />
          {signedIn ? "До мого простору" : "На головну"}
        </Link>
        {!signedIn && (
          <Link className="button secondary" to="/login">
            Увійти
          </Link>
        )}
      </header>
      <main className="help-main">
        <p className="eyebrow">ДОПОМОГА ТА ПРИВАТНІСТЬ</p>
        <h1>Як користуватися Beauty Trainer</h1>
        <p className="help-lead">
          Beauty Trainer — навчальний сервіс для вивчення професійної косметики
          для волосся. Він допомагає пригадувати властивості продуктів, але не
          замінює офіційні інструкції виробника чи професійну консультацію.
        </p>
        <div className="help-grid">
          <section className="detail-panel">
            <BookOpen aria-hidden="true" />
            <h2>Як почати</h2>
            <p>
              Оберіть бренд і лінійку в каталозі, перегляньте картки, а потім
              пройдіть тест. Слабкі теми й матеріали для повторення з’являються
              у вашому особистому просторі.
            </p>
          </section>
          <section className="detail-panel">
            <KeyRound aria-hidden="true" />
            <h2>Доступ до акаунта</h2>
            <p>
              Якщо ви забули пароль, зверніться до власника сайту. Власник
              надасть тимчасовий пароль, який потрібно змінити одразу після
              входу.
            </p>
          </section>
          <section className="detail-panel">
            <ShieldCheck aria-hidden="true" />
            <h2>Які дані зберігаються</h2>
            <p>
              Сервіс зберігає логін, захищений хеш пароля, навчальний прогрес,
              відповіді у тестах, XP та дати активності. Паролі у відкритому
              вигляді не зберігаються. Дані використовуються для роботи навчання
              та адміністративного керування доступом.
            </p>
          </section>
        </div>
        <section className="detail-panel help-contact">
          <h2>Потрібна допомога?</h2>
          <p>
            Зверніться до відповідального за навчання у вашій компанії. Він може
            перевірити доступні бренди й лінійки, скинути пароль або видалити
            акаунт разом із навчальними даними.
          </p>
        </section>
      </main>
    </div>
  );
}
