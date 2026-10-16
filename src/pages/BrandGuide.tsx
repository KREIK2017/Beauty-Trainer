import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe2,
  Lightbulb,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Empty, LineCard, PageHeading, Tags } from "../components/ui";
import { brandGuides } from "../data/brandGuides";
import { useData } from "../hooks/useData";
import { counted } from "../../shared/uk";

export default function BrandGuidePage() {
  const { id } = useParams();
  const { catalog } = useData();
  const brand = catalog.brands.find((item) => item.id === id);
  const guide = id ? brandGuides[id] : undefined;

  if (!brand || !guide)
    return <Empty title="Інформацію про бренд не знайдено" />;

  const lines = catalog.lines.filter((line) => line.brand_id === brand.id);
  const products = catalog.products.filter(
    (product) => product.brand_id === brand.id,
  );
  const directions = [...new Set(lines.flatMap((line) => line.purposes))];

  return (
    <>
      <Link className="back-link" to="/catalog">
        <ArrowLeft size={15} />
        Бібліотека продуктів
      </Link>
      <PageHeading
        eyebrow="ЕНЦИКЛОПЕДІЯ БРЕНДУ"
        title={brand.name}
        description={guide.tagline}
        action={
          <a className="button primary" href="#brand-lines">
            Обрати лінійку <ArrowRight size={16} />
          </a>
        }
      />

      <section className="brand-wiki-hero">
        <div className="brand-wiki-country">
          <Globe2 size={18} />
          <span>Країна бренду</span>
          <strong>{guide.country}</strong>
        </div>
        <div className="brand-wiki-story">
          <span className="eyebrow">КОРОТКО ПРО БРЕНД</span>
          <p className="lead">{guide.story}</p>
          <div className="brand-wiki-numbers">
            <span>
              <strong>
                {counted(lines.length, ["лінійка", "лінійки", "лінійок"])}
              </strong>
            </span>
            <span>
              <strong>
                {counted(products.length, ["продукт", "продукти", "продуктів"])}
              </strong>
            </span>
          </div>
        </div>
      </section>

      <div className="brand-wiki-grid">
        <section className="detail-panel">
          <span className="eyebrow">ФІЛОСОФІЯ</span>
          <ul className="brand-wiki-list">
            {guide.philosophy.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="detail-panel">
          <span className="eyebrow">ВІЗИТІВКА БРЕНДУ</span>
          <Tags values={guide.signatures} />
          <h3 className="brand-wiki-subtitle">Основні напрями каталогу</h3>
          <Tags values={directions.slice(0, 8)} />
        </section>
      </div>

      <section className="brand-memory-panel">
        <div className="brand-memory-title">
          <Lightbulb size={22} />
          <div>
            <span className="eyebrow">ШПАРГАЛКА</span>
            <h2>Що варто запам’ятати</h2>
          </div>
        </div>
        <ol>
          {guide.remember.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <div id="brand-lines" className="section-heading brand-lines-heading">
        <div>
          <span className="eyebrow">СТРУКТУРА АСОРТИМЕНТУ</span>
          <h2>Лінійки {brand.name}</h2>
        </div>
      </div>
      <div className="catalog-lines">
        {lines.map((line, index) => (
          <LineCard key={line.id} line={line} index={index} />
        ))}
      </div>

      <section className="brand-sources">
        <span className="eyebrow">ДЖЕРЕЛА</span>
        <p>Факти звірено з офіційними матеріалами бренду.</p>
        <div>
          {guide.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.label} <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
