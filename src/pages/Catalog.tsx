import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, ArrowLeft, ArrowRight, Leaf } from "lucide-react";
import { useData } from "../hooks/useData";
import {
  Empty,
  LineCard,
  PageHeading,
  ProductCard,
  ProgressBar,
  Tags,
} from "../components/ui";
import { mastery } from "../../shared/learning";
import { counted } from "../../shared/uk";
const filterLabels: Record<string, string> = {
  brand: "Бренд",
  line: "Лінійка",
  hair: "Тип волосся",
  category: "Категорія",
  purpose: "Призначення",
  benefit: "Перевага",
};
export function CatalogPage() {
  const { catalog } = useData();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const options: Record<string, string[]> = {
    brand: catalog.brands.map((b) => b.name),
    line: catalog.lines.map((l) => l.name),
    hair: catalog.products.flatMap((p) => p.hair_types),
    category: catalog.products.map((p) => p.category),
    purpose: catalog.products.map((p) => p.purpose),
    benefit: catalog.products.flatMap((p) => p.benefits),
  };
  const products = catalog.products.filter((p) => {
    const brand = catalog.brands.find((b) => b.id === p.brand_id)!;
    const line = catalog.lines.find((l) => l.id === p.line_id)!;
    return (
      `${p.name} ${p.description} ${brand.name} ${line.name} ${p.purpose} ${p.benefits.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!filters.brand || filters.brand === brand.name) &&
      (!filters.line || filters.line === line.name) &&
      (!filters.hair || p.hair_types.includes(filters.hair)) &&
      (!filters.category || filters.category === p.category) &&
      (!filters.purpose || filters.purpose === p.purpose) &&
      (!filters.benefit || p.benefits.includes(filters.benefit))
    );
  });
  const filtered = !!search || Object.values(filters).some(Boolean);
  return (
    <>
      <PageHeading
        eyebrow="ЗНАЙТЕ СВОЇ ПРОДУКТИ"
        title="Бібліотека продуктів"
        description="Знайомтеся з брендами, вивчайте лінійки та знаходьте потрібний продукт."
      />
      <div className="filter-panel">
        <label className="search">
          <Search size={18} />
          <input
            placeholder="Пошук продуктів, лінійок або потреб…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Пошук у каталозі"
          />
        </label>
        <div className="filter-grid">
          {Object.entries(options).map(([key, values]) => (
            <label key={key}>
              <span>{filterLabels[key]}</span>
              <select
                value={filters[key] ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
              >
                <option value="">Усі варіанти</option>
                {[...new Set(values)].sort().map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {filtered && (
          <button
            className="text-link"
            onClick={() => {
              setFilters({});
              setSearch("");
            }}
          >
            Скинути фільтри
          </button>
        )}
      </div>
      {filtered ? (
        <>
          <p className="muted">Знайдено продуктів: {products.length}</p>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {!products.length && (
            <Empty title="Продуктів не знайдено">
              <p>Спробуйте інший запит або скиньте фільтри.</p>
            </Empty>
          )}
        </>
      ) : (
        catalog.brands.map((b) => (
          <section className="brand-section" key={b.id}>
            <div className="section-heading">
              <div>
                <h2 className="brand-title">{b.name}</h2>
                <p>
                  {counted(
                    catalog.lines.filter((l) => l.brand_id === b.id).length,
                    ["лінійка", "лінійки", "лінійок"],
                  )}{" "}
                  ·{" "}
                  {counted(
                    catalog.products.filter((p) => p.brand_id === b.id).length,
                    ["продукт", "продукти", "продуктів"],
                  )}
                </p>
              </div>
            </div>
            <div className="catalog-lines">
              {catalog.lines
                .filter((l) => l.brand_id === b.id)
                .map((l, i) => (
                  <div key={l.id}>
                    <LineCard line={l} index={i} />
                    <div className="nested-products">
                      {catalog.products
                        .filter((p) => p.line_id === l.id)
                        .map((p) => (
                          <Link key={p.id} to={`/products/${p.id}`}>
                            {p.name}
                            <ArrowRight size={13} />
                          </Link>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))
      )}
      {!catalog.brands.length && (
        <Empty title="Додайте знання до своєї бібліотеки">
          <Link to="/admin" className="button primary">
            Додати перший бренд
          </Link>
        </Empty>
      )}
    </>
  );
}
export function LinePage() {
  const { id } = useParams();
  const { catalog, stats } = useData();
  const line = catalog.lines.find((l) => l.id === id);
  if (!line) return <Empty title="Лінійку не знайдено" />;
  return (
    <>
      <Link className="back-link" to="/catalog">
        <ArrowLeft size={15} />
        Каталог продуктів
      </Link>
      <PageHeading
        eyebrow={catalog.brands.find((b) => b.id === line.brand_id)!.name}
        title={line.name}
        description={line.short_description}
        action={
          <Link className="button primary" to={`/training?line=${line.id}`}>
            Пройти тест лінійки <ArrowRight size={16} />
          </Link>
        }
      />
      <div className="detail-panel">
        <p className="lead">{line.description}</p>
        <div className="detail-grid">
          <section>
            <h3>Для яких типів волосся</h3>
            <Tags values={line.hair_types} />
          </section>
          <section>
            <h3>Основні призначення</h3>
            <Tags values={line.purposes} />
          </section>
          <section>
            <h3>Переваги</h3>
            <Tags values={line.benefits} />
          </section>
          <section>
            <h3>Ключові слова для запам’ятовування</h3>
            <Tags values={line.keywords} />
          </section>
        </div>
        <div className="row">
          <h3>Прогрес навчання</h3>
          <strong>{mastery(stats.progress, "line", line.id)}%</strong>
        </div>
        <ProgressBar value={mastery(stats.progress, "line", line.id)} />
      </div>
      <div className="section-heading">
        <h2>Продукти цієї лінійки</h2>
      </div>
      <div className="product-grid">
        {catalog.products
          .filter((p) => p.line_id === id)
          .map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
      </div>
    </>
  );
}
export function ProductPage() {
  const { id } = useParams();
  const { catalog, stats } = useData();
  const p = catalog.products.find((p) => p.id === id);
  if (!p) return <Empty title="Продукт не знайдено" />;
  const line = catalog.lines.find((l) => l.id === p.line_id)!;
  return (
    <>
      <Link className="back-link" to={`/lines/${line.id}`}>
        <ArrowLeft size={15} />
        {line.name}
      </Link>
      <PageHeading
        eyebrow={`${catalog.brands.find((b) => b.id === p.brand_id)!.name} / ${line.name}`}
        title={p.name}
        description={p.category}
      />
      <div className="product-detail">
        <div className="product-image">
          {p.image ? (
            <img src={p.image} alt={p.name} />
          ) : (
            <>
              <Leaf size={80} strokeWidth={0.8} />
              <span>{p.name}</span>
              <small>Зображення ще не додано</small>
            </>
          )}
        </div>
        <div className="detail-panel">
          <p className="lead">{p.description}</p>
          <h3>Основне призначення</h3>
          <p>{p.purpose}</p>
          <h3>Для яких типів волосся</h3>
          <Tags values={p.hair_types} />
          <h3>Ключові переваги</h3>
          <Tags values={p.benefits} />
          <h3>Ключові складники</h3>
          <Tags values={p.ingredients} />
          {p.usage && (
            <>
              <h3>Спосіб застосування</h3>
              <p>{p.usage}</p>
            </>
          )}
          <div className="row">
            <h3>Ваш рівень засвоєння</h3>
            <strong>{mastery(stats.progress, "product", p.id)}%</strong>
          </div>
          <ProgressBar value={mastery(stats.progress, "product", p.id)} />
        </div>
      </div>
    </>
  );
}
