import { useEffect, useRef, useState } from "react";
import { getMarketSkins } from "../lib/marketSkins";
import { supabase } from "../lib/supabase";
import "./Upgrade.css";

const MARKET_PAGE_SIZE = 10000;
const MAX_MARKET_PAGES = 1000;

const NORMAL_SPIN_DURATION = 10000;
const QUICK_SPIN_DURATION = 2000;

function parsePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  let text = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!text) return 0;

  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getPrice(item) {
  const values = [
    item?.price,
    item?.cost,
    item?.value,
    item?.marketPrice,
    item?.market_price,
    item?.min_price,
    item?.suggested_price,
    item?.item_price,
  ];

  for (const value of values) {
    const price = parsePrice(value);
    if (price > 0) return price;
  }

  return 0;
}

function normalizeMarketSkin(item) {
  const price = getPrice(item);

  return {
    ...item,
    name:
      item?.name ||
      item?.market_hash_name ||
      item?.item_name ||
      item?.marketHashName ||
      item?.title ||
      "Неизвестный предмет",
    image:
      item?.image ||
      item?.item_image ||
      item?.image_url ||
      item?.icon_url ||
      item?.iconUrl ||
      item?.img ||
      item?.icon ||
      "/avatar.png",
    price,
    type:
      item?.type ||
      item?.weapon_type ||
      item?.category ||
      "",
  };
}

function createUid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSkinTypeLabel(type = "") {
  const value = String(type).toLowerCase();

  if (value.includes("pistol")) return "Пистолеты";
  if (value.includes("smg")) return "SMG";
  if (value.includes("sniper")) return "Снайперки";
  if (value.includes("shotgun")) return "Дробовики";
  if (value.includes("machinegun")) return "Пулемёты";
  if (value.includes("knife")) return "Ножи";

  if (
    value.includes("hands") ||
    value.includes("gloves") ||
    value.includes("glove")
  ) {
    return "Перчатки";
  }

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

  if (displayChance <= 50) return 25;
  if (displayChance <= 60) return 30;
  if (displayChance <= 70) return 35;

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

    stats[multiplier] =
      Number(stats[multiplier] || 0) + 1;

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

  const price = getPrice(item);
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

function marketItemKey(item) {
  return String(
    item?.market_hash_name ||
      item?.marketHashName ||
      item?.id ||
      item?.assetid ||
      `${item?.name || item?.title || "item"}-${getPrice(item)}`
  );
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })} ₽`;
}

function Upgrade({
  balance = 0,
  setBalance,
  inventory = [],
  setInventory,
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedInventoryIndex, setSelectedInventoryIndex] =
    useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedMultiplier, setSelectedMultiplier] =
    useState(null);

  const [tab, setTab] = useState("inventory");
  const [displayChance, setDisplayChance] = useState(0);
  const [realChance, setRealChance] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  // Новый переключатель быстрой крутки.
  const [quickSpin, setQuickSpin] = useState(false);

  const [market, setMarket] = useState([]);
  const [marketStart, setMarketStart] = useState(0);
  const [marketTotal, setMarketTotal] = useState(0);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketError, setMarketError] = useState("");

  const [marketSearch, setMarketSearch] = useState("");
  const [marketType, setMarketType] = useState("all");
  const [marketSort, setMarketSort] = useState("price-asc");

  const [targetSearch, setTargetSearch] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetSort, setTargetSort] = useState("price-asc");

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const marketRequestRef = useRef(0);
  const spinTimerRef = useRef(null);

  const items = Array.isArray(inventory) ? inventory : [];
  const currentBalance = Number(balance) || 0;

  useEffect(() => {
    loadMarketSkins(true);

    return () => {
      marketRequestRef.current += 1;

      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
      }
    };
    // Загрузка запускается при открытии страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================
     ЗАГРУЗКА МАРКЕТА
     ========================================= */

  async function loadMarketSkins(firstLoad = false) {
    if (!firstLoad && marketLoadingMore) return;

    const requestId = ++marketRequestRef.current;

    setMarketLoading(true);
    setMarketLoadingMore(true);
    setMarketError("");

    let start = firstLoad ? 0 : marketStart;
    let total = firstLoad ? 0 : marketTotal;
    let pages = 0;

    const unique = new Map();

    if (!firstLoad) {
      for (const rawItem of market) {
        const item = normalizeMarketSkin(rawItem);
        unique.set(marketItemKey(item), item);
      }
    } else {
      setMarket([]);
      setMarketStart(0);
      setMarketTotal(0);
    }

    try {
      while (pages < MAX_MARKET_PAGES) {
        if (requestId !== marketRequestRef.current) return;

        const data = await getMarketSkins({
          start,
          count: MARKET_PAGE_SIZE,
        });

        if (requestId !== marketRequestRef.current) return;

        const rawItems = Array.isArray(data?.items)
          ? data.items
          : [];

        const reportedTotal = Number(data?.total || 0);

        if (reportedTotal > 0) {
          total = reportedTotal;
        }

        if (rawItems.length === 0) break;

        for (const rawItem of rawItems) {
          const item = normalizeMarketSkin(rawItem);
          unique.set(marketItemKey(item), item);
        }

        pages += 1;

        const nextStart = start + rawItems.length;
        if (nextStart <= start) break;

        start = nextStart;

        const loadedItems = Array.from(unique.values());

        setMarket(loadedItems);
        setMarketStart(start);
        setMarketTotal(total || loadedItems.length);

        if (total > 0 && start >= total) break;

        if (
          total <= 0 &&
          rawItems.length < MARKET_PAGE_SIZE
        ) {
          break;
        }
      }

      if (requestId !== marketRequestRef.current) return;

      const loadedItems = Array.from(unique.values());

      setMarket(loadedItems);
      setMarketStart(start);
      setMarketTotal(total || loadedItems.length);

      if (loadedItems.length === 0) {
        setMarketError(
          "Маркет не вернул предметы. Проверь подключение и попробуй ещё раз."
        );
      } else if (total > loadedItems.length && start < total) {
        setMarketError(
          `Загружено ${loadedItems.length.toLocaleString("ru-RU")} из ${total.toLocaleString("ru-RU")} предметов. Нажми «Повторить загрузку».`
        );
      }
    } catch (error) {
      if (requestId !== marketRequestRef.current) return;

      console.error("Ошибка загрузки маркета:", error);

      const loadedItems = Array.from(unique.values());

      setMarket(loadedItems);
      setMarketTotal(total || loadedItems.length);

      setMarketError(
        loadedItems.length > 0
          ? `Маркет загрузился частично. ${error?.message || "Неизвестная ошибка"}`
          : `Не удалось загрузить маркет: ${error?.message || "Неизвестная ошибка"}`
      );
    } finally {
      if (requestId === marketRequestRef.current) {
        setMarketLoading(false);
        setMarketLoadingMore(false);
      }
    }
  }

  const filteredMarket = sortSkins(
    market.filter((item) => {
      const search = marketSearch.trim().toLowerCase();
      const name = String(
        item?.name ||
          item?.market_hash_name ||
          item?.title ||
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
          item?.title ||
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
      ...normalizeMarketSkin(item),
      uid: item?.uid || createUid(),
    };

    if (!item?.uid && typeof setInventory === "function") {
      setInventory((previous) => {
        const current = Array.isArray(previous) ? previous : [];

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

    const preparedTarget = normalizeMarketSkin(item);
    const sourcePrice = getPrice(selectedItem);
    const targetPrice = getPrice(preparedTarget);

    if (sourcePrice <= 0 || targetPrice <= sourcePrice) return;

    const nextDisplayChance = getDisplayChance(
      sourcePrice,
      targetPrice
    );

    const nextRealChance = getRealChance(nextDisplayChance);

    setSelectedTarget({
      ...preparedTarget,
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

    const closestTarget = [...possibleTargets].sort(
      (a, b) =>
        Math.abs(getPrice(a) - wantedPrice) -
        Math.abs(getPrice(b) - wantedPrice)
    )[0];

    if (closestTarget) chooseTarget(closestTarget, multiplier);
  }

  function addToCart(item) {
    if (spinning || !item) return;

    setCart((current) => {
      const key = marketItemKey(item);

      if (
        current.some(
          (cartItem) => marketItemKey(cartItem) === key
        )
      ) {
        return current;
      }

      return [...current, normalizeMarketSkin(item)];
    });
  }

  function removeFromCart(item) {
    const key = marketItemKey(item);

    setCart((current) =>
      current.filter(
        (cartItem) => marketItemKey(cartItem) !== key
      )
    );
  }

  function buySkin(item) {
    if (spinning) return;

    const preparedItem = normalizeMarketSkin(item);
    const price = getPrice(preparedItem);

    if (price <= 0 || currentBalance < price) return;

    if (
      typeof setBalance !== "function" ||
      typeof setInventory !== "function"
    ) {
      return;
    }

    const newItem = {
      ...preparedItem,
      price,
      uid: createUid(),
    };

    setBalance(
      (previous) => (Number(previous) || 0) - price
    );

    setInventory((previous) => [
      ...(Array.isArray(previous) ? previous : []),
      newItem,
    ]);

    setSelectedItem(newItem);
    setSelectedInventoryIndex(items.length);
    setSelectedTarget(null);
    setSelectedMultiplier(null);
    setDisplayChance(0);
    setRealChance(0);
    setTab("inventory");

    removeFromCart(item);
  }

  async function addDropToSupabase(item) {
    if (!item) return false;

    const drop = {
      username: "Гость",
      item_name: item.name || "Unknown",
      item_image: item.image || null,
      item_price: Number(getPrice(item)) || 0,
    };

    try {
      const { data, error } = await supabase
        .from("drops")
        .insert(drop)
        .select()
        .single();

      if (error) {
        console.error(
          "Ошибка добавления дропа в Supabase:",
          error
        );
        return false;
      }

      console.log("LIVE DROP:", data);
      return true;
    } catch (error) {
      console.error("Supabase exception:", error);
      return false;
    }
  }

  /* =========================================
     ЗАПУСК АПГРЕЙДА
     Скорость не меняет шанс победы.
     ========================================= */

  function startUpgrade() {
    if (
      spinning ||
      !selectedItem ||
      !selectedTarget ||
      displayChance <= 0 ||
      realChance <= 0
    ) {
      return;
    }

    const sourcePrice = getPrice(selectedItem);
    const targetPrice = getPrice(selectedTarget);

    if (sourcePrice <= 0 || targetPrice <= sourcePrice) return;

    const spinDuration = quickSpin
      ? QUICK_SPIN_DURATION
      : NORMAL_SPIN_DURATION;

    const yellowAngle = (displayChance / 100) * 360;
    const won = Math.random() * 100 < realChance;

    let landingAngle;

    if (won) {
      landingAngle = Math.random() * yellowAngle;
    } else {
      const blackAngle = 360 - yellowAngle;
      landingAngle =
        yellowAngle + Math.random() * blackAngle;
    }

    const currentAngle = ((rotation % 360) + 360) % 360;
    const desiredRotation = (360 - landingAngle) % 360;
    const extraRotation =
      (desiredRotation - currentAngle + 360) % 360;

    const finalRotation =
      rotation + 360 * 12 + extraRotation;

    trackUpgradeMultiplier(selectedMultiplier);

    setSpinning(true);
    setResult(null);
    setRotation(finalRotation);

    if (typeof setInventory === "function") {
      setInventory((previous) => {
        const current = Array.isArray(previous) ? previous : [];

        if (selectedItem?.uid) {
          const uidIndex = current.findIndex(
            (item) => item?.uid === selectedItem.uid
          );

          if (uidIndex !== -1) {
            return current.filter((_, index) => index !== uidIndex);
          }
        }

        if (
          selectedInventoryIndex !== null &&
          selectedInventoryIndex >= 0 &&
          selectedInventoryIndex < current.length
        ) {
          return current.filter(
            (_, index) => index !== selectedInventoryIndex
          );
        }

        return current;
      });
    }

    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
    }

    spinTimerRef.current = window.setTimeout(async () => {
      spinTimerRef.current = null;
      setSpinning(false);

      if (won) {
        const wonItem = {
          ...selectedTarget,
          uid: createUid(),
        };

        saveTopUpgradeDrop(wonItem);

        setResult({
          won: true,
          item: wonItem,
        });

        await addDropToSupabase(wonItem);
      } else {
        setResult({
          won: false,
          item: selectedItem,
        });
      }
    }, spinDuration);
  }

  function sellResult() {
    if (!result || !result.won) return;

    const price = getPrice(result.item);

    if (typeof setBalance === "function") {
      setBalance(
        (previous) => (Number(previous) || 0) + price
      );
    }

    closeResult();
  }

  function keepResult() {
    if (!result || !result.won) return;

    if (typeof setInventory === "function") {
      setInventory((previous) => [
        ...(Array.isArray(previous) ? previous : []),
        result.item,
      ]);
    }

    closeResult();
  }

  function closeResult() {
    if (spinning) return;

    setResult(null);
    setSelectedItem(null);
    setSelectedInventoryIndex(null);
    setSelectedTarget(null);
    setSelectedMultiplier(null);
    setDisplayChance(0);
    setRealChance(0);
    setRotation(0);
  }

  const filterSelectStyle = {
    height: "40px",
    padding: "0 12px",
    background: "#0d0d0d",
    color: "#f3f3f3",
    border: "1px solid #303030",
    borderRadius: "8px",
    outline: "none",
    cursor: "pointer",
    minWidth: "180px",
  };

  const filterInputStyle = {
    flex: "1 1 240px",
    minWidth: "200px",
    height: "40px",
    padding: "0 12px",
    background: "#0d0d0d",
    color: "#f3f3f3",
    border: "1px solid #303030",
    borderRadius: "8px",
    outline: "none",
    caretColor: "#f5c400",
  };

  const actionButtonStyle = {
    height: "40px",
    padding: "0 14px",
    background: "#111111",
    color: "#f5c400",
    border: "1px solid #303030",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 800,
    outline: "none",
    boxShadow: "none",
    filter: "none",
  };

  return (
    <div className="upgrade-page">
      <div className="upgrade-heading">
        <img
          src="/logo.png"
          alt="Koch Drop"
          className="upgrade-logo"
        />
      </div>

      <div className="upgrade-stage">
        {/* ИСХОДНЫЙ ПРЕДМЕТ */}
        <div className="selected-side source-side">
          <div className="selected-title">ТВОЙ ПРЕДМЕТ</div>

          {selectedItem ? (
            <div
              className="selected-card selected"
              onClick={spinning ? undefined : resetSelection}
            >
              <img
                src={selectedItem.image || "/avatar.png"}
                alt={selectedItem.name}
              />

              <div className="selected-name">
                {selectedItem.name}
              </div>

              <div className="selected-price">
                {formatMoney(getPrice(selectedItem))}
              </div>
            </div>
          ) : (
            <div className="selected-card empty">
              <span>Выбери предмет ниже</span>
            </div>
          )}
        </div>

        {/* ЦЕНТРАЛЬНОЕ КОЛЕСО */}
        <div className="upgrade-wheel-area">
          <div className="upgrade-wheel">
            <div
              className="upgrade-pointer"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 52 46"
                className="upgrade-pointer-svg"
                focusable="false"
              >
                <path
                  d="M26 5 V23"
                  fill="none"
                  stroke="#f5c400"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                <path
                  d="M12 18 Q17 29 26 39 Q35 29 40 18"
                  fill="none"
                  stroke="#f5c400"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div
              className="upgrade-wheel-ring"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${
                      quickSpin
                        ? QUICK_SPIN_DURATION
                        : NORMAL_SPIN_DURATION
                    }ms cubic-bezier(0.08, 0.85, 0.12, 1)`
                  : "none",
                background: `conic-gradient(
                  from 0deg,
                  #f5c400 0deg,
                  #f5c400 ${(displayChance / 100) * 360}deg,
                  #111111 ${(displayChance / 100) * 360}deg,
                  #111111 360deg
                )`,
              }}
            >
              <div className="upgrade-wheel-separators" />
            </div>

            <div className="upgrade-wheel-center">
              <img
                src="/upgrade-center.png"
                alt=""
                className="upgrade-center-image"
              />

              <div className="upgrade-wheel-chance">
                {displayChance > 0 ? `${displayChance}%` : "—"}
              </div>

              <div className="upgrade-wheel-label">ШАНС</div>
            </div>
          </div>

          <div className="upgrade-chances">
            {[2, 3, 5, 10].map((multiplier) => (
              <button
                key={multiplier}
                type="button"
                className={
                  selectedMultiplier === multiplier
                    ? "upgrade-chance-button active"
                    : "upgrade-chance-button"
                }
                disabled={!selectedItem || spinning}
                onClick={() => chooseMultiplier(multiplier)}
              >
                x{multiplier}
              </button>
            ))}
          </div>

          {/* КНОПКА АПГРЕЙДА + МОЛНИЯ */}
          <div className="upgrade-actions">
            <button
              type="button"
              className="upgrade-button"
              disabled={
                !selectedItem ||
                !selectedTarget ||
                spinning
              }
              onClick={startUpgrade}
            >
              {spinning ? "АПГРЕЙД..." : "АПГРЕЙД"}
            </button>

            <button
              type="button"
              className={`quick-spin-toggle ${
                quickSpin ? "active" : ""
              }`}
              onClick={() =>
                setQuickSpin((current) => !current)
              }
              disabled={spinning}
              aria-label={
                quickSpin
                  ? "Выключить быструю крутку"
                  : "Включить быструю крутку"
              }
              aria-pressed={quickSpin}
              title={
                quickSpin
                  ? "Быстрая крутка включена"
                  : "Быстрая крутка"
              }
            >
              <svg
                viewBox="0 0 24 24"
                width="25"
                height="25"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M13.5 2.5 5.5 13h5l-.8 8.5L18.5 10h-5.2z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ЦЕЛЕВОЙ ПРЕДМЕТ */}
        <div className="selected-side target-side">
          <div className="selected-title">ЦЕЛЬ</div>

          {selectedTarget ? (
            <div className="selected-card target selected">
              <img
                src={selectedTarget.image || "/avatar.png"}
                alt={selectedTarget.name}
              />

              <div className="selected-name">
                {selectedTarget.name}
              </div>

              <div className="selected-price">
                {formatMoney(getPrice(selectedTarget))}
              </div>
            </div>
          ) : (
            <div className="selected-card target empty">
              <span>Выбери цель ниже</span>
            </div>
          )}
        </div>
      </div>

      {/* ИНВЕНТАРЬ И МАРКЕТ */}
      <div className="upgrade-selection">
        <div className="selection-panel">
          <div className="selection-header">
            <div>
              <h2>{tab === "inventory" ? "Инвентарь" : "Маркет"}</h2>

              <span>
                {tab === "inventory"
                  ? "Твои предметы"
                  : marketLoading
                  ? `Загружено ${market.length.toLocaleString("ru-RU")}${
                      marketTotal > 0
                        ? ` из ${marketTotal.toLocaleString("ru-RU")}`
                        : ""
                    }`
                  : `${market.length.toLocaleString("ru-RU")} загружено`}
              </span>
            </div>

            <div className="upgrade-tabs">
              <button
                type="button"
                className={
                  tab === "inventory"
                    ? "upgrade-tab active"
                    : "upgrade-tab"
                }
                onClick={() => setTab("inventory")}
              >
                Инвентарь
              </button>

              <button
                type="button"
                className={
                  tab === "market"
                    ? "upgrade-tab active"
                    : "upgrade-tab"
                }
                onClick={() => setTab("market")}
              >
                Маркет
              </button>
            </div>
          </div>

          {tab === "inventory" ? (
            items.length > 0 ? (
              <div className="selection-grid">
                {items.map((item, index) => {
                  const active =
                    (selectedItem?.uid &&
                      item?.uid &&
                      selectedItem.uid === item.uid) ||
                    (!selectedItem?.uid &&
                      selectedInventoryIndex === index);

                  return (
                    <button
                      type="button"
                      className={
                        active
                          ? "selection-item chosen"
                          : "selection-item"
                      }
                      key={
                        item?.uid ||
                        `${item?.name || "item"}-${index}`
                      }
                      disabled={spinning}
                      onClick={() => chooseItem(item, index)}
                    >
                      <img
                        src={item.image || "/avatar.png"}
                        alt={item.name}
                      />

                      <span>{item.name}</span>

                      <strong>{formatMoney(getPrice(item))}</strong>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-selection">
                Инвентарь пуст
              </div>
            )
          ) : (
            <>
              <div className="upgrade-filters">
                <input
                  type="text"
                  value={marketSearch}
                  onChange={(event) =>
                    setMarketSearch(event.target.value)
                  }
                  placeholder="Поиск скина..."
                  style={filterInputStyle}
                />

                <select
                  value={marketType}
                  onChange={(event) =>
                    setMarketType(event.target.value)
                  }
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
                  onChange={(event) =>
                    setMarketSort(event.target.value)
                  }
                  style={filterSelectStyle}
                >
                  <option value="price-asc">Цена: по возрастанию</option>
                  <option value="price-desc">Цена: по убыванию</option>
                  <option value="name-asc">Название: А → Я</option>
                  <option value="name-desc">Название: Я → А</option>
                </select>

                <button
                  type="button"
                  className="market-action-button"
                  onClick={() =>
                    setCartOpen((value) => !value)
                  }
                >
                  Корзина ({cart.length})
                </button>

                {!marketLoading && (
                  <button
                    type="button"
                    className="market-action-button"
                    onClick={() => loadMarketSkins(true)}
                  >
                    Обновить маркет
                  </button>
                )}
              </div>

              {cartOpen && (
                <div className="cart-panel">
                  <div className="selection-header">
                    <div>
                      <h2>Корзина</h2>
                      <span>
                        {cart.length > 0
                          ? `${cart.length} предметов`
                          : "Корзина пуста"}
                      </span>
                    </div>

                    {cart.length > 0 && (
                      <button
                        type="button"
                        className="market-action-button"
                        onClick={() => setCart([])}
                      >
                        Очистить
                      </button>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="selection-grid">
                      {cart.map((item) => (
                        <div
                          className="selection-item"
                          key={marketItemKey(item)}
                        >
                          <img
                            src={item.image || "/avatar.png"}
                            alt={item.name}
                          />

                          <span>{item.name}</span>

                          <strong>
                            {formatMoney(getPrice(item))}
                          </strong>

                          <div className="cart-item-actions">
                            <button
                              type="button"
                              className="inventory-buy-button"
                              disabled={
                                spinning ||
                                currentBalance < getPrice(item)
                              }
                              onClick={() => buySkin(item)}
                            >
                              {currentBalance >= getPrice(item)
                                ? "Купить"
                                : "Недостаточно"}
                            </button>

                            <button
                              type="button"
                              className="inventory-buy-button"
                              onClick={() => removeFromCart(item)}
                            >
                              Убрать
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {marketLoading && market.length === 0 ? (
                <div className="empty-selection">
                  Загружаем маркет...
                </div>
              ) : (
                <div className="selection-grid">
                  {filteredMarket.map((item, index) => {
                    const price = getPrice(item);
                    const canBuy =
                      price > 0 && currentBalance >= price;
                    const cartKey = marketItemKey(item);

                    const inCart = cart.some(
                      (cartItem) =>
                        marketItemKey(cartItem) === cartKey
                    );

                    return (
                      <div
                        className="selection-item"
                        key={`${cartKey}-${index}`}
                      >
                        <img
                          src={item.image || "/avatar.png"}
                          alt={item.name}
                        />

                        <span>{item.name}</span>

                        <strong>{formatMoney(price)}</strong>

                        <button
                          type="button"
                          className="inventory-buy-button"
                          disabled={spinning || inCart}
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

              {!marketLoading &&
                filteredMarket.length === 0 &&
                !marketError && (
                  <div className="empty-selection">
                    Ничего не найдено
                  </div>
                )}

              {marketError && (
                <div className="market-error" role="alert">
                  <span>{marketError}</span>

                  <button
                    type="button"
                    className="market-action-button"
                    onClick={() => loadMarketSkins(true)}
                  >
                    Повторить загрузку
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ВЫБОР ЦЕЛИ */}
        <div className="selection-panel">
          <div className="selection-header">
            <div>
              <h2>Выбор цели</h2>

              <span>
                Цель должна быть дороже исходного предмета
              </span>
            </div>

            <div className="market-label">ЦЕЛЬ</div>
          </div>

          {marketLoading && market.length === 0 ? (
            <div className="empty-selection">
              Загружаем цели...
            </div>
          ) : (
            <>
              <div className="upgrade-filters">
                <input
                  type="text"
                  value={targetSearch}
                  onChange={(event) =>
                    setTargetSearch(event.target.value)
                  }
                  placeholder="Поиск цели..."
                  style={filterInputStyle}
                />

                <select
                  value={targetType}
                  onChange={(event) =>
                    setTargetType(event.target.value)
                  }
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
                  onChange={(event) =>
                    setTargetSort(event.target.value)
                  }
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
                    price <= sourcePrice ||
                    price <= 0;

                  const active =
                    selectedTarget &&
                    (
                      selectedTarget.market_hash_name ||
                      selectedTarget.name
                    ) === (
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
                      key={`${marketItemKey(item)}-${index}`}
                      disabled={disabled || spinning}
                      onClick={() => chooseTarget(item)}
                    >
                      <img
                        src={item.image || "/avatar.png"}
                        alt={item.name}
                      />

                      <span>{item.name}</span>

                      <strong>{formatMoney(price)}</strong>
                    </button>
                  );
                })}
              </div>

              {filteredTargetMarket.length === 0 && (
                <div className="empty-selection">
                  {selectedItem
                    ? "Подходящих целей не найдено"
                    : "Сначала выбери свой предмет"}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ОКНО РЕЗУЛЬТАТА */}
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
                  {formatMoney(getPrice(result.item))}
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