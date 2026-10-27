import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getMarketSkins } from "../lib/marketSkins";
import "./Contracts.css";

const MARKET_PAGE_SIZE = 10000;
const MAX_MARKET_PAGES = 20;
const MAX_CONTRACT_ITEMS = 10;
const MIN_CONTRACT_ITEMS = 3;

const ROULETTE_ITEMS_COUNT = 80;
const ROULETTE_WINNER_INDEX = 58;
const SPIN_DURATION = 6500;

function parsePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  let cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "");

  // Поддерживаем цены с запятой в качестве десятичного разделителя.
  if (/,\d{1,2}$/.test(cleaned) && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getItemPrice(item) {
  if (!item || typeof item !== "object") return 0;

  const fields = [
    item.price,
    item.cost,
    item.value,
    item.marketPrice,
    item.market_price,
    item.min_price,
    item.suggested_price,
    item.item_price,
    item.price_rub,
    item.steam_price,
  ];

  for (const value of fields) {
    const price = parsePrice(value);
    if (price > 0) return price;
  }

  return 0;
}

function getItemName(item) {
  if (!item || typeof item !== "object") return "Предмет";

  return (
    item.name ||
    item.market_hash_name ||
    item.marketHashName ||
    item.title ||
    item.skin_name ||
    item.item_name ||
    item.market_name ||
    "Предмет"
  );
}

function getItemImage(item) {
  if (!item || typeof item !== "object") return "/avatar.png";

  return (
    item.image ||
    item.item_image ||
    item.image_url ||
    item.icon_url ||
    item.icon_url_large ||
    item.img ||
    item.icon ||
    item.thumbnail ||
    item.market_image ||
    "/avatar.png"
  );
}

function normalizeItem(item, index = 0) {
  const name = getItemName(item);
  const image = getItemImage(item);
  const price = getItemPrice(item);

  return {
    ...item,
    id: item?.id ?? item?.assetid ?? `${name}-${price}-${index}`,
    name,
    image,
    item_image: image,
    price,
    cost: price,
  };
}

function formatPrice(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} ₽`;
}

/*
 * Для контракта стоимостью 1800 ₽:
 * минимум результата — 500 ₽;
 * максимум результата — 10 000 ₽.
 */
function getPayoutBounds(contractPrice) {
  const total = Math.max(0, Number(contractPrice) || 0);

  if (total <= 0) {
    return { min: 0, max: 0 };
  }

  const min = Math.min(10000, Math.max(1, Math.round(total / 3.6)));

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

function Contracts({
  inventory = [],
  setInventory,
  balance,
  setBalance,
  setPage,
}) {
  const [selected, setSelected] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [rouletteItems, setRouletteItems] = useState([]);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [rouletteKey, setRouletteKey] = useState(0);

  const [marketSkins, setMarketSkins] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [marketReload, setMarketReload] = useState(0);
  const [message, setMessage] = useState("");

  const trackRef = useRef(null);
  const wrapperRef = useRef(null);
  const startTimerRef = useRef(null);
  const animationRef = useRef(null);
  const resultTimerRef = useRef(null);

  const safeInventory = Array.isArray(inventory) ? inventory : [];

  // =========================================
  // ЗАГРУЗКА ПРЕДМЕТОВ С МАРКЕТА
  // =========================================

  useEffect(() => {
    let cancelled = false;

    async function loadMarket() {
      setMarketLoading(true);
      setMarketError("");
      setMarketSkins([]);

      try {
        const allItems = [];
        let start = 0;
        let total = 0;

        for (let page = 0; page < MAX_MARKET_PAGES; page += 1) {
          const data = await getMarketSkins({
            start,
            count: MARKET_PAGE_SIZE,
          });

          const batch = Array.isArray(data?.items) ? data.items : [];
          const reportedTotal = Number(data?.total);

          if (Number.isFinite(reportedTotal) && reportedTotal > 0) {
            total = reportedTotal;
          }

          if (batch.length === 0) break;

          allItems.push(...batch);
          start += batch.length;

          if (total > 0 && start >= total) break;

          if (batch.length < MARKET_PAGE_SIZE && total === 0) break;
        }

        const normalized = allItems
          .map((item, index) => normalizeItem(item, index))
          .filter((item) => item.name && item.price > 0);

        if (cancelled) return;

        setMarketSkins(normalized);

        if (normalized.length === 0) {
          setMarketError(
            "Маркет не вернул предметы с корректными ценами."
          );
        }
      } catch (error) {
        console.error("Ошибка загрузки маркета контрактов:", error);

        if (!cancelled) {
          setMarketError(
            error?.message || "Не удалось загрузить предметы с маркета."
          );
        }
      } finally {
        if (!cancelled) setMarketLoading(false);
      }
    }

    loadMarket();

    return () => {
      cancelled = true;
    };
  }, [marketReload]);

  // Очистка таймеров при уходе со страницы.
  useEffect(() => {
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (animationRef.current) clearTimeout(animationRef.current);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  // =========================================
  // ЦЕНА КОНТРАКТА И ДИАПАЗОН
  // =========================================

  const totalPrice = useMemo(
    () =>
      selected.reduce(
        (sum, item) => sum + getItemPrice(item),
        0
      ),
    [selected]
  );

  const payoutBounds = useMemo(
    () => getPayoutBounds(totalPrice),
    [totalPrice]
  );

  const eligibleMarketSkins = useMemo(() => {
    if (totalPrice <= 0) return [];

    return marketSkins.filter((item) => {
      const price = getItemPrice(item);

      return (
        price >= payoutBounds.min &&
        price <= payoutBounds.max
      );
    });
  }, [
    marketSkins,
    payoutBounds.min,
    payoutBounds.max,
    totalPrice,
  ]);

  // =========================================
  // XP ИВЕНТА
  // =========================================

  const addEventXP = (amount) => {
    if (amount <= 0) return;

    try {
      const oldXP = Number(localStorage.getItem("eventXP") || 0);
      const newXP = oldXP + amount;

      localStorage.setItem("eventXP", String(newXP));
      window.dispatchEvent(new window.Event("contracter-xp"));
    } catch (error) {
      console.error("Не удалось обновить XP:", error);
    }
  };

  // =========================================
  // ВЫБОР ПРЕДМЕТОВ
  // =========================================

  const addItem = (item, index) => {
    if (spinning || showResult) return;

    if (selected.length >= MAX_CONTRACT_ITEMS) {
      setMessage("В контракт можно добавить максимум 10 предметов.");
      return;
    }

    if (selected.some((entry) => entry.inventoryIndex === index)) {
      return;
    }

    const normalized = normalizeItem(item, index);

    if (normalized.price <= 0) {
      setMessage("У этого предмета не найдена корректная цена.");
      return;
    }

    setMessage("");

    setSelected((previous) => [
      ...previous,
      {
        ...normalized,
        inventoryIndex: index,
      },
    ]);
  };

  const removeItem = (selectedIndex) => {
    if (spinning || showResult) return;

    setSelected((previous) =>
      previous.filter((_, index) => index !== selectedIndex)
    );

    setMessage("");
  };

  const clearSelection = () => {
    if (spinning || showResult) return;

    setSelected([]);
    setMessage("");
  };

  // =========================================
  // ВЫБОР РЕЗУЛЬТАТА ИЗ МАРКЕТА
  // =========================================

  const chooseResult = () => {
    if (eligibleMarketSkins.length === 0) return null;

    const categories = [
      {
        weight: 70,
        items: eligibleMarketSkins.filter(
          (item) => item.price < totalPrice
        ),
      },
      {
        weight: 20,
        items: eligibleMarketSkins.filter(
          (item) =>
            item.price >= totalPrice &&
            item.price <= totalPrice * 1.5
        ),
      },
      {
        weight: 9,
        items: eligibleMarketSkins.filter(
          (item) =>
            item.price > totalPrice * 1.5 &&
            item.price <= totalPrice * 4
        ),
      },
      {
        weight: 1,
        items: eligibleMarketSkins.filter(
          (item) => item.price > totalPrice * 4
        ),
      },
    ].filter((category) => category.items.length > 0);

    if (categories.length === 0) {
      return pickRandom(eligibleMarketSkins);
    }

    // Если какой-то ценовой категории нет на маркете,
    // оставшиеся категории делят вероятность между собой.
    const weightSum = categories.reduce(
      (sum, category) => sum + category.weight,
      0
    );

    let roll = Math.random() * weightSum;

    for (const category of categories) {
      roll -= category.weight;

      if (roll < 0) {
        return pickRandom(category.items);
      }
    }

    return pickRandom(categories[categories.length - 1].items);
  };

  // =========================================
  // СОЗДАНИЕ РУЛЕТКИ
  // =========================================

  const createRoulette = (winningItem) => {
    const items = [];

    for (let index = 0; index < ROULETTE_ITEMS_COUNT; index += 1) {
      if (index === ROULETTE_WINNER_INDEX) {
        items.push(winningItem);
      } else {
        items.push(pickRandom(marketSkins) || winningItem);
      }
    }

    return {
      items,
      winnerIndex: ROULETTE_WINNER_INDEX,
    };
  };

  // =========================================
  // АНИМАЦИЯ РУЛЕТКИ
  // =========================================

  const startRoulette = (roulette, contractValue) => {
    const track = trackRef.current;
    const wrapper = wrapperRef.current;

    const finishSpin = () => {
      const winningItem = roulette.items[roulette.winnerIndex];

      setResult(winningItem);
      setSpinning(false);

      const earnedXP = Math.floor(contractValue / 10);

      if (earnedXP > 0) addEventXP(earnedXP);

      resultTimerRef.current = setTimeout(() => {
        setShowResult(true);
      }, 150);
    };

    if (!track || !wrapper) {
      finishSpin();
      return;
    }

    const winner = track.children[roulette.winnerIndex];

    if (!winner) {
      finishSpin();
      return;
    }

    // Сначала ставим рулетку ровно в исходную позицию.
    track.style.transition = "none";
    track.style.transform = "translateX(-50%)";

    // Принудительно применяем начальную позицию до измерения.
    void track.offsetWidth;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!trackRef.current || !wrapperRef.current) return;

        const currentWrapper = wrapperRef.current;
        const currentTrack = trackRef.current;
        const currentWinner =
          currentTrack.children[roulette.winnerIndex];

        if (!currentWinner) return;

        const wrapperRect = currentWrapper.getBoundingClientRect();
        const winnerRect = currentWinner.getBoundingClientRect();

        const wrapperCenter =
          wrapperRect.left + wrapperRect.width / 2;

        const winnerCenter =
          winnerRect.left + winnerRect.width / 2;

        // Смещение вычисляется по реальным координатам элементов.
        const offset = wrapperCenter - winnerCenter;
        const operator = offset >= 0 ? "+" : "-";

        currentTrack.style.transition =
          `transform ${SPIN_DURATION}ms cubic-bezier(0.08, 0.72, 0.12, 1)`;

        currentTrack.style.transform =
          `translateX(calc(-50% ${operator} ${Math.abs(offset)}px))`;
      });
    });

    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }

    animationRef.current = setTimeout(() => {
      finishSpin();
    }, SPIN_DURATION + 250);
  };

  // =========================================
  // СОЗДАНИЕ КОНТРАКТА
  // =========================================

  const createContract = () => {
    if (spinning || showResult) return;

    if (selected.length < MIN_CONTRACT_ITEMS) {
      setMessage("Для контракта нужно выбрать минимум 3 предмета.");
      return;
    }

    if (selected.length > MAX_CONTRACT_ITEMS) {
      setMessage("В контракт можно добавить максимум 10 предметов.");
      return;
    }

    if (totalPrice <= 0) {
      setMessage("Стоимость контракта должна быть больше нуля.");
      return;
    }

    if (marketLoading) {
      setMessage("Подожди, пока загрузится маркет.");
      return;
    }

    if (marketError) {
      setMessage("Не удалось загрузить маркет. Попробуй обновить его.");
      return;
    }

    if (eligibleMarketSkins.length === 0) {
      setMessage(
        `На маркете нет предметов от ${formatPrice(
          payoutBounds.min
        )} до ${formatPrice(payoutBounds.max)}.`
      );
      return;
    }

    const contractValue = totalPrice;
    const winningItem = chooseResult();

    if (!winningItem) {
      setMessage("Не удалось выбрать результат. Попробуй ещё раз.");
      return;
    }

    const roulette = createRoulette(winningItem);

    setMessage("");
    setResult(null);
    setShowResult(false);
    setRouletteItems(roulette.items);
    setRouletteKey((previous) => previous + 1);
    setSpinning(true);

    // Удаляем именно те предметы, которые были выбраны.
    const indexes = new Set(
      selected.map((item) => item.inventoryIndex)
    );

    const newInventory = safeInventory.filter(
      (_, index) => !indexes.has(index)
    );

    if (typeof setInventory === "function") {
      setInventory(newInventory);
    }

    setSelected([]);

    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
    }

    startTimerRef.current = setTimeout(() => {
      startRoulette(roulette, contractValue);
    }, 100);
  };

  // =========================================
  // СБРОС РЕЗУЛЬТАТА
  // =========================================

  const resetResult = () => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }

    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }

    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    setResult(null);
    setShowResult(false);
    setRouletteItems([]);
    setSelected([]);
    setSpinning(false);

    if (trackRef.current) {
      trackRef.current.style.transition = "none";
      trackRef.current.style.transform = "translateX(-50%)";
    }
  };

  // =========================================
  // ПРОДАЖА РЕЗУЛЬТАТА
  // =========================================

  const sellResult = () => {
    if (!result) return;

    const price = getItemPrice(result);

    if (typeof setBalance === "function") {
      setBalance((current) => (Number(current) || 0) + price);
    }

    resetResult();
  };

  // =========================================
  // ПЕРЕХОД В АПГРЕЙД
  // =========================================

  const upgradeResult = () => {
    if (!result) return;

    if (typeof setInventory === "function") {
      setInventory((current) => [
        ...(Array.isArray(current) ? current : []),
        result,
      ]);
    }

    resetResult();

    if (typeof setPage === "function") {
      setPage("upgrade");
    }
  };

  // =========================================
  // JSX
  // =========================================

  return (
    <div className="contracts-page">
      <div className="contracts-background" aria-hidden="true">
        <div className="blue-glow glow-one" />
        <div className="blue-glow glow-two" />
        <div className="blue-grid" />
      </div>

      <div className="contracts-content">
        <header className="contracts-header">
          <div className="contracts-title">
            <span>KOCH DROP · КОНТРАКТЫ</span>

            <h1>Создай свой контракт</h1>

            <p>
              Объедини минимум 3 предмета и получи новый скин с маркета.
            </p>
          </div>
        </header>

        <div className="contracts-layout single">
          <section className="contract-card">
            <div className="section-header">
              <div>
                <h2>Твой контракт</h2>

                <p>Выбери от 3 до 10 предметов</p>
              </div>

              <div className="counter">
                {selected.length}/10
              </div>
            </div>

            <div className="contract-slots">
              {Array.from({ length: MAX_CONTRACT_ITEMS }).map(
                (_, index) => {
                  const item = selected[index];

                  return (
                    <button
                      type="button"
                      key={index}
                      className={`contract-slot ${
                        item ? "has-item" : ""
                      }`}
                      onClick={() => {
                        if (item) removeItem(index);
                      }}
                      disabled={!item || spinning || showResult}
                      title={item ? "Убрать предмет" : "Пустой слот"}
                    >
                      {item ? (
                        <>
                          <img
                            src={getItemImage(item)}
                            alt={getItemName(item)}
                            onError={(event) => {
                              event.currentTarget.src = "/avatar.png";
                            }}
                          />

                          <span>{getItemName(item)}</span>

                          <b>{formatPrice(getItemPrice(item))}</b>
                        </>
                      ) : (
                        <div className="empty-slot">
                          <span>+</span>
                          <small>ПРЕДМЕТ</small>
                        </div>
                      )}
                    </button>
                  );
                }
              )}
            </div>

            <div className="contract-footer">
              <div className="contract-cost">
                <span>Стоимость контракта</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </div>

              <button
                type="button"
                className="create-contract"
                onClick={createContract}
                disabled={
                  selected.length < MIN_CONTRACT_ITEMS ||
                  spinning ||
                  showResult ||
                  marketLoading ||
                  Boolean(marketError) ||
                  eligibleMarketSkins.length === 0
                }
              >
                {spinning
                  ? "Открытие..."
                  : marketLoading
                  ? "Загрузка маркета..."
                  : selected.length < MIN_CONTRACT_ITEMS
                  ? `Нужно ещё ${MIN_CONTRACT_ITEMS - selected.length}`
                  : "Создать контракт"}
              </button>
            </div>

            <div
              className={`market-status ${
                marketLoading
                  ? "is-loading"
                  : marketError
                  ? "is-error"
                  : ""
              }`}
              role="status"
            >
              {marketLoading ? (
                <span>Загружаем предметы с маркета...</span>
              ) : marketError ? (
                <div className="market-error-content">
                  <span>{marketError}</span>

                  <button
                    type="button"
                    className="market-retry"
                    onClick={() =>
                      setMarketReload((previous) => previous + 1)
                    }
                  >
                    Повторить
                  </button>
                </div>
              ) : (
                <span>
                  Маркет загружен:{" "}
                  <strong>
                    {marketSkins.length.toLocaleString("ru-RU")}
                  </strong>{" "}
                  предметов
                  {totalPrice > 0 && (
                    <>
                      {" · "}Диапазон:{" "}
                      <strong>{formatPrice(payoutBounds.min)}</strong>
                      {" — "}
                      <strong>{formatPrice(payoutBounds.max)}</strong>
                      {" · "}Подходят:{" "}
                      <strong>
                        {eligibleMarketSkins.length.toLocaleString("ru-RU")}
                      </strong>
                    </>
                  )}
                </span>
              )}
            </div>

            {message && (
              <div className="contract-message" role="alert">
                {message}
              </div>
            )}
          </section>
        </div>

        {rouletteItems.length > 0 && (
          <section className="roulette-section">
            <div className="roulette-title">
              {spinning ? "КОНТРАКТ В ПРОЦЕССЕ" : "РЕЗУЛЬТАТ"}
            </div>

            <div className="roulette-wrapper" ref={wrapperRef}>
              <div className="roulette-pointer" aria-hidden="true" />

              <div
                key={rouletteKey}
                ref={trackRef}
                className="roulette-track"
              >
                {rouletteItems.map((item, index) => (
                  <div
                    className={`roulette-item ${
                      index === ROULETTE_WINNER_INDEX
                        ? "roulette-winner"
                        : ""
                    }`}
                    key={`${rouletteKey}-${index}`}
                  >
                    <img
                      src={getItemImage(item)}
                      alt={getItemName(item)}
                      onError={(event) => {
                        event.currentTarget.src = "/avatar.png";
                      }}
                    />

                    <span>{getItemName(item)}</span>

                    <b>{formatPrice(getItemPrice(item))}</b>
                  </div>
                ))}
              </div>
            </div>

            {spinning && (
              <div className="roulette-loading">
                Определяем результат...
              </div>
            )}
          </section>
        )}

        <section className="inventory-panel">
          <div className="section-header">
            <div>
              <h2>Инвентарь</h2>

              <p>
                Нажми на предмет, чтобы добавить его в контракт
              </p>
            </div>

            <div className="inventory-count">
              {safeInventory.length}
            </div>
          </div>

          {safeInventory.length === 0 ? (
            <div className="empty-inventory">
              <div className="empty-inventory-symbol">—</div>

              <p>В инвентаре пока нет предметов</p>
            </div>
          ) : (
            <div className="inventory-grid">
              {safeInventory.map((item, index) => {
                const normalized = normalizeItem(item, index);

                const isSelected = selected.some(
                  (entry) => entry.inventoryIndex === index
                );

                return (
                  <button
                    type="button"
                    className={`inventory-item ${
                      isSelected ? "inventory-item-selected" : ""
                    }`}
                    key={`${normalized.id}-${index}`}
                    onClick={() => addItem(item, index)}
                    disabled={
                      spinning ||
                      showResult ||
                      isSelected ||
                      selected.length >= MAX_CONTRACT_ITEMS
                    }
                    aria-pressed={isSelected}
                  >
                    <img
                      src={normalized.image}
                      alt={normalized.name}
                      onError={(event) => {
                        event.currentTarget.src = "/avatar.png";
                      }}
                    />

                    <span>{normalized.name}</span>

                    <b>{formatPrice(normalized.price)}</b>

                    {isSelected && (
                      <div className="inventory-selected">
                        В контракте
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showResult && result && (
        <div className="result-overlay">
          <div
            className="result-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contracts-result-title"
          >
            <div className="result-label">
              КОНТРАКТ ЗАВЕРШЁН
            </div>

            <h2 id="contracts-result-title">
              Тебе выпал предмет
            </h2>

            <div className="result-item">
              <div className="result-glow" />

              <img
                src={getItemImage(result)}
                alt={getItemName(result)}
                onError={(event) => {
                  event.currentTarget.src = "/avatar.png";
                }}
              />
            </div>

            <h3>{getItemName(result)}</h3>

            <div className="result-price">
              {formatPrice(getItemPrice(result))}
            </div>

            <div className="result-actions">
              <button
                type="button"
                className="sell-button"
                onClick={sellResult}
              >
                Продать
              </button>

              <button
                type="button"
                className="upgrade-button"
                onClick={upgradeResult}
              >
                В апгрейд
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contracts;