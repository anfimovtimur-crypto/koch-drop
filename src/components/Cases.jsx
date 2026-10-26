import { useEffect, useMemo, useRef, useState } from "react";
import { getMarketSkins } from "../lib/marketSkins";
import "./Cases.css";

const PAGE_SIZE = 100;
const ROLL_LENGTH = 45;
const WIN_INDEX = 36;

const CASE_TIERS = [
  { name: "Стартовый", factor: 0.65, accent: "starter" },
  { name: "Классический", factor: 1, accent: "classic" },
  { name: "Премиум", factor: 1.5, accent: "premium" },
  { name: "Элитный", factor: 2.3, accent: "elite" },
  { name: "Black Edition", factor: 3.5, accent: "black" },
];

function uid() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function priceOf(item) {
  const value = Number(
    item?.price ??
    item?.cost ??
    item?.value ??
    item?.marketPrice ??
    item?.item_price ??
    0
  );

  return Number.isFinite(value) && value > 0 ? value : 0;
}

function nameOf(item) {
  return (
    item?.name ||
    item?.item_name ||
    item?.market_hash_name ||
    item?.title ||
    "Предмет"
  );
}

function imageOf(item) {
  return (
    item?.image ||
    item?.item_image ||
    item?.image_url ||
    item?.icon_url ||
    item?.img ||
    item?.icon ||
    ""
  );
}

function normalizePage(response) {
  if (Array.isArray(response)) {
    return { items: response, total: null };
  }

  const items =
    response?.items ??
    response?.skins ??
    response?.data ??
    response?.results ??
    [];

  const total = Number(response?.total ?? response?.totalCount);

  return {
    items: Array.isArray(items) ? items : [],
    total: Number.isFinite(total) && total > 0 ? total : null,
  };
}

function money(value) {
  return `${Number(value || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })} ₽`;
}

function getItemKey(item) {
  return String(
    item?.market_hash_name ||
    item?.id ||
    item?.assetid ||
    `${nameOf(item)}-${priceOf(item)}`
  );
}

function getRarity(item) {
  const raw = String(
    item?.rarity ||
    item?.quality ||
    item?.type ||
    ""
  ).toLowerCase();

  if (
    raw.includes("covert") ||
    raw.includes("extraordinary") ||
    raw.includes("тайное") ||
    raw.includes("нож")
  ) return "legendary";

  if (
    raw.includes("classified") ||
    raw.includes("примечательное") ||
    raw.includes("перчат")
  ) return "epic";

  if (
    raw.includes("restricted") ||
    raw.includes("засекреченное")
  ) return "rare";

  return "standard";
}

function extractImage(item) {
  const src = imageOf(item);

  if (!src) {
    return (
      <span className="kd-item-placeholder">
        <span>✳</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={nameOf(item)}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

/*
 * Цены кейсов рассчитываются на основе цен загруженного маркета.
 * Предметы внутри каждого кейса — реальные предметы из маркета.
 */
function buildCases(market) {
  const priced = market
    .filter((item) => priceOf(item) > 0 && nameOf(item) !== "Предмет")
    .sort((a, b) => priceOf(a) - priceOf(b));

  if (!priced.length) return [];

  const quantile = (ratio) => {
    const index = Math.min(
      priced.length - 1,
      Math.max(0, Math.floor((priced.length - 1) * ratio))
    );

    return priceOf(priced[index]);
  };

  const basePrice = quantile(0.2) || quantile(0.5) || 1;

  return CASE_TIERS.map((tier, index) => {
    const casePrice = Math.max(
      1,
      Math.round(basePrice * tier.factor * 100) / 100
    );

    /*
     * Содержимое подбирается по ценовому диапазону.
     * Если диапазон слишком узкий, используется весь маркет,
     * чтобы кейс не оставался пустым.
     */
    const lower = casePrice * 0.2;
    const upper = casePrice * 15;

    let items = priced.filter((item) => {
      const price = priceOf(item);
      return price >= lower && price <= upper;
    });

    if (items.length < 5) {
      items = priced.filter((item) => priceOf(item) <= casePrice * 30);
    }

    if (!items.length) items = priced;

    /*
     * Шансы обратно пропорциональны квадратному корню цены:
     * дешёвые предметы выпадают чаще, дорогие — реже.
     * Это веса выпадения, а не гарантия прибыли.
     */
    const weightedItems = items.map((item) => ({
      ...item,
      price: priceOf(item),
      chanceWeight: 1 / Math.sqrt(Math.max(priceOf(item), 1)),
      rarity: getRarity(item),
    }));

    return {
      id: `market-case-${index}`,
      name: tier.name,
      accent: tier.accent,
      price: casePrice,
      items: weightedItems,
      cover: weightedItems
        .slice()
        .sort((a, b) => priceOf(b) - priceOf(a))[0],
    };
  });
}

function chooseDrop(items) {
  if (!Array.isArray(items) || !items.length) return null;

  const weights = items.map((item) =>
    Math.max(0, Number(item?.chanceWeight) || 0)
  );

  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)];
  }

  let roll = Math.random() * total;

  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];

    if (roll <= 0) return items[index];
  }

  return items[items.length - 1];
}

export default function Cases({
  balance = 0,
  setBalance,
  inventory = [],
  setInventory,
}) {
  const [market, setMarket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rollItems, setRollItems] = useState([]);
  const [rollIndex, setRollIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  const timer = useRef(null);
  const balanceNow = Number(balance) || 0;

  useEffect(() => {
    let cancelled = false;

    async function loadMarket() {
      setLoading(true);
      setMarketError("");

      const collected = [];
      const seen = new Set();

      let start = 0;
      let knownTotal = null;

      try {
        for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
          if (cancelled) return;

          const response = await getMarketSkins({
            start,
            count: PAGE_SIZE,
          });

          const page = normalizePage(response);
          const batch = page.items;

          if (page.total !== null) {
            knownTotal = page.total;
          }

          for (const item of batch) {
            const key = getItemKey(item);

            if (!seen.has(key)) {
              seen.add(key);
              collected.push({
                ...item,
                price: priceOf(item),
              });
            }
          }

          if (!cancelled) {
            setMarket([...collected]);
          }

          start += PAGE_SIZE;

          if (
            batch.length === 0 ||
            batch.length < PAGE_SIZE ||
            (knownTotal !== null && start >= knownTotal)
          ) {
            break;
          }
        }

        if (!cancelled && collected.length === 0) {
          setMarketError("Маркет не вернул предметы с ценами.");
        }
      } catch (loadError) {
        console.error("Ошибка загрузки предметов маркета:", loadError);

        if (!cancelled) {
          setMarketError(
            "Не удалось загрузить предметы маркета. Проверь подключение и getMarketSkins."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMarket();

    return () => {
      cancelled = true;

      if (timer.current) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  const caseList = useMemo(() => buildCases(market), [market]);

  const currentCase = caseList.find(
    (item) => item.id === selectedCaseId
  );

  const drops = useMemo(() => {
    if (!currentCase) return [];

    const items = currentCase.items || [];
    const totalWeight = items.reduce(
      (sum, item) => sum + (Number(item.chanceWeight) || 0),
      0
    );

    return [...items]
      .sort((a, b) => priceOf(b) - priceOf(a))
      .map((item) => ({
        ...item,
        probability: totalWeight > 0
          ? ((Number(item.chanceWeight) || 0) / totalWeight) * 100
          : 0,
      }));
  }, [currentCase]);

  function enterCase(item) {
    if (spinning) return;

    setSelectedCaseId(item.id);
    setError("");
    setResult(null);
    setRollItems([]);
    setRollIndex(0);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToCatalog() {
    if (spinning) return;

    setSelectedCaseId(null);
    setError("");
    setResult(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCase() {
    if (!currentCase || spinning) return;

    const cost = priceOf({ price: currentCase.price });

    if (
      typeof setBalance !== "function" ||
      typeof setInventory !== "function"
    ) {
      setError("Не удалось подключить баланс или инвентарь.");
      return;
    }

    if (balanceNow < cost) {
      setError("Недостаточно средств для открытия кейса.");
      return;
    }

    if (!currentCase.items?.length) {
      setError("В этом кейсе нет предметов.");
      return;
    }

    const won = chooseDrop(currentCase.items);

    if (!won) {
      setError("Не получилось выбрать предмет. Попробуй ещё раз.");
      return;
    }

    const reel = Array.from({ length: ROLL_LENGTH }, (_, index) => {
      if (index === WIN_INDEX) return won;

      return chooseDrop(currentCase.items) || won;
    });

    setBalance((previous) => (Number(previous) || 0) - cost);

    setRollItems(reel);
    setRollIndex(0);
    setResult(null);
    setError("");
    setSpinning(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setRollIndex(WIN_INDEX));
    });

    timer.current = window.setTimeout(() => {
      setSpinning(false);

      const received = {
        ...won,
        uid: uid(),
        price: priceOf(won),
      };

      setResult({
        item: received,
        caseName: currentCase.name,
      });

      setHistory((previous) => [
        {
          ...received,
          id: uid(),
          caseName: currentCase.name,
        },
        ...previous,
      ].slice(0, 6));
    }, 5000);
  }

  function keepResult() {
    if (!result?.item || typeof setInventory !== "function") return;

    setInventory((previous) => [
      ...(Array.isArray(previous) ? previous : []),
      result.item,
    ]);

    setResult(null);
  }

  function sellResult() {
    if (!result?.item || typeof setBalance !== "function") return;

    setBalance(
      (previous) => (Number(previous) || 0) + priceOf(result.item)
    );

    setResult(null);
  }

  return (
    <main className="kd-cases-page">
      <div className="kd-cases-glow" aria-hidden="true" />

      <div className="kd-cases-container">
        {!currentCase ? (
          <>
            <header className="kd-cases-header">
              <div>
                <span className="kd-cases-eyebrow">
                  <i /> KOCH DROP / CASE MARKET
                </span>

                <h1>
                  ОТКРЫВАЙ <em>КЕЙСЫ</em>
                </h1>

                <p>
                  Предметы загружаются из маркета. Каждый дроп — отдельный шанс.
                </p>
              </div>

              <div className="kd-cases-balance">
                <span>ТВОЙ БАЛАНС</span>
                <strong>{money(balanceNow)}</strong>
              </div>
            </header>

            {loading && (
              <div className="kd-cases-message">
                <span className="kd-loader" />
                <strong>ЗАГРУЖАЕМ МАРКЕТ</strong>
                <p>Получаем актуальные предметы и цены...</p>
              </div>
            )}

            {!loading && marketError && (
              <div className="kd-cases-message kd-cases-message-error">
                <strong>МАРКЕТ НЕДОСТУПЕН</strong>
                <p>{marketError}</p>
              </div>
            )}

            {!loading && !marketError && caseList.length > 0 && (
              <>
                <div className="kd-cases-market-status">
                  <span className="kd-live-dot" />
                  <span>МАРКЕТ ПОДКЛЮЧЁН</span>
                  <b>{market.length.toLocaleString("ru-RU")} предметов</b>
                </div>

                <section className="kd-cases-grid">
                  {caseList.map((item, index) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`kd-case-card kd-case-${item.accent}`}
                      onClick={() => enterCase(item)}
                    >
                      <span className="kd-case-topline">
                        <span>KOCH DROP</span>
                        <span>CASE / 0{index + 1}</span>
                      </span>

                      <span className="kd-case-art">
                        <span className="kd-case-art-ring" />
                        {item.cover ? (
                          extractImage(item.cover)
                        ) : (
                          <span className="kd-item-placeholder">✳</span>
                        )}
                        <span className="kd-case-art-label">
                          MARKET DROP
                        </span>
                      </span>

                      <span className="kd-case-info">
                        <strong>{item.name}</strong>
                        <small>
                          {item.items.length.toLocaleString("ru-RU")} предметов
                        </small>
                      </span>

                      <span className="kd-case-bottom">
                        <span className="kd-case-price">
                          {money(item.price)}
                        </span>
                        <span className="kd-case-open-icon">↗</span>
                      </span>
                    </button>
                  ))}
                </section>
              </>
            )}

            {history.length > 0 && (
              <section className="kd-cases-history">
                <div className="kd-cases-section-heading">
                  <div>
                    <span className="kd-cases-eyebrow">YOUR SESSION</span>
                    <h2>ПОСЛЕДНИЕ <em>ДРОПЫ</em></h2>
                  </div>
                </div>

                <div className="kd-history-grid">
                  {history.map((item) => (
                    <div className="kd-history-card" key={item.id}>
                      <span className="kd-history-image">
                        {extractImage(item)}
                      </span>

                      <span className="kd-history-info">
                        <strong>{nameOf(item)}</strong>
                        <small>{item.caseName}</small>
                      </span>

                      <b>{money(priceOf(item))}</b>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="kd-cases-back"
              onClick={backToCatalog}
            >
              <span>←</span> ВСЕ КЕЙСЫ
            </button>

            <header className="kd-cases-header kd-cases-detail-header">
              <div>
                <span className="kd-cases-eyebrow">
                  <i /> CASE OPENING / KOCH DROP
                </span>

                <h1>{currentCase.name}</h1>

                <p>
                  Стоимость открытия{" "}
                  <strong>{money(currentCase.price)}</strong>
                </p>
              </div>

              <div className="kd-cases-balance">
                <span>ТВОЙ БАЛАНС</span>
                <strong>{money(balanceNow)}</strong>
              </div>
            </header>

            <section className="kd-case-detail-panel">
              <div className="kd-case-detail-art">
                <span className="kd-detail-orbit" />
                <span className="kd-detail-orbit kd-detail-orbit-inner" />

                {currentCase.cover && extractImage(currentCase.cover)}

                <span className="kd-detail-stamp">KOCH DROP</span>
              </div>

              <div className="kd-case-detail-copy">
                <span className="kd-cases-eyebrow">READY TO OPEN</span>
                <h2>
                  ТВОЙ СЛЕДУЮЩИЙ <em>ДРОП</em>
                </h2>

                <p>
                  Внутри — предметы из маркета с их актуальными ценами.
                  После открытия ты сможешь забрать предмет в инвентарь
                  или продать его по указанной стоимости.
                </p>

                <div className="kd-detail-stats">
                  <div>
                    <span>ПРЕДМЕТОВ</span>
                    <strong>
                      {currentCase.items.length.toLocaleString("ru-RU")}
                    </strong>
                  </div>

                  <div>
                    <span>ЦЕНА КЕЙСА</span>
                    <strong>{money(currentCase.price)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="kd-open-button"
                  onClick={openCase}
                  disabled={
                    spinning ||
                    balanceNow < currentCase.price ||
                    !currentCase.items.length
                  }
                >
                  <span>
                    {spinning ? "ИДЁТ ОТКРЫТИЕ..." : "ОТКРЫТЬ КЕЙС"}
                  </span>
                  <b>
                    {money(currentCase.price)}
                    <i>↗</i>
                  </b>
                </button>

                {error && (
                  <p className="kd-cases-error" role="alert">
                    {error}
                  </p>
                )}

                <span className="kd-case-note">
                  <i /> Предметы и цены загружены из маркета
                </span>
              </div>
            </section>

            <section className="kd-roulette-section">
              <div className="kd-cases-section-heading">
                <div>
                  <span className="kd-cases-eyebrow">01 / ROULETTE</span>
                  <h2>
                    ЛЕНТА <em>ПРЕДМЕТОВ</em>
                  </h2>
                </div>

                <span className="kd-roulette-status">
                  <i />
                  {spinning ? "КРУТИТСЯ" : "ГОТОВА К ОТКРЫТИЮ"}
                </span>
              </div>

              <div className={`kd-roulette-window ${spinning ? "is-spinning" : ""}`}>
                <div className="kd-roulette-pointer">
                  <span />
                </div>

                <div className="kd-roulette-fade kd-roulette-fade-left" />
                <div className="kd-roulette-fade kd-roulette-fade-right" />

                {rollItems.length > 0 ? (
                  <div
                    className="kd-roulette-track"
                    style={{
                      transform: `translateX(calc(50% - ${rollIndex * 126 + 60}px))`,
                      transition: rollIndex
                        ? "transform 5s cubic-bezier(.08,.78,.12,1)"
                        : "none",
                    }}
                  >
                    {rollItems.map((item, index) => (
                      <div
                        className={`kd-roulette-item ${
                          index === WIN_INDEX ? "kd-roulette-winning" : ""
                        }`}
                        key={`${index}-${getItemKey(item)}`}
                      >
                        <span className="kd-roulette-image">
                          {extractImage(item)}
                        </span>

                        <span className="kd-roulette-name">
                          {nameOf(item)}
                        </span>

                        <b>{money(priceOf(item))}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="kd-roulette-empty">
                    <span>✳</span>
                    <strong>ГОТОВ К ОТКРЫТИЮ</strong>
                    <small>Нажми кнопку выше, чтобы запустить рулетку</small>
                  </div>
                )}
              </div>
            </section>

            <section className="kd-drop-section">
              <div className="kd-cases-section-heading">
                <div>
                  <span className="kd-cases-eyebrow">02 / MARKET ITEMS</span>
                  <h2>
                    ЧТО ВНУТРИ <em>КЕЙСА</em>
                  </h2>
                </div>

                <span className="kd-drop-total">
                  {drops.length.toLocaleString("ru-RU")} ПРЕДМЕТОВ
                </span>
              </div>

              <div className="kd-drop-list">
                <div className="kd-drop-list-head">
                  <span>ПРЕДМЕТ</span>
                  <span>РЕДКОСТЬ</span>
                  <span>ШАНС</span>
                  <span>ЦЕНА</span>
                </div>

                {drops.map((item, index) => (
                  <div
                    className="kd-drop-row"
                    key={`${getItemKey(item)}-${index}`}
                  >
                    <div className="kd-drop-name">
                      <span className="kd-drop-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <span className="kd-drop-art">
                        {extractImage(item)}
                      </span>

                      <strong title={nameOf(item)}>{nameOf(item)}</strong>
                    </div>

                    <span className={`kd-rarity kd-rarity-${getRarity(item)}`}>
                      {item.rarity || "Стандартная"}
                    </span>

                    <div className="kd-chance">
                      <b>
                        {item.probability < 0.1
                          ? item.probability.toFixed(3)
                          : item.probability.toFixed(2)}
                        %
                      </b>

                      <span>
                        <i
                          style={{
                            width: `${Math.min(100, item.probability)}%`,
                          }}
                        />
                      </span>
                    </div>

                    <strong className="kd-drop-price">
                      {money(priceOf(item))}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {result && !spinning && (
        <div className="kd-result-overlay">
          <section className="kd-result-modal" role="dialog" aria-modal="true">
            <span className="kd-cases-eyebrow">
              <i /> DROP CONFIRMED
            </span>

            <div className="kd-result-art">
              {extractImage(result.item)}
            </div>

            <span className="kd-result-label">ТЕБЕ ВЫПАЛО</span>
            <h2>{nameOf(result.item)}</h2>

            <strong className="kd-result-price">
              {money(priceOf(result.item))}
            </strong>

            <div className="kd-result-actions">
              <button
                type="button"
                className="kd-keep-button"
                onClick={keepResult}
              >
                В ИНВЕНТАРЬ <span>↗</span>
              </button>

              <button
                type="button"
                className="kd-sell-button"
                onClick={sellResult}
              >
                ПРОДАТЬ ЗА {money(priceOf(result.item))}
              </button>
            </div>

            <p>Кейс: {result.caseName}</p>
          </section>
        </div>
      )}
    </main>
  );
}