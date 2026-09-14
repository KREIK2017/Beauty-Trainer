import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Catalog, Stats } from "../../shared/schema";
import { fetchData } from "../services/api";
const Context = createContext<{
  catalog: Catalog;
  stats: Stats;
  refresh: () => Promise<void>;
} | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<[Catalog, Stats]>();
  const [error, setError] = useState("");
  async function refresh() {
    try {
      setData(await fetchData());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити дані");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  if (error && !data)
    return (
      <div className="startup">
        <h1>Підготуємо ваш навчальний простір</h1>
        <p role="alert">{error}</p>
        <p>
          Виконайте міграції та початкове заповнення бази, а потім запустіть
          API. Інструкції наведено в README.
        </p>
        <button onClick={() => void refresh()}>Спробувати ще раз</button>
      </div>
    );
  if (!data)
    return (
      <div className="startup" role="status">
        <div className="spinner" />
        <p>Відкриваємо ваш навчальний простір…</p>
      </div>
    );
  return (
    <Context.Provider value={{ catalog: data[0], stats: data[1], refresh }}>
      {error && (
        <div className="sync-error" role="alert">
          <span>Не вдалося оновити навчальний простір. {error}</span>
          <button onClick={() => void refresh()}>Повторити</button>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const data = useContext(Context);
  if (!data) throw new Error("DataProvider required");
  return data;
}
