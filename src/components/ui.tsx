import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Leaf } from "lucide-react";
import { useData } from "../hooks/useData";
import {
  LEARNING_STATUS_LABELS,
  lineLearningStatus,
  mastery,
} from "../../shared/learning";
import type { Line, Product } from "../../shared/schema";
import { counted } from "../../shared/uk";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ProgressBar({ value }: { value: number }) {
  return (
    <progress
      className="progress-track"
      aria-label="Засвоєння"
      value={Math.max(0, Math.min(100, value))}
      max={100}
    />
  );
}
export function Tags({ values }: { values: string[] }) {
  return (
    <div className="tags">
      {values.map((x) => (
        <span className="tag" key={x}>
          {x}
        </span>
      ))}
    </div>
  );
}
export function LineCard({ line, index = 0 }: { line: Line; index?: number }) {
  const { catalog, stats } = useData();
  const score = mastery(stats.progress, "line", line.id);
  const status = lineLearningStatus(
    stats,
    line.id,
    catalog.products
      .filter((product) => product.line_id === line.id)
      .map((product) => product.id),
  );
  return (
    <Link to={`/lines/${line.id}`} className="line-card">
      <div className={`line-art tone-${index % 4}`}>
        {line.image ? (
          <img
            className="line-photo"
            src={line.image}
            alt={line.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <Leaf size={54} strokeWidth={0.8} />
        )}
      </div>
      <div className="line-content">
        <div className="line-meta-row">
          <span className="line-brand">
            {catalog.brands.find((b) => b.id === line.brand_id)?.name}
          </span>
          <span className={`learning-status status-${status}`}>
            {LEARNING_STATUS_LABELS[status]}
          </span>
        </div>
        <div className="row">
          <h3>{line.name}</h3>
          <ArrowUpRight size={17} />
        </div>
        <p>{line.short_description}</p>
        <div className="line-topics">
          {line.purposes.slice(0, 3).map((purpose) => (
            <span key={purpose}>{purpose}</span>
          ))}
        </div>
        <div className="row muted small">
          <span>
            {counted(
              catalog.products.filter((p) => p.line_id === line.id).length,
              ["продукт", "продукти", "продуктів"],
            )}
          </span>
          <span>{score}% засвоєно</span>
        </div>
        <ProgressBar value={score} />
      </div>
    </Link>
  );
}
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link className="product-card" to={`/products/${product.id}`}>
      <div className="product-thumb">
        {product.image ? (
          <img src={product.image} alt={product.name} />
        ) : (
          <Leaf size={26} />
        )}
      </div>
      <div>
        <span className="eyebrow">{product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.purpose}</p>
      </div>
      <ArrowUpRight size={18} />
    </Link>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Leaf size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
