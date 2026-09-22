import { useMemo, useState } from "react";
import { ExternalLink, Pencil, Search } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProductQualityIssue } from "../../shared/quality";
import {
  DESCRIPTION_MIN_LENGTH,
  catalogQuality,
  lineIssueLabels,
  productIssueLabels,
} from "../../shared/quality";
import { PageHeading } from "../components/ui";
import { useData } from "../hooks/useData";

const ALL = "all";

function alpenstoreSearch(brand: string, line: string, product: string) {
  return `https://alpenstore.com.ua/search?search=${encodeURIComponent(
    `${brand} ${line} ${product}`,
  )}`;
}

export default function QualityReport() {
  const { catalog } = useData();
  const report = useMemo(() => catalogQuality(catalog), [catalog]);
  const [issue, setIssue] = useState<ProductQualityIssue | typeof ALL>(ALL);
  const [brand, setBrand] = useState(ALL);
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("uk-UA");
  const products = report.products.filter(
    (row) =>
      row.issues.length > 0 &&
      (issue === ALL || row.issues.includes(issue)) &&
      (brand === ALL || row.product.brand_id === brand) &&
      (!query ||
        `${row.product.name} ${row.lineName} ${row.brandName}`
          .toLocaleLowerCase("uk-UA")
          .includes(query)),
  );
  const lines = report.lines.filter(
    (row) =>
      row.issues.length > 0 &&
      (brand === ALL ||
        catalog.brands.find((item) => item.id === brand)?.name ===
          row.brandName),
  );

  return (
    <>
      <PageHeading
        eyebrow="ЯКІСТЬ НАВЧАЛЬНИХ МАТЕРІАЛІВ"
        title="Що потрібно доповнити"
        description="Звіт формується з поточного каталогу й одразу оновлюється після редагування матеріалів."
      />
      <div className="admin-metrics quality-metrics">
        <div>
          <strong>{report.summary.completeProducts}</strong>
          <span>Продуктів без зауважень із {report.summary.products}</span>
        </div>
        <div>
          <strong>{report.summary.missingImage}</strong>
          <span>Без окремого фото</span>
        </div>
        <div>
          <strong>{report.summary.missingUsage}</strong>
          <span>Без способу застосування</span>
        </div>
        <div>
          <strong>{report.summary.weakDescription}</strong>
          <span>З коротким або однаковим описом</span>
        </div>
        <div>
          <strong>{report.summary.linesNeedWork}</strong>
          <span>Лінійок із обмеженнями для тестів</span>
        </div>
      </div>

      <section className="detail-panel quality-source">
        <div>
          <h2>Джерело для доповнення</h2>
          <p>
            Alpenstore містить картки milk_shake та Insight із фото, описами,
            призначенням і часто способом застосування. Перед перенесенням
            звіряйте бренд, лінійку та сам продукт: об’єми й варіанти пакування
            можуть відрізнятися.
          </p>
        </div>
        <div className="actions">
          <a
            className="button secondary"
            href="https://alpenstore.com.ua/milk_shake"
            target="_blank"
            rel="noreferrer"
          >
            milk_shake <ExternalLink size={16} />
          </a>
          <a
            className="button secondary"
            href="https://alpenstore.com.ua/insight"
            target="_blank"
            rel="noreferrer"
          >
            Insight <ExternalLink size={16} />
          </a>
        </div>
      </section>

      <section className="detail-panel">
        <h2>Проблеми продуктів</h2>
        <p className="muted">
          Коротким вважається опис до {DESCRIPTION_MIN_LENGTH} символів.
          Однакові описи порівнюються без урахування регістру та розділових
          знаків.
        </p>
        <div className="quality-filters">
          <label>
            Тип проблеми
            <select
              value={issue}
              onChange={(event) =>
                setIssue(event.target.value as ProductQualityIssue | typeof ALL)
              }
            >
              <option value={ALL}>Усі проблеми</option>
              {Object.entries(productIssueLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Бренд
            <select
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            >
              <option value={ALL}>Усі бренди</option>
              {catalog.brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="quality-search">
            Пошук
            <span>
              <Search size={17} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Назва продукту або лінійки"
              />
            </span>
          </label>
        </div>
        <p className="small muted">Знайдено продуктів: {products.length}</p>
        <div className="quality-list">
          {products.map((row) => (
            <article key={row.product.id} className="quality-row">
              <div>
                <span className="small muted">
                  {row.brandName} · {row.lineName}
                </span>
                <h3>{row.product.name}</h3>
                <div className="quality-badges">
                  {row.issues.map((item) => (
                    <span key={item}>{productIssueLabels[item]}</span>
                  ))}
                </div>
              </div>
              <div className="actions">
                <a
                  className="button secondary"
                  href={alpenstoreSearch(
                    row.brandName,
                    row.lineName,
                    row.product.name,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Знайти на Alpenstore <ExternalLink size={15} />
                </a>
                <Link
                  className="button primary"
                  to={`/admin?edit=${row.product.id}`}
                >
                  Редагувати <Pencil size={15} />
                </Link>
              </div>
            </article>
          ))}
          {!products.length && (
            <p>За вибраними фільтрами проблемних продуктів немає.</p>
          )}
        </div>
      </section>

      <section className="detail-panel">
        <h2>Готовність лінійок до складних тестів</h2>
        <p className="muted">
          Для зіставлення потрібні щонайменше три продукти однієї лінійки з
          різними призначеннями.
        </p>
        <div className="quality-list compact">
          {lines.map((row) => (
            <article key={row.id} className="quality-row">
              <div>
                <span className="small muted">{row.brandName}</span>
                <h3>{row.name}</h3>
                <p className="small">
                  Продуктів: {row.productCount} · різних призначень:{" "}
                  {row.distinctPurposeCount}
                </p>
                <div className="quality-badges">
                  {row.issues.map((item) => (
                    <span key={item}>{lineIssueLabels[item]}</span>
                  ))}
                </div>
              </div>
              <Link className="button secondary" to={`/lines/${row.id}`}>
                Переглянути лінійку
              </Link>
            </article>
          ))}
          {!lines.length && <p>Усі лінійки готові до зіставлення.</p>}
        </div>
      </section>
    </>
  );
}
