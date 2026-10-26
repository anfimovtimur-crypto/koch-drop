import { useEffect, useState } from "react";
import { getMarketSkins } from "../lib/marketSkins";
import { supabase } from "../lib/supabase";
import "./Upgrade.css";

function getPrice(item) {
  return Number(
    item?.price ??
      item?.cost ??
      item?.value ??
      item?.marketPrice ??
      0
  );
}

function createUid() {
  return (
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

function getSkinTypeLabel(type = "") {
  const value = String(type).toLowerCase();

  if (value.includes("pistol")) return "Пистолеты";
  if (value.includes("smg")) return "SMG";
  if (value.includes("sniper")) return "Снайперки";
  if (value.includes("shotgun")) return "Дробовики";
  if (value.includes("machinegun")) return "Пулемёты";
  if (value.includes("knife")) return "Ножи";
  if (value.includes("hands") || value.includes("gloves")) return "Перчатки";
  if (value.includes("rifle")) return "Винтовки";

  return "Другое";
}

function sortSkins(items, sort) {
  const result = [...items];

  if (sort === "price-asc") {
    result.sort((a, b) => getPrice(a) - getPrice(b));
  }

  if (sort === "price-desc") {
    result.sort((a, b) => getPrice(b) - getPrice(a));
  }

  if (sort === "name-asc") {
    result.sort((a, b) =>
      String(a?.name || "").localeCompare(
        String(b?.name || ""),
        "ru"
      )
    );
  }

  if (sort === "name-desc") {
    result.sort((a, b) =>
      String(b?.name || "").localeCompare(
        String(a?.name || ""),
        "ru"
      )
    );
  }

  return result;
}

function getDisplayChance(sourcePrice, targetPrice) {
  if (sourcePrice <= 0 || targetPrice <= sourcePrice) {
    return 0;
  }

  return Math.min(
    95,
    Math.max(
      1,
      Math.round((sourcePrice / targetPrice) * 77)
    )
  );
}

function getRealChance(displayChance) {
  if (displayChance <= 30) {
    return Math.max(3, Math.round(displayChance * 0.55));
  }

  if (displayChance <= 40) {
    return Math.max(4, Math.round(displayChance * 0.6));
  }

  if (displayChance <= 50) {
    return 25;
  }

  if (displayChance <= 60) {
    return 30;
  }

  if (displayChance <= 70) {
    return 35;
  }

  return Math.max(5, Math.round(displayChance * 0.5));
}

function trackUpgradeMultiplier(multiplier) {
  if (!multiplier) return;

  try {
    const saved = localStorage.getItem("koch_upgrade_stats");

    const stats = saved
      ? JSON.parse(saved)
      : {
          2: 0,
          3: 0,
          5: 0,
          10: 0,
        };

    stats[multiplier] = Number(stats[multiplier] || 0) + 1;

    localStorage.setItem(
      "koch_upgrade_stats",
      JSON.stringify(stats)
    );

    window.dispatchEvent(new Event("koch-upgrade-stats"));
  } catch (error) {
    console.error("Ошибка статистики множителя:", error);
  }
}

function saveTopUpgradeDrop(item) {
  if (!item) return;

  const price = Number(
    item.price ??
      item.value ??
      item.cost ??
      item.marketPrice ??
      0
  );

  if (!Number.isFinite(price) || price <= 0) return;

  try {
    const saved = localStorage.getItem("koch_top_upgrade_drop");
    const oldDrop = saved ? JSON.parse(saved) : null;
    const oldPrice = Number(oldDrop?.price || 0);

    if (!oldDrop || price > oldPrice) {
      const data = {
        name:
          item.name ||
          item.item_name ||
          item.title ||
          "Предмет",
        image:
          item.image ||
          item.item_image ||
          item.img ||
          "/avatar.png",
        price,
      };

      localStorage.setItem(
        "koch_top_upgrade_drop",
        JSON.stringify(data)
      );

      window.dispatchEvent(new Event("koch-top-upgrade-drop"));
    }
  } catch (error) {
    console.error("Ошибка сохранения Top Drop:", error);
  }
}

function Upgrade({
  balance = 0,
  setBalance,
  inventory = [],
  setInventory,
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedMultiplier, setSelectedMultiplier] = useState(null);

  const [tab, setTab] = useState("inventory");

  const [displayChance, setDisplayChance] = useState(0);
  const [realChance, setRealChance] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const [market, setMarket] = useState([]);
  const [marketStart, setMarketStart] = useState(0);
  const [marketTotal, setMarketTotal] = useState(0);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);

  const [marketSearch, setMarketSearch] = useState("");
  const [marketType, setMarketType] = useState("all");
  const [marketSort, setMarketSort] = useState("price-asc");

  const [targetSearch, setTargetSearch] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetSort, setTargetSort] = useState("price-asc");

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const items = Array.isArray(inventory) ? inventory : [];
  const currentBalance = Number(balance) || 0;

  useEffect(() => {
    loadMarketSkins(true);
  }, []);

  // Автоматически загружаем каталог партиями по 1000 предметов.
  async function loadMarketSkins(firstLoad = false) {
    if (marketLoadingMore) return;

    if (firstLoad) {
      setMarketLoading(true);
    }

    setMarketLoadingMore(true);

    try {
      const batchSize = 1000;
      let start = firstLoad ? 0 : marketStart;
      let total = firstLoad ? 0 : marketTotal;

      const collected = firstLoad ? [] : [...market];
      const unique = new Map();

      for (const item of collected) {
        const key =
          item?.market_hash_name ||
          item?.id ||
          item?.name;

        if (key) unique.set(key, item);
      }

      let requests = 0;

      while (requests < 10000) {
        const data = await getMarketSkins({
          start,
          count: batchSize,
        });

        const newItems = Array.isArray(data?.items)
          ? data.items
          : [];

        total = Number(data?.total || total || 0);

        if (newItems.length === 0) break;

        for (const item of newItems) {
          const key =
            item?.market_hash_name ||
            item?.id ||
            item?.name;

          if (key) unique.set(key, item);
        }

        const returned =
          Number(data?.returned) > 0
            ? Number(data.returned)
            : newItems.length;

        if (returned <= 0) break;

        start += returned;
        requests += 1;

        const currentItems = Array.from(unique.values());

        setMarket(currentItems);
        setMarketStart(start);
        setMarketTotal(total);

        if (total > 0 && start >= total) break;
      }

      setMarket(Array.from(unique.values()));
      setMarketStart(start);
      setMarketTotal(total);
    } catch (error) {
      console.error("Ошибка загрузки Market:", error);
    } finally {
      setMarketLoading(false);
      setMarketLoadingMore(false);
    }
  }

  const filteredMarket = sortSkins(
    market.filter((item) => {
      const search = marketSearch.trim().toLowerCase();

      const name = String(
        item?.name ||
          item?.market_hash_name ||
          ""
      ).toLowerCase();

      const matchesSearch = !search || name.includes(search);

      const matchesType =
        marketType === "all" ||
        getSkinTypeLabel(item?.type) === marketType;

      return matchesSearch && matchesType;
    }),
    marketSort
  );

  const filteredTargetMarket = sortSkins(
    market.filter((item) => {
      const search = targetSearch.trim().toLowerCase();

      const name = String(
        item?.name ||
          item?.market_hash_name ||
          ""
      ).toLowerCase();

      const matchesSearch = !search || name.includes(search);

      const matchesType =
        targetType === "all" ||
        getSkinTypeLabel(item?.type) === targetType;

      return matchesSearch && matchesType;
    }),
    targetSort
  );

  function resetSelection() {
    if (spinning) return;

    setSelectedItem(null);
    setSelectedInventoryIndex(null);
    setSelectedTarget(null);
    setSelectedMultiplier(null);
    setDisplayChance(0);
    setRealChance(0);
    setResult(null);
  }

  function chooseItem(item, index) {
    if (spinning) return;

    const preparedItem = {
      ...item,
      uid: item?.uid || createUid(),
    };

    if (!item?.uid && typeof setInventory === "function") {
      setInventory((prev) => {
        const current = Array.isArray(prev) ? prev : [];

        return current.map((currentItem, currentIndex) =>
          currentIndex === index ? preparedItem : currentItem
        );
      });
    }

    setSelectedItem(preparedItem);
    setSelectedInventoryIndex(index);
    setSelectedTarget(null);
    setSelectedMultiplier(null);
    setDisplayChance(0);
    setRealChance(0);
    setResult(null);
  }

  function chooseTarget(item, multiplier = null) {
    if (spinning || !selectedItem) return;

    const sourcePrice = getPrice(selectedItem);
    const targetPrice = getPrice(item);

    if (sourcePrice <= 0 || targetPrice <= sourcePrice) return;

    const nextDisplayChance = getDisplayChance(
      sourcePrice,
      targetPrice
    );

    const nextRealChance = getRealChance(nextDisplayChance);

    setSelectedTarget({
      ...item,
      uid: item?.uid || createUid(),
      price: targetPrice,
    });

    setSelectedMultiplier(multiplier);
    setDisplayChance(nextDisplayChance);
    setRealChance(nextRealChance);
    setResult(null);
  }

  function chooseMultiplier(multiplier) {
    if (spinning || !selectedItem) return;

    const sourcePrice = getPrice(selectedItem);

    if (sourcePrice <= 0) return;

    const wantedPrice = sourcePrice * multiplier;

    const possibleTargets = market.filter(
      (item) => getPrice(item) > sourcePrice
    );

    if (possibleTargets.length === 0) return;

    const closestTarget = [...possibleTargets].sort((a, b) => {
      const differenceA = Math.abs(
        getPrice(a) - wantedPrice
      );

      const differenceB = Math.abs(
        getPrice(b) - wantedPrice
      );

      return differenceA - differenceB;
    })[0];

    if (!closestTarget) return;

    chooseTarget(closestTarget, multiplier);
  }

  function addToCart(item) {
    if (spinning || !item) return;

    setCart((current) => {
      const key =
        item?.market_hash_name ||
        item?.id ||
        item?.name;

      if (
        current.some(
          (cartItem) =>
            (cartItem?.market_hash_name ||
              cartItem?.id ||
              cartItem?.name) === key
        )
      ) {
        return current;
      }

      return [...current, item];
    });
  }

  function removeFromCart(item) {
    const key =
      item?.market_hash_name ||
      item?.id ||
      item?.name;

    setCart((current) =>
      current.filter(
        (cartItem) =>
          (cartItem?.market_hash_name ||
            cartItem?.id ||
            cartItem?.name) !== key
      )
    );
  }

  function buySkin(item) {
    if (spinning) return;

    const price = getPrice(item);

    if (price <= 0) return;
    if (currentBalance < price) return;

    if (typeof setBalance === "function") {
      setBalance((prev) => Number(prev || 0) - price);
    }

    if (typeof setInventory === "function") {
      setInventory((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        {
          ...item,
          uid: createUid(),
          price,
        },
      ]);
    }
  }

  function buyCart() {
    if (spinning || cart.length === 0) return;

    const totalPrice = cart.reduce(
      (sum, item) => sum + getPrice(item),
      0
    );

    if (totalPrice <= 0 || currentBalance < totalPrice) return;

    if (typeof setBalance === "function") {
      setBalance((prev) => Number(prev || 0) - totalPrice);
    }

    if (typeof setInventory === "function") {
      setInventory((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        ...cart.map((item) => ({
          ...item,
          uid: createUid(),
          price: getPrice(item),
        })),
      ]);
    }

    setCart([]);
    setCartOpen(false);
  }

  function startUpgrade() {
    if (spinning || !selectedItem || !selectedTarget) return;

    const sourcePrice = getPrice(selectedItem);
    const targetPrice = getPrice(selectedTarget);

    if (sourcePrice <= 0 || targetPrice <= sourcePrice) return;

    const chance = getRealChance(
      getDisplayChance(sourcePrice, targetPrice)
    );

    setRealChance(chance);
    setSpinning(true);
    setResult(null);

    const won = Math.random() * 100 < chance;
    const duration = 10000;

    setRotation((current) => current + 360 * 10 + Math.random() * 360);

    window.setTimeout(() => {
      if (won) {
        saveTopUpgradeDrop(selectedTarget);

        if (selectedMultiplier) {
          trackUpgradeMultiplier(selectedMultiplier);
        }
      }

      if (typeof setInventory === "function") {
        setInventory((prev) => {
          const current = Array.isArray(prev) ? [...prev] : [];

          const index = selectedInventoryIndex;

          if (
            index !== null &&
            index >= 0 &&
            index < current.length
          ) {
            current.splice(index, 1);
          }

          if (won) {
            current.push({
              ...selectedTarget,
              uid: createUid(),
              price: targetPrice,
            });
          }

          return current;
        });
      }

      setResult({
        won,
        item: selectedTarget,
      });

      setSpinning(false);
    }, duration);
  }

  function sellResult() {
    if (!result?.won) return;

    const price = getPrice(result.item);

    if (typeof setBalance === "function") {
      setBalance((prev) => Number(prev || 0) + price);
    }

    if (typeof setInventory === "function") {
      setInventory((prev) => {
        const current = Array.isArray(prev) ? [...prev] : [];

        return current.filter(
          (item) => item.uid !== result.item.uid
        );
      });
    }

    setResult(null);
    resetSelection();
  }

  function keepResult() {
    setResult(null);
    resetSelection();
  }

  function closeResult() {
    setResult(null);
    resetSelection();
  }

  const filterInputStyle = {
    background: "#111",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "10px 12px",
    outline: "none",
  };

  const filterSelectStyle = {
    ...filterInputStyle,
    cursor: "pointer",
  };

  const loadMoreButtonStyle = {
    display: "none",
  };

  return (
    <div className="upgrade-page">
      {/* Верхняя панель апгрейда */}
      <div className="upgrade-top">
        <div className="upgrade-heading">
          <h1>UPGRADE</h1>
          <p>Выбирай предмет и пробуй получить скин дороже</p>
        </div>

        <div className="upgrade-balance">
          Баланс: <strong>{currentBalance.toLocaleString("ru-RU")} ₽</strong>
        </div>
      </div>

      {/* Выбор исходного предмета и цели */}
      <div className="upgrade-main">
        <div className="upgrade-selected-item">
          <h2>ТВОЙ ПРЕДМЕТ</h2>

          {selectedItem ? (
            <div className="selected-card">
              <button
                type="button"
                className="selected-clear"
                onClick={resetSelection}
                disabled={spinning}
              >
                ×
              </button>

              <img
                src={selectedItem.image || selectedItem.item_image || "/avatar.png"}
                alt={selectedItem.name || "Предмет"}
              />

              <strong>
                {selectedItem.name || selectedItem.market_hash_name}
              </strong>

              <span>
                {getPrice(selectedItem).toLocaleString("ru-RU")} ₽
              </span>
            </div>
          ) : (
            <div className="selected-card empty">
              <span>Выбери предмет из инвентаря ниже</span>
            </div>
          )}
        </div>

        <div className="upgrade-center">
          <div className="upgrade-chance">
            ШАНС: <strong>{displayChance}%</strong>
          </div>

          <div className="upgrade-wheel">
            <div
              className="upgrade-wheel-ring"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? "transform 10s cubic-bezier(0.12, 0.75, 0.08, 1)"
                  : "none",
              }}
            />

            <div className="upgrade-wheel-pointer" />

            <div className="upgrade-wheel-center">
              <img src="/upgrade-center.png" alt="Koch Drop" />
            </div>
          </div>

          <div className="upgrade-multipliers">
            {[2, 3, 5, 10].map((multiplier) => (
              <button
                type="button"
                key={multiplier}
                className={
                  selectedMultiplier === multiplier
                    ? "multiplier-button active"
                    : "multiplier-button"
                }
                disabled={!selectedItem || spinning}
                onClick={() => chooseMultiplier(multiplier)}
              >
                x{multiplier}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="upgrade-button"
            disabled={!selectedItem || !selectedTarget || spinning}
            onClick={startUpgrade}
          >
            {spinning ? "АПГРЕЙД..." : "УЛУЧШИТЬ"}
          </button>

          {selectedTarget && !spinning && (
            <div className="upgrade-target-info">
              Цель: {getPrice(selectedTarget).toLocaleString("ru-RU")} ₽
            </div>
          )}
        </div>

        <div className="upgrade-selected-target">
          <h2>ВЫБЕРИ ЦЕЛЬ</h2>

          {selectedTarget ? (
            <div className="selected-card">
              <button
                type="button"
                className="selected-clear"
                onClick={() => {
                  setSelectedTarget(null);
                  setSelectedMultiplier(null);
                  setDisplayChance(0);
                  setRealChance(0);
                }}
                disabled={spinning}
              >
                ×
              </button>

              <img
                src={selectedTarget.image || selectedTarget.item_image || "/avatar.png"}
                alt={selectedTarget.name || "Цель"}
              />

              <strong>
                {selectedTarget.name || selectedTarget.market_hash_name}
              </strong>

              <span>
                {getPrice(selectedTarget).toLocaleString("ru-RU")} ₽
              </span>
            </div>
          ) : (
            <div className="selected-card empty">
              <span>Выбери цель в списке ниже</span>
            </div>
          )}
        </div>
      </div>

      {/* Переключение инвентаря и рынка */}
      <div className="upgrade-tabs">
        <button
          type="button"
          className={tab === "inventory" ? "active" : ""}
          onClick={() => setTab("inventory")}
        >
          ИНВЕНТАРЬ
        </button>

        <button
          type="button"
          className={tab === "market" ? "active" : ""}
          onClick={() => setTab("market")}
        >
          МАРКЕТ
        </button>
      </div>

      <div className="upgrade-selection-area">
        {/* Левая панель */}
        <div className="selection-panel">
          <div className="selection-header">
            <div>
              <h2>
                {tab === "inventory" ? "ТВОЙ ИНВЕНТАРЬ" : "МАРКЕТ"}
              </h2>

              <span>
                {tab === "inventory"
                  ? `Предметов: ${items.length}`
                  : `Загружено: ${market.length.toLocaleString("ru-RU")}${
                      marketTotal
                        ? ` / ${marketTotal.toLocaleString("ru-RU")}`
                        : ""
                    }`}
              </span>
            </div>

            <div className="market-label">
              {tab === "inventory" ? "МОИ ПРЕДМЕТЫ" : "ВСЕ СКИНЫ"}
            </div>
          </div>

          {tab === "inventory" ? (
            <div className="selection-grid">
              {items.map((item, index) => (
                <button
                  type="button"
                  key={item.uid || `${item.name}-${index}`}
                  className={
                    selectedItem?.uid === item.uid
                      ? "selection-item chosen"
                      : "selection-item"
                  }
                  disabled={spinning}
                  onClick={() => chooseItem(item, index)}
                >
                  <img
                    src={item.image || item.item_image || "/avatar.png"}
                    alt={item.name || "Предмет"}
                  />

                  <span>{item.name || item.market_hash_name}</span>

                  <strong>
                    {getPrice(item).toLocaleString("ru-RU")} ₽
                  </strong>
                </button>
              ))}

              {items.length === 0 && (
                <div className="empty-selection">
                  Инвентарь пуст. Купи предмет на маркете.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="selection-filters">
                <input
                  type="text"
                  value={marketSearch}
                  onChange={(event) => setMarketSearch(event.target.value)}
                  placeholder="Поиск скина..."
                  style={filterInputStyle}
                />

                <select
                  value={marketType}
                  onChange={(event) => setMarketType(event.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="all">Все типы</option>
                  <option value="Пистолеты">Пистолеты</option>
                  <option value="SMG">SMG</option>
                  <option value="Винтовки">Винтовки</option>
                  <option value="Снайперки">Снайперки</option>
                  <option value="Дробовики">Дробовики</option>
                  <option value="Пулемёты">Пулемёты</option>
                  <option value="Ножи">Ножи</option>
                  <option value="Перчатки">Перчатки</option>
                  <option value="Другое">Другое</option>
                </select>

                <select
                  value={marketSort}
                  onChange={(event) => setMarketSort(event.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="price-asc">Цена: по возрастанию</option>
                  <option value="price-desc">Цена: по убыванию</option>
                  <option value="name-asc">Название: А → Я</option>
                  <option value="name-desc">Название: Я → А</option>
                </select>
              </div>

              {marketLoading ? (
                <div className="empty-selection">
                  Загружаем весь каталог скинов...
                </div>
              ) : (
                <div className="selection-grid">
                  {filteredMarket.map((item, index) => {
                    const price = getPrice(item);
                    const canBuy = currentBalance >= price;

                    const cartKey =
                      item?.market_hash_name ||
                      item?.id ||
                      item?.name;

                    const inCart = cart.some(
                      (cartItem) =>
                        (cartItem?.market_hash_name ||
                          cartItem?.id ||
                          cartItem?.name) === cartKey
                    );

                    return (
                      <div
                        className="selection-item"
                        key={
                          item?.market_hash_name ||
                          item?.id ||
                          `${item?.name}-${index}`
                        }
                      >
                        <img
                          src={item.image || "/avatar.png"}
                          alt={item.name}
                          loading="lazy"
                        />

                        <span>{item.name}</span>

                        <strong>
                          {price.toLocaleString("ru-RU")} ₽
                        </strong>

                        <button
                          type="button"
                          className="inventory-buy-button"
                          disabled={spinning}
                          onClick={() => addToCart(item)}
                        >
                          {inCart ? "В корзине" : "В корзину"}
                        </button>

                        <button
                          type="button"
                          className="inventory-buy-button"
                          disabled={spinning || !canBuy}
                          onClick={() => buySkin(item)}
                        >
                          {canBuy ? "Купить" : "Недостаточно"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!marketLoading && filteredMarket.length === 0 && (
                <div className="empty-selection">
                  Ничего не найдено
                </div>
              )}
            </>
          )}
        </div>

        {/* Правая панель выбора цели */}
        <div className="selection-panel">
          <div className="selection-header">
            <div>
              <h2>ВЫБОР ЦЕЛИ</h2>
              <span>
                Цель должна быть дороже выбранного предмета
              </span>
            </div>

            <div className="market-label">ЦЕЛЬ</div>
          </div>

          {marketLoading ? (
            <div className="empty-selection">
              Загружаем цели...
            </div>
          ) : (
            <>
              <div className="selection-filters">
                <input
                  type="text"
                  value={targetSearch}
                  onChange={(event) => setTargetSearch(event.target.value)}
                  placeholder="Поиск цели..."
                  style={filterInputStyle}
                />

                <select
                  value={targetType}
                  onChange={(event) => setTargetType(event.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="all">Все типы</option>
                  <option value="Пистолеты">Пистолеты</option>
                  <option value="SMG">SMG</option>
                  <option value="Винтовки">Винтовки</option>
                  <option value="Снайперки">Снайперки</option>
                  <option value="Дробовики">Дробовики</option>
                  <option value="Пулемёты">Пулемёты</option>
                  <option value="Ножи">Ножи</option>
                  <option value="Перчатки">Перчатки</option>
                  <option value="Другое">Другое</option>
                </select>

                <select
                  value={targetSort}
                  onChange={(event) => setTargetSort(event.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="price-asc">Цена: по возрастанию</option>
                  <option value="price-desc">Цена: по убыванию</option>
                  <option value="name-asc">Название: А → Я</option>
                  <option value="name-desc">Название: Я → А</option>
                </select>
              </div>

              <div className="selection-grid">
                {filteredTargetMarket.map((item, index) => {
                  const price = getPrice(item);
                  const sourcePrice = getPrice(selectedItem);

                  const disabled =
                    !selectedItem ||
                    price <= sourcePrice;

                  const active =
                    selectedTarget &&
                    (
                      selectedTarget.market_hash_name ||
                      selectedTarget.name
                    ) ===
                      (
                        item.market_hash_name ||
                        item.name
                      ) &&
                    getPrice(selectedTarget) === price;

                  return (
                    <button
                      type="button"
                      className={
                        active
                          ? "selection-item chosen"
                          : "selection-item"
                      }
                      key={
                        `target-${
                          item?.market_hash_name ||
                          item?.name ||
                          "item"
                        }-${index}`
                      }
                      disabled={disabled || spinning}
                      onClick={() => chooseTarget(item)}
                    >
                      <img
                        src={item.image || "/avatar.png"}
                        alt={item.name}
                        loading="lazy"
                      />

                      <span>{item.name}</span>

                      <strong>
                        {price.toLocaleString("ru-RU")} ₽
                      </strong>
                    </button>
                  );
                })}
              </div>

              {filteredTargetMarket.length === 0 && (
                <div className="empty-selection">
                  Ничего не найдено
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Корзина */}
      {cart.length > 0 && (
        <div className="upgrade-cart">
          <button
            type="button"
            onClick={() => setCartOpen((value) => !value)}
          >
            Корзина: {cart.length} предмет(а)
          </button>

          {cartOpen && (
            <div className="upgrade-cart-content">
              {cart.map((item, index) => (
                <div
                  className="upgrade-cart-item"
                  key={
                    item?.market_hash_name ||
                    item?.id ||
                    `${item?.name}-${index}`
                  }
                >
                  <span>{item.name}</span>

                  <strong>
                    {getPrice(item).toLocaleString("ru-RU")} ₽
                  </strong>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item)}
                  >
                    Удалить
                  </button>
                </div>
              ))}

              <div className="upgrade-cart-total">
                Итого:{" "}
                {cart
                  .reduce((sum, item) => sum + getPrice(item), 0)
                  .toLocaleString("ru-RU")}{" "}
                ₽
              </div>

              <button
                type="button"
                onClick={buyCart}
                disabled={
                  currentBalance <
                  cart.reduce((sum, item) => sum + getPrice(item), 0)
                }
              >
                Купить всё
              </button>
            </div>
          )}
        </div>
      )}

      {/* Окно результата */}
      {result && (
        <div className="upgrade-result-overlay">
          <div className="upgrade-result-modal">
            <div className="upgrade-result-title">
              {result.won
                ? "АПГРЕЙД УСПЕШЕН"
                : "АПГРЕЙД НЕ УДАЛСЯ"}
            </div>

            {result.won ? (
              <>
                <img
                  src={result.item.image || "/avatar.png"}
                  alt={result.item.name}
                  className="upgrade-result-image"
                />

                <h2>{result.item.name}</h2>

                <div className="upgrade-result-price">
                  {getPrice(result.item).toLocaleString("ru-RU")} ₽
                </div>

                <div className="upgrade-result-actions">
                  <button
                    type="button"
                    className="result-sell-button"
                    onClick={sellResult}
                  >
                    Продать
                  </button>

                  <button
                    type="button"
                    className="result-inventory-button"
                    onClick={keepResult}
                  >
                    В инвентарь
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="upgrade-fail-text">
                  Предмет потерян.
                </div>

                <button
                  type="button"
                  className="result-inventory-button only"
                  onClick={closeResult}
                >
                  Закрыть
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Upgrade;