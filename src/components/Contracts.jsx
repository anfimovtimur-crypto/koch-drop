import { useEffect, useRef, useState } from "react";
import { getMarketSkins } from "../lib/marketSkins";
import "./Contracts.css";

const MARKET_COUNT = 500;
const MIN_CONTRACT_ITEMS = 3;
const MAX_CONTRACT_ITEMS = 10;
const ROULETTE_ITEMS_COUNT = 80;
const WINNER_INDEX = 58;
const SPIN_DURATION = 6500;

function parsePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value == null) return 0;

  let text = String(value)
    .replace(/[₽$€]/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!text) return 0;

  if (text.includes(",") && !text.includes(".")) {
    text = text.replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }

  text = text.replace(/[^\d.]/g, "");

  const result = Number(text);
  return Number.isFinite(result) ? result : 0;
}

function getItemPrice(item) {
  return parsePrice(
    item?.price ??
      item?.cost ??
      item?.value ??
      item?.marketPrice ??
      item?.market_price ??
      item?.price_rub ??
      item?.suggested_price ??
      item?.min_price ??
      0
  );
}

function getItemName(item) {
  return (
    item?.name ||
    item?.market_hash_name ||
    item?.item_name ||
    item?.marketName ||
    "Неизвестный предмет"
  );
}

function getItemImage(item) {
  const image =
    item?.image ||
    item?.item_image ||
    item?.img ||
    item?.image_url ||
    item?.icon_url ||
    item?.icon ||
    "";

  return typeof image === "string" ? image : "";
}

function normalizeItem(item, index = 0) {
  const price = getItemPrice(item);

  return {
    ...item,
    uid:
      item?.uid ||
      item?.id ||
      item?.market_hash_name ||
      `${getItemName(item)}-${price}-${index}`,
    name: getItemName(item),
    price,
    image: getItemImage(item),
  };
}

function extractMarketItems(response) {
  if (Array.isArray(response)) return response;

  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.skins)) return response.skins;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.skins)) return data.skins;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function formatPrice(value) {
  return `${(Number(value) || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })} ₽`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/*
 * Для контракта на 1800 ₽:
 * минимальная стоимость результата — 500 ₽,
 * максимальная — 10 000 ₽.
 */
function getPayoutBounds(contractPrice) {
  const total = Math.max(0, Number(contractPrice) || 0);

  if (total <= 0) {
    return { min: 0, max: 0 };
  }

  const min = Math.min(
    10000,
    Math.max(1, Math.round(total / 3.6))
  );

  const max = Math.max(
    min,
    Math.min(10000, Math.round((total / 1800) * 10000))
  );

  return { min, max };
}

function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return items[Math.floor(Math.random() * items.length)];
}

/*
 * Вероятности выбора категории результата:
 * 90% — предмет дешевле контракта;
 * 8% — примерно окупает контракт;
 * 1.8% — прибыль до x2;
 * 0.2% — редкий результат дороже x2.
 *
 * Если в выбранной категории нет подходящих предметов,
 * результат берётся из менее дорогой категории.
 * Отсутствие дорогих предметов не повышает их шанс.
 */
function chooseContractResult(market, contractPrice) {
  const bounds = getPayoutBounds(contractPrice);

  const eligible = market.filter((item) => {
    const price = getItemPrice(item);
    return price >= bounds.min && price <= bounds.max;
  });

  if (eligible.length === 0) return null;

  const cheap = eligible.filter(
    (item) => getItemPrice(item) < contractPrice
  );

  const breakEven = eligible.filter((item) => {
    const price = getItemPrice(item);
    return price >= contractPrice && price <= contractPrice * 1.25;
  });

  const profit = eligible.filter((item) => {
    const price = getItemPrice(item);
    return price > contractPrice * 1.25 && price <= contractPrice * 2;
  });

  const jackpot = eligible.filter(
    (item) => getItemPrice(item) > contractPrice * 2
  );

  const roll = Math.random() * 100;

  let preferredPools;

  if (roll < 90) {
    preferredPools = [cheap];
  } else if (roll < 98) {
    preferredPools = [breakEven, cheap];
  } else if (roll < 99.8) {
    preferredPools = [profit, breakEven, cheap];
  } else {
    preferredPools = [jackpot, profit, breakEven, cheap];
  }

  for (const pool of preferredPools) {
    const selected = pickRandom(pool);
    if (selected) return selected;
  }

  return [...eligible].sort(
    (a, b) => getItemPrice(a) - getItemPrice(b)
  )[0] || null;
}

function ContractItemImage({ item, className = "" }) {
  const image = getItemImage(item);

  return (
    <div className={`contract-item-image ${className}`}>
      {image ? (
        <img
          src={image}
          alt={getItemName(item)}
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
        />
      ) : (
        <span className="contract-image-placeholder">?</span>
      )}
    </div>
  );
}

export default function Contracts({
  inventory = [],
  setInventory,
  balance = 0,
  setBalance,
  setPage,
  addEventXp,
}) {
  const userInventory = Array.isArray(inventory) ? inventory : [];

  const [selectedIndices, setSelectedIndices] = useState([]);
  const [market, setMarket] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [marketAttempt, setMarketAttempt] = useState(0);

  const [contractError, setContractError] = useState("");
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [rouletteItems, setRouletteItems] = useState([]);
  const [spinOffset, setSpinOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const [result, setResult] = useState(null);

  const wrapperRef = useRef(null);
  const trackRef = useRef(null);
  const timerRef = useRef(null);

  const selectedEntries = selectedIndices
    .map((index) => ({
      index,
      item: userInventory[index],
    }))
    .filter((entry) => entry.item);

  const contractPrice = selectedEntries.reduce(
    (sum, entry) => sum + getItemPrice(entry.item),
    0
  );

  /*
   * Загружаем только одну порцию маркета.
   * Не загружаем десятки страниц подряд.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadMarket() {
      setMarketLoading(true);
      setMarketError("");

      try {
        const response = await getMarketSkins({
          start: 0,
          count: MARKET_COUNT,
        });

        if (cancelled) return;

        const rawItems = extractMarketItems(response);

        const seen = new Set();

        const normalized = rawItems
          .map((item, index) => normalizeItem(item, index))
          .filter((item) => {
            if (!item.name || item.price <= 0) return false;

            const key = `${item.name}-${item.price}`;

            if (seen.has(key)) return false;

            seen.add(key);
            return true;
          });

        setMarket(normalized);

        if (normalized.length === 0) {
          setMarketError(
            "Маркет не вернул предметы. Попробуй загрузить ещё раз."
          );
        }
      } catch (error) {
        console.error("Ошибка загрузки маркета контрактов:", error);

        if (!cancelled) {
          setMarketError("Не удалось загрузить предметы из маркета.");
        }
      } finally {
        if (!cancelled) {
          setMarketLoading(false);
        }
      }
    }

    loadMarket();

    return () => {
      cancelled = true;
    };
  }, [marketAttempt]);

  /*
   * Выставляем выигрышный предмет точно под указатель.
   */
  useEffect(() => {
    if (!spinning || !pendingResult || rouletteItems.length === 0) {
      return undefined;
    }

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const wrapper = wrapperRef.current;
        const track = trackRef.current;
        const winner = track?.children?.[WINNER_INDEX];

        if (!wrapper || !track || !winner) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        const winnerRect = winner.getBoundingClientRect();

        const wrapperCenter =
          wrapperRect.left + wrapperRect.width / 2;

        const winnerCenter =
          winnerRect.left + winnerRect.width / 2;

        setSpinOffset(wrapperCenter - winnerCenter);
      });
    });

    timerRef.current = window.setTimeout(() => {
      setSpinning(false);
      setRouletteOpen(false);
      setResult(pendingResult);
      setPendingResult(null);

      if (typeof addEventXp === "function") {
        const xp = Math.max(
          1,
          Math.floor(pendingResult.contractPrice / 100)
        );

        addEventXp(xp);
      }
    }, SPIN_DURATION + 200);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [spinning, pendingResult, rouletteItems, addEventXp]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function toggleInventoryItem(index) {
    if (spinning || rouletteOpen) return;

    setContractError("");

    setSelectedIndices((current) => {
      if (current.includes(index)) {
        return current.filter((value) => value !== index);
      }

      if (current.length >= MAX_CONTRACT_ITEMS) {
        setContractError(
          `В контракт можно добавить максимум ${MAX_CONTRACT_ITEMS} предметов.`
        );
        return current;
      }

      return [...current, index];
    });
  }

  function removeSelectedItem(index) {
    if (spinning) return;

    setSelectedIndices((current) =>
      current.filter((value) => value !== index)
    );

    setContractError("");
  }

  function clearContract() {
    if (spinning) return;

    setSelectedIndices([]);
    setContractError("");
  }

  function createContract() {
    if (spinning || rouletteOpen) return;

    setContractError("");
    setResult(null);

    if (selectedEntries.length < MIN_CONTRACT_ITEMS) {
      setContractError(
        `Добавь минимум ${MIN_CONTRACT_ITEMS} предмета.`
      );
      return;
    }

    if (selectedEntries.length > MAX_CONTRACT_ITEMS) {
      setContractError(
        `В контракт можно добавить максимум ${MAX_CONTRACT_ITEMS} предметов.`
      );
      return;
    }

    if (marketLoading) {
      setContractError("Подожди, пока загрузится маркет.");
      return;
    }

    if (market.length === 0) {
      setContractError(
        "Нет загруженных предметов для результата контракта."
      );
      return;
    }

    if (contractPrice <= 0) {
      setContractError("У выбранных предметов не указана цена.");
      return;
    }

    const chosenResult = chooseContractResult(market, contractPrice);

    if (!chosenResult) {
      const bounds = getPayoutBounds(contractPrice);

      setContractError(
        `В загруженной части маркета нет предметов от ${formatPrice(
          bounds.min
        )} до ${formatPrice(bounds.max)}. Нажми «Загрузить ещё».`
      );

      return;
    }

    const normalizedResult = {
      ...normalizeItem(chosenResult),
      uid: makeId(),
    };

    const selectedIndexSet = new Set(
      selectedEntries.map((entry) => entry.index)
    );

    /*
     * Предметы контракта расходуются сразу при создании.
     */
    if (typeof setInventory === "function") {
      setInventory((previous) => {
        const current = Array.isArray(previous) ? previous : [];

        return current.filter(
          (_, index) => !selectedIndexSet.has(index)
        );
      });
    }

    setSelectedIndices([]);
    setContractError("");

    const spinItems = Array.from(
      { length: ROULETTE_ITEMS_COUNT },
      (_, index) => {
        const randomItem = pickRandom(market) || normalizedResult;

        return {
          ...randomItem,
          rouletteId: `${index}-${makeId()}`,
        };
      }
    );

    spinItems[WINNER_INDEX] = {
      ...normalizedResult,
      rouletteId: `winner-${makeId()}`,
    };

    setPendingResult({
      item: normalizedResult,
      contractPrice,
    });

    setRouletteItems(spinItems);
    setSpinOffset(0);
    setRouletteOpen(true);
    setSpinning(true);
  }

  function sellResult() {
    if (!result?.item) return;

    if (typeof setBalance === "function") {
      const amount = getItemPrice(result.item);

      setBalance((previous) => (Number(previous) || 0) + amount);
    }

    setResult(null);
  }

  function upgradeResult() {
    if (!result?.item) return;

    if (typeof setInventory === "function") {
      const itemToKeep = {
        ...result.item,
        uid: result.item.uid || makeId(),
        price: getItemPrice(result.item),
      };

      setInventory((previous) => [
        ...(Array.isArray(previous) ? previous : []),
        itemToKeep,
      ]);
    }

    setResult(null);

    if (typeof setPage === "function") {
      setPage("upgrade");
    }
  }

  function retryMarket() {
    setMarket([]);
    setMarketError("");
    setMarketAttempt((value) => value + 1);
  }

  return (
    <main className="contracts-page">
      <div className="contracts-background" aria-hidden="true">
        <div className="blue-glow" />
        <div className="blue-grid" />
      </div>

      <div className="contracts-content">
        <header className="contracts-header">
          <div>
            <div className="contracts-eyebrow">
              <span className="contracts-eyebrow-dot" />
              KOCH DROP / CONTRACTS
            </div>

            <h1 className="contracts-title">
              КОНТРАКТЫ<span>.</span>
            </h1>

            <p className="contracts-description">
              Объедини предметы инвентаря и получи один новый предмет.
            </p>
          </div>

          <div className="contracts-balance">
            <span>ТВОЙ БАЛАНС</span>
            <strong>{formatPrice(balance)}</strong>
          </div>
        </header>

        <div className="contracts-layout single">
          <section className="contract-card">
            <div className="section-header">
              <div>
                <span className="section-kicker">01 / СОЗДАНИЕ</span>
                <h2>СОБЕРИ КОНТРАКТ</h2>
                <p>Выбери от 3 до 10 предметов из инвентаря.</p>
              </div>

              <div className="counter">
                <strong>{selectedEntries.length}</strong>
                <span> / {MAX_CONTRACT_ITEMS}</span>
              </div>
            </div>

            <div className="contract-slots">
              {Array.from(
                { length: MAX_CONTRACT_ITEMS },
                (_, slotIndex) => {
                  const entry = selectedEntries[slotIndex];

                  if (!entry) {
                    return (
                      <div
                        className="contract-slot empty-slot"
                        key={`empty-${slotIndex}`}
                      >
                        <span className="slot-plus">+</span>
                        <span className="slot-number">
                          {String(slotIndex + 1).padStart(2, "0")}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      type="button"
                      className="contract-slot filled-slot"
                      key={`selected-${entry.index}`}
                      onClick={() => removeSelectedItem(entry.index)}
                      disabled={spinning}
                      title="Нажми, чтобы убрать предмет из контракта"
                    >
                      <span className="slot-remove">×</span>

                      <ContractItemImage item={entry.item} />

                      <span className="slot-item-name">
                        {getItemName(entry.item)}
                      </span>

                      <strong className="slot-item-price">
                        {formatPrice(getItemPrice(entry.item))}
                      </strong>
                    </button>
                  );
                }
              )}
            </div>

            <div className="contract-footer">
              <div className="contract-cost">
                <span>СТОИМОСТЬ КОНТРАКТА</span>
                <strong>{formatPrice(contractPrice)}</strong>
                <small>
                  {selectedEntries.length < MIN_CONTRACT_ITEMS
                    ? `Нужно ещё ${
                        MIN_CONTRACT_ITEMS - selectedEntries.length
                      } предмета`
                    : `${selectedEntries.length} предметов выбрано`}
                </small>
              </div>

              <div className="contract-buttons">
                <button
                  type="button"
                  className="clear-contract"
                  onClick={clearContract}
                  disabled={selectedEntries.length === 0 || spinning}
                >
                  СБРОСИТЬ
                </button>

                <button
                  type="button"
                  className="create-contract"
                  onClick={createContract}
                  disabled={
                    spinning ||
                    rouletteOpen ||
                    selectedEntries.length < MIN_CONTRACT_ITEMS ||
                    selectedEntries.length > MAX_CONTRACT_ITEMS ||
                    marketLoading
                  }
                >
                  {marketLoading
                    ? "ЗАГРУЗКА МАРКЕТА..."
                    : "СОЗДАТЬ КОНТРАКТ"}
                  <span>↗</span>
                </button>
              </div>
            </div>

            {contractError && (
              <div className="contract-message error-message" role="alert">
                {contractError}
              </div>
            )}

            <div className="market-status" aria-live="polite">
              <span
                className={`market-status-dot ${
                  marketLoading
                    ? "loading"
                    : marketError
                    ? "error"
                    : "ready"
                }`}
              />

              <div className="market-status-text">
                <strong>
                  {marketLoading
                    ? "Загружаем предметы"
                    : marketError
                    ? "Маркет недоступен"
                    : "Маркет готов"}
                </strong>

                <span>
                  {marketLoading
                    ? "Загружается одна порция предметов."
                    : marketError
                    ? marketError
                    : `Загружено предметов: ${market.length}`}
                </span>
              </div>

              {!marketLoading && marketError && (
                <button
                  type="button"
                  className="market-retry"
                  onClick={retryMarket}
                >
                  ПОВТОРИТЬ
                </button>
              )}
            </div>
          </section>

          <section className="inventory-panel">
            <div className="section-header inventory-header">
              <div>
                <span className="section-kicker">02 / ТВОИ ПРЕДМЕТЫ</span>
                <h2>ИНВЕНТАРЬ</h2>
                <p>Нажимай на предметы, чтобы добавить их в контракт.</p>
              </div>

              <div className="inventory-count">
                {userInventory.length}
                <span> предметов</span>
              </div>
            </div>

            {userInventory.length === 0 ? (
              <div className="empty-inventory">
                <div className="empty-inventory-icon">＋</div>
                <strong>ИНВЕНТАРЬ ПУСТ</strong>
                <p>
                  Сначала получи предметы из кейсов — потом сможешь
                  использовать их в контрактах.
                </p>
              </div>
            ) : (
              <div className="inventory-grid">
                {userInventory.map((item, index) => {
                  const selected = selectedIndices.includes(index);

                  return (
                    <button
                      type="button"
                      className={`inventory-item ${
                        selected ? "inventory-selected" : ""
                      }`}
                      key={`${item?.uid || item?.id || getItemName(item)}-${index}`}
                      onClick={() => toggleInventoryItem(index)}
                      disabled={spinning || rouletteOpen}
                      aria-pressed={selected}
                    >
                      <span className="inventory-item-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      {selected && (
                        <span className="inventory-selected-mark">✓</span>
                      )}

                      <ContractItemImage item={item} />

                      <span className="inventory-item-name">
                        {getItemName(item)}
                      </span>

                      <strong className="inventory-item-price">
                        {formatPrice(getItemPrice(item))}
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {rouletteOpen && (
        <div className="roulette-overlay">
          <section
            className="roulette-section"
            role="dialog"
            aria-modal="true"
            aria-label="Рулетка контракта"
          >
            <div className="roulette-modal-header">
              <div>
                <span className="section-kicker">03 / РЕЗУЛЬТАТ</span>
                <h2>{spinning ? "КОНТРАКТ СОЗДАЁТСЯ" : "КОНТРАКТ"}</h2>
                <p>Предмет под жёлтым указателем станет результатом.</p>
              </div>

              <div className="roulette-live-status">
                <span className={spinning ? "status-pulse" : ""} />
                {spinning ? "КРУТИТСЯ" : "ГОТОВО"}
              </div>
            </div>

            <div className="roulette-wrapper" ref={wrapperRef}>
              <div className="roulette-pointer" aria-hidden="true">
                <span />
              </div>

              <div
                className="roulette-track"
                ref={trackRef}
                style={{
                  transform: `translateX(${spinOffset}px)`,
                  transition: spinning
                    ? `transform ${SPIN_DURATION}ms cubic-bezier(0.08, 0.72, 0.12, 1)`
                    : "none",
                }}
              >
                {rouletteItems.map((item, index) => (
                  <div
                    className={`roulette-item ${
                      index === WINNER_INDEX ? "roulette-winning-item" : ""
                    }`}
                    key={item.rouletteId}
                  >
                    <ContractItemImage item={item} />

                    <span className="roulette-item-name">
                      {getItemName(item)}
                    </span>

                    <strong>{formatPrice(getItemPrice(item))}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="roulette-modal-footer">
              <span>KOCH DROP CONTRACTS</span>
              <span>
                {spinning ? "НЕ ЗАКРЫВАЙ ОКНО" : "ЗАВЕРШЕНО"}
              </span>
            </div>
          </section>
        </div>
      )}

      {result && (
        <div className="result-overlay">
          <section
            className="result-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contract-result-title"
          >
            <span className="result-label">КОНТРАКТ ЗАВЕРШЁН</span>

            <h2 id="contract-result-title">ТВОЙ РЕЗУЛЬТАТ</h2>

            <div className="result-item">
              <ContractItemImage item={result.item} />

              <strong className="result-item-name">
                {getItemName(result.item)}
              </strong>

              <strong className="result-price">
                {formatPrice(getItemPrice(result.item))}
              </strong>
            </div>

            <div className="result-contract-info">
              <span>Стоимость контракта</span>
              <strong>{formatPrice(result.contractPrice)}</strong>
            </div>

            <div className="result-actions">
              <button
                type="button"
                className="sell-button"
                onClick={sellResult}
              >
                ПРОДАТЬ ЗА {formatPrice(getItemPrice(result.item))}
              </button>

              <button
                type="button"
                className="upgrade-button"
                onClick={upgradeResult}
              >
                В АПГРЕЙД <span>↗</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}