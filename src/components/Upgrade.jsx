import { useEffect, useRef, useState } from "react"
import { getMarketSkins } from "../lib/marketSkins"
import { supabase } from "../lib/supabase"
import "./Upgrade.css"

function getPrice(item) {
  return Number(
    item?.price ??
      item?.cost ??
      item?.value ??
      item?.marketPrice ??
      0
  )
}

function createUid() {
  return (
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  )
}

function getSkinTypeLabel(type = "") {
  const value = String(type).toLowerCase()
  if (value.includes("pistol")) return "Пистолеты"
  if (value.includes("smg")) return "SMG"
  if (value.includes("sniper")) return "Снайперки"
  if (value.includes("shotgun")) return "Дробовики"
  if (value.includes("machinegun")) return "Пулемёты"
  if (value.includes("knife")) return "Ножи"
  if (value.includes("hands") || value.includes("gloves")) return "Перчатки"
  if (value.includes("rifle")) return "Винтовки"
  return "Другое"
}

function sortSkins(items, sort) {
  const result = [...items]

  if (sort === "price-asc") {
    result.sort((a, b) => getPrice(a) - getPrice(b))
  }

  if (sort === "price-desc") {
    result.sort((a, b) => getPrice(b) - getPrice(a))
  }

  if (sort === "name-asc") {
    result.sort((a, b) =>
      String(a?.name || "").localeCompare(
        String(b?.name || ""),
        "ru"
      )
    )
  }

  if (sort === "name-desc") {
    result.sort((a, b) =>
      String(b?.name || "").localeCompare(
        String(a?.name || ""),
        "ru"
      )
    )
  }

  return result
}

function getDisplayChance(sourcePrice, targetPrice) {
  if (sourcePrice <= 0 || targetPrice <= sourcePrice) {
    return 0
  }

  return Math.min(
    95,
    Math.max(
      1,
      Math.round((sourcePrice / targetPrice) * 77)
    )
  )
}

function getRealChance(displayChance) {
  if (displayChance <= 30) {
    return Math.max(3, Math.round(displayChance * 0.55))
  }

  if (displayChance <= 40) {
    return Math.max(4, Math.round(displayChance * 0.6))
  }

  if (displayChance <= 50) {
    return 25
  }

  if (displayChance <= 60) {
    return 30
  }

  if (displayChance <= 70) {
    return 35
  }

  return Math.max(5, Math.round(displayChance * 0.5))
}

function trackUpgradeMultiplier(multiplier) {
  if (!multiplier) {
    return
  }

  try {
    const saved = localStorage.getItem("koch_upgrade_stats")

    const stats = saved
      ? JSON.parse(saved)
      : {
          2: 0,
          3: 0,
          5: 0,
          10: 0
        }

    stats[multiplier] = Number(stats[multiplier] || 0) + 1

    localStorage.setItem(
      "koch_upgrade_stats",
      JSON.stringify(stats)
    )

    window.dispatchEvent(new Event("koch-upgrade-stats"))
  } catch (error) {
    console.error("Ошибка статистики множителя:", error)
  }
}

function saveTopUpgradeDrop(item) {
  if (!item) {
    return
  }

  const price = Number(
    item.price ??
      item.value ??
      item.cost ??
      item.marketPrice ??
      0
  )

  if (!Number.isFinite(price) || price <= 0) {
    return
  }

  try {
    const saved = localStorage.getItem("koch_top_upgrade_drop")
    const oldDrop = saved ? JSON.parse(saved) : null
    const oldPrice = Number(oldDrop?.price || 0)

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
        price
      }

      localStorage.setItem(
        "koch_top_upgrade_drop",
        JSON.stringify(data)
      )

      window.dispatchEvent(new Event("koch-top-upgrade-drop"))
    }
  } catch (error) {
    console.error("Ошибка сохранения Top Drop:", error)
  }
}

function Upgrade({
  balance = 0,
  setBalance,
  inventory = [],
  setInventory
}) {
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState(null)
  const [sourceMode, setSourceMode] = useState("inventory")
  const [balanceStake, setBalanceStake] = useState(0.01)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [selectedMultiplier, setSelectedMultiplier] = useState(null)
  const [tab, setTab] = useState("inventory")
  const [displayChance, setDisplayChance] = useState(0)
  const [realChance, setRealChance] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)

  const [market, setMarket] = useState([])
  const [marketStart, setMarketStart] = useState(0)
  const [marketTotal, setMarketTotal] = useState(0)
  const [marketLoading, setMarketLoading] = useState(true)
  const [marketLoadingMore, setMarketLoadingMore] = useState(false)
  const [marketError, setMarketError] = useState("")
  const [marketHasMore, setMarketHasMore] = useState(true)

  const marketRequestLock = useRef(false)
  const marketRetryAfter = useRef(0)
  const lastMarketRequestAt = useRef(0)

  const [marketSearch, setMarketSearch] = useState("")
  const [marketType, setMarketType] = useState("all")
  const [marketSort, setMarketSort] = useState("price-asc")

  const [targetSearch, setTargetSearch] = useState("")
  const [targetType, setTargetType] = useState("all")
  const [targetSort, setTargetSort] = useState("price-asc")

  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)

  const items = Array.isArray(inventory) ? inventory : []
  const currentBalance = Number(balance) || 0

  const maxBalanceStake = Math.max(
    0,
    Math.floor((currentBalance + Number.EPSILON) * 100) / 100
  )

  const effectiveBalanceStake =
    maxBalanceStake >= 0.01 && Number(balanceStake) > 0
      ? Math.min(
          maxBalanceStake,
          Math.max(0.01, Math.round(Number(balanceStake) * 100) / 100)
        )
      : 0

  useEffect(() => {
    loadMarketSkins(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadMarketSkins(firstLoad = false) {
    if (marketRequestLock.current) return

    const blockedFor = marketRetryAfter.current - Date.now()

    if (blockedFor > 0) {
      setMarketError(
        `Steam временно ограничил запросы. Подожди ${Math.ceil(blockedFor / 1000)} сек.`
      )
      return
    }

    marketRequestLock.current = true

    const start = firstLoad ? 0 : marketStart
    const existingItems = firstLoad ? [] : market
    const collected = []
    const collectedKeys = new Set()

    let nextStart = start
    let latestTotal = firstLoad ? 0 : marketTotal
    let reachedEnd = false

    if (firstLoad) {
      setMarket([])
      setMarketStart(0)
      setMarketTotal(0)
      setMarketHasMore(true)
      setMarketError("")
      setMarketLoading(true)
    } else {
      setMarketError("")
    }

    setMarketLoadingMore(true)

    try {
      // Собираем одну порцию из 100 предметов последовательными запросами.
      // Это работает и когда функция маркета возвращает только 10 предметов.
      const targetBatchSize = 100
      const maxRequestsPerLoad = 10

      for (
        let requestIndex = 0;
        requestIndex < maxRequestsPerLoad &&
        collected.length < targetBatchSize;
        requestIndex += 1
      ) {
        const wait = Math.max(
          0,
          1300 - (Date.now() - lastMarketRequestAt.current)
        )

        if (wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait))
        }

        lastMarketRequestAt.current = Date.now()

        const data = await getMarketSkins({
          start: nextStart,
          count: targetBatchSize - collected.length
        })

        const batch = Array.isArray(data?.items) ? data.items : []

        if (Number(data?.total) > 0) {
          latestTotal = Number(data.total)
        }

        if (batch.length === 0) {
          reachedEnd = true
          break
        }

        let addedThisRequest = 0

        for (const item of batch) {
          const key =
            item?.market_hash_name ||
            item?.id ||
            item?.name

          if (!key || collectedKeys.has(key)) continue

          collectedKeys.add(key)
          collected.push(item)
          addedThisRequest += 1
        }

        // Если API снова вернул те же предметы, не зацикливаем запросы.
        if (addedThisRequest === 0) {
          reachedEnd = true
          break
        }

        nextStart += batch.length

        if (
          latestTotal >= targetBatchSize &&
          nextStart >= latestTotal &&
          collected.length >= targetBatchSize
        ) {
          reachedEnd = true
          break
        }

        if (batch.length < 10) {
          reachedEnd = true
          break
        }
      }

      const unique = new Map()

      for (const item of [...existingItems, ...collected]) {
        const key =
          item?.market_hash_name ||
          item?.id ||
          item?.name

        if (key) unique.set(key, item)
      }

      const nextItems = Array.from(unique.values())

      setMarket(nextItems)
      setMarketStart(nextStart)
      setMarketTotal(latestTotal)

      setMarketHasMore(
        nextItems.length < 10000 &&
          !reachedEnd &&
          (latestTotal > nextStart ||
            collected.length >= targetBatchSize)
      )

      setMarketError("")
    } catch (error) {
      const message = String(error?.message || error)
      console.error("Ошибка загрузки Market:", error)

      // Сохраняем уже полученные предметы, если следующий запрос получил 429.
      if (collected.length > 0) {
        const unique = new Map()

        for (const item of [...existingItems, ...collected]) {
          const key =
            item?.market_hash_name ||
            item?.id ||
            item?.name

          if (key) unique.set(key, item)
        }

        setMarket(Array.from(unique.values()))
        setMarketStart(nextStart)
        setMarketTotal(latestTotal)
        setMarketHasMore(true)
      }

      if (/429|rate.?limit|too many requests/i.test(message)) {
        marketRetryAfter.current = Date.now() + 60000
        setMarketError(
          "Steam ограничил запросы (HTTP 429). Подожди около минуты и повтори загрузку."
        )
      } else {
        setMarketError(message || "Не удалось загрузить маркет.")
      }
    } finally {
      marketRequestLock.current = false
      setMarketLoading(false)
      setMarketLoadingMore(false)
    }
  }

  const filteredMarket = sortSkins(
    market.filter((item) => {
      const search = marketSearch.trim().toLowerCase()

      const name = String(
        item?.name ||
          item?.market_hash_name ||
          ""
      ).toLowerCase()

      const matchesSearch = !search || name.includes(search)

      const matchesType =
        marketType === "all" ||
        getSkinTypeLabel(item?.type) === marketType

      return matchesSearch && matchesType
    }),
    marketSort
  )

  const filteredTargetMarket = sortSkins(
    market.filter((item) => {
      const search = targetSearch.trim().toLowerCase()

      const name = String(
        item?.name ||
          item?.market_hash_name ||
          ""
      ).toLowerCase()

      const matchesSearch = !search || name.includes(search)

      const matchesType =
        targetType === "all" ||
        getSkinTypeLabel(item?.type) === targetType

      return matchesSearch && matchesType
    }),
    targetSort
  )

  function resetSelection() {
    if (spinning) {
      return
    }

    setSelectedItem(null)
    setSelectedInventoryIndex(null)
    setSourceMode("inventory")
    setSelectedTarget(null)
    setSelectedMultiplier(null)
    setDisplayChance(0)
    setRealChance(0)
    setResult(null)
  }

  function chooseItem(item, index) {
    if (spinning) {
      return
    }

    const preparedItem = {
      ...item,
      uid: item?.uid || createUid()
    }

    if (!item?.uid && typeof setInventory === "function") {
      setInventory((prev) => {
        const current = Array.isArray(prev) ? prev : []

        return current.map((currentItem, currentIndex) =>
          currentIndex === index ? preparedItem : currentItem
        )
      })
    }

    setSelectedItem(preparedItem)
    setSelectedInventoryIndex(index)
    setSourceMode("inventory")
    setSelectedTarget(null)
    setSelectedMultiplier(null)
    setDisplayChance(0)
    setRealChance(0)
    setResult(null)
  }

  function updateBalanceStake(value) {
    const rawValue = String(value ?? "").trim()

    // Двигаешь ползунок — сразу выбирается ставка с баланса.
    setSourceMode("balance")
    setSelectedInventoryIndex(null)
    setResult(null)

    if (rawValue === "") {
      setBalanceStake(0)
      setSelectedItem(null)
      setSelectedTarget(null)
      setSelectedMultiplier(null)
      setDisplayChance(0)
      setRealChance(0)
      return
    }

    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return

    const nextStake =
      maxBalanceStake > 0
        ? Math.min(
            maxBalanceStake,
            Math.max(0.01, Math.round(parsed * 100) / 100)
          )
        : 0

    setBalanceStake(nextStake)

    if (nextStake <= 0) {
      setSelectedItem(null)
      setSelectedTarget(null)
      setSelectedMultiplier(null)
      setDisplayChance(0)
      setRealChance(0)
      return
    }

    setSelectedItem({
      uid: "koch-balance-stake",
      name: "Ставка с баланса",
      image: "/logo.png",
      price: nextStake,
      isBalanceStake: true
    })

    if (!selectedTarget) {
      setSelectedMultiplier(null)
      setDisplayChance(0)
      setRealChance(0)
      return
    }

    const targetPrice = getPrice(selectedTarget)

    if (targetPrice <= nextStake) {
      setSelectedTarget(null)
      setSelectedMultiplier(null)
      setDisplayChance(0)
      setRealChance(0)
      return
    }

    const nextDisplayChance = getDisplayChance(
      nextStake,
      targetPrice
    )

    setDisplayChance(nextDisplayChance)
    setRealChance(getRealChance(nextDisplayChance))
  }

  function chooseTarget(item, multiplier = null) {
    if (spinning || !selectedItem) {
      return
    }

    const sourcePrice = getPrice(selectedItem)
    const targetPrice = getPrice(item)

    if (sourcePrice <= 0 || targetPrice <= sourcePrice) {
      return
    }

    const nextDisplayChance = getDisplayChance(
      sourcePrice,
      targetPrice
    )

    const nextRealChance = getRealChance(nextDisplayChance)

    setSelectedTarget({
      ...item,
      uid: item?.uid || createUid(),
      price: targetPrice
    })

    setSelectedMultiplier(multiplier)
    setDisplayChance(nextDisplayChance)
    setRealChance(nextRealChance)
    setResult(null)
  }

  function chooseMultiplier(multiplier) {
    if (spinning || !selectedItem) {
      return
    }

    const sourcePrice = getPrice(selectedItem)

    if (sourcePrice <= 0) {
      return
    }

    const wantedPrice = sourcePrice * multiplier

    const possibleTargets = market.filter(
      (item) => getPrice(item) > sourcePrice
    )

    if (possibleTargets.length === 0) {
      return
    }

    const closestTarget = [...possibleTargets].sort(
      (a, b) => {
        const differenceA = Math.abs(
          getPrice(a) - wantedPrice
        )

        const differenceB = Math.abs(
          getPrice(b) - wantedPrice
        )

        return differenceA - differenceB
      }
    )[0]

    if (!closestTarget) {
      return
    }

    chooseTarget(closestTarget, multiplier)
  }

  function addToCart(item) {
    if (spinning || !item) {
      return
    }

    setCart((current) => {
      const key =
        item?.market_hash_name ||
        item?.id ||
        item?.name

      if (
        current.some(
          (cartItem) =>
            (cartItem?.market_hash_name ||
              cartItem?.id ||
              cartItem?.name) === key
        )
      ) {
        return current
      }

      return [...current, item]
    })
  }

  function removeFromCart(item) {
    const key =
      item?.market_hash_name ||
      item?.id ||
      item?.name

    setCart((current) =>
      current.filter(
        (cartItem) =>
          (cartItem?.market_hash_name ||
            cartItem?.id ||
            cartItem?.name) !== key
      )
    )
  }

  function buySkin(item) {
    if (spinning) {
      return
    }

    const price = getPrice(item)

    if (price <= 0) {
      return
    }

    if (currentBalance < price) {
      return
    }

    if (
      typeof setBalance !== "function" ||
      typeof setInventory !== "function"
    ) {
      return
    }

    const newItem = {
      ...item,
      price,
      uid: createUid()
    }

    setBalance(
      (prev) => (Number(prev) || 0) - price
    )

    setInventory((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      newItem
    ])

    setSelectedItem(newItem)
    setSelectedInventoryIndex(items.length)
    setSourceMode("inventory")
    setSelectedTarget(null)
    setSelectedMultiplier(null)
    setDisplayChance(0)
    setRealChance(0)
    setTab("inventory")
    removeFromCart(item)
  }

  async function addDropToSupabase(item) {
    if (!item) {
      return false
    }

    const drop = {
      username: "Гость",
      item_name: item.name || "Unknown",
      item_image: item.image || null,
      item_price: Number(getPrice(item)) || 0
    }

    try {
      const { data, error } = await supabase
        .from("drops")
        .insert(drop)
        .select()
        .single()

      if (error) {
        console.error(
          "Ошибка добавления дропа в Supabase:",
          error
        )
        return false
      }

      console.log("LIVE DROP:", data)
      return true
    } catch (error) {
      console.error("Supabase exception:", error)
      return false
    }
  }

  function startUpgrade() {
    if (
      spinning ||
      !selectedItem ||
      !selectedTarget ||
      displayChance <= 0 ||
      realChance <= 0
    ) {
      return
    }

    const sourcePrice = getPrice(selectedItem)
    const targetPrice = getPrice(selectedTarget)

    if (sourcePrice <= 0 || targetPrice <= sourcePrice) {
      return
    }

    const isBalanceStake =
      sourceMode === "balance" || selectedItem?.isBalanceStake

    if (isBalanceStake) {
      if (
        typeof setBalance !== "function" ||
        currentBalance < sourcePrice
      ) {
        return
      }
    }

    const yellowAngle = (displayChance / 100) * 360
    const won = Math.random() * 100 < realChance

    let landingAngle

    if (won) {
      landingAngle = Math.random() * yellowAngle
    } else {
      const blackAngle = 360 - yellowAngle
      landingAngle = yellowAngle + Math.random() * blackAngle
    }

    const currentAngle =
      ((rotation % 360) + 360) % 360

    const desiredRotation = (360 - landingAngle) % 360

    const extraRotation =
      (desiredRotation - currentAngle + 360) % 360

    const finalRotation =
      rotation +
      360 * 12 +
      extraRotation

    trackUpgradeMultiplier(selectedMultiplier)

    setSpinning(true)
    setResult(null)
    setRotation(finalRotation)

    if (isBalanceStake) {
      setBalance((prev) => {
        const previousBalance = Number(prev) || 0

        const nextBalance = Math.max(
          0,
          Math.round((previousBalance - sourcePrice) * 100) / 100
        )

        return nextBalance
      })
    } else if (typeof setInventory === "function") {
      setInventory((prev) => {
        const current = Array.isArray(prev) ? prev : []

        if (selectedItem?.uid) {
          const uidIndex = current.findIndex(
            (item) => item?.uid === selectedItem.uid
          )

          if (uidIndex !== -1) {
            return current.filter(
              (_, index) => index !== uidIndex
            )
          }
        }

        if (
          selectedInventoryIndex !== null &&
          selectedInventoryIndex >= 0 &&
          selectedInventoryIndex < current.length
        ) {
          return current.filter(
            (_, index) => index !== selectedInventoryIndex
          )
        }

        return current
      })
    }

    window.setTimeout(async () => {
      setSpinning(false)

      if (won) {
        const wonItem = {
          ...selectedTarget,
          uid: createUid()
        }

        saveTopUpgradeDrop(wonItem)

        setResult({
          won: true,
          item: wonItem
        })

        await addDropToSupabase(wonItem)
      } else {
        setResult({
          won: false,
          item: selectedItem,
          balanceStake: isBalanceStake
        })
      }
    }, 10000)
  }

  function sellResult() {
    if (!result || !result.won) {
      return
    }

    const price = getPrice(result.item)

    if (typeof setBalance === "function") {
      setBalance(
        (prev) => (Number(prev) || 0) + price
      )
    }

    closeResult()
  }

  function keepResult() {
    if (!result || !result.won) {
      return
    }

    if (typeof setInventory === "function") {
      setInventory((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        result.item
      ])
    }

    closeResult()
  }

  function closeResult() {
    if (spinning) {
      return
    }

    setResult(null)
    setSelectedItem(null)
    setSelectedInventoryIndex(null)
    setSourceMode("inventory")
    setSelectedTarget(null)
    setSelectedMultiplier(null)
    setDisplayChance(0)
    setRealChance(0)
    setRotation(0)
  }

  const filterSelectStyle = {
    height: "40px",
    padding: "0 12px",
    background: "#0d0d0d",
    color: "#fff",
    border: "1px solid #252525",
    borderRadius: "8px",
    outline: "none",
    cursor: "pointer",
    minWidth: "180px"
  }

  const filterInputStyle = {
    flex: "1 1 240px",
    minWidth: "200px",
    height: "40px",
    padding: "0 12px",
    background: "#0d0d0d",
    color: "#fff",
    border: "1px solid #252525",
    borderRadius: "8px",
    outline: "none"
  }

  const actionButtonStyle = {
    height: "40px",
    padding: "0 14px",
    background: "#111",
    color: "#f5c400",
    border: "1px solid #292929",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 800,
    outline: "none"
  }

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
        <div className="selected-side source-side">
          <div className="selected-title">
            ТВОЙ ПРЕДМЕТ
          </div>

          {selectedItem ? (
            <div
              className="selected-card selected"
              onClick={spinning ? undefined : resetSelection}
            >
              <img
                src={selectedItem.image}
                alt={selectedItem.name}
              />

              <div className="selected-name">
                {selectedItem.isBalanceStake
                  ? "Ставка с баланса"
                  : selectedItem.name}
              </div>

              <div className="selected-price">
                {getPrice(selectedItem).toLocaleString("ru-RU")} ₽
              </div>
            </div>
          ) : (
            <div className="selected-card empty">
              <span>
                Выбери предмет ниже
              </span>
            </div>
          )}

          <div className="balance-stake-control">
            <div className="balance-stake-heading">
              <span>СТАВКА С БАЛАНСА</span>
              <strong>
                {effectiveBalanceStake.toLocaleString("ru-RU")} ₽
              </strong>
            </div>

            <input
              className="balance-stake-slider"
              type="range"
              min={
                maxBalanceStake > 0
                  ? Math.min(0.01, maxBalanceStake)
                  : 0
              }
              max={maxBalanceStake}
              step="0.01"
              value={effectiveBalanceStake}
              disabled={
                spinning ||
                typeof setBalance !== "function" ||
                maxBalanceStake < 0.01
              }
              onChange={(event) =>
                updateBalanceStake(event.target.value)
              }
              aria-label="Размер ставки с баланса"
            />

            <div className="balance-stake-input-row">
              <input
                type="number"
                min="0.01"
                max={maxBalanceStake}
                step="0.01"
                value={
                  effectiveBalanceStake > 0
                    ? effectiveBalanceStake
                    : ""
                }
                disabled={
                  spinning ||
                  typeof setBalance !== "function" ||
                  maxBalanceStake < 0.01
                }
                onChange={(event) =>
                  updateBalanceStake(event.target.value)
                }
                aria-label="Ввести сумму ставки"
              />

              <button
                type="button"
                className="balance-stake-max"
                disabled={
                  spinning ||
                  typeof setBalance !== "function" ||
                  maxBalanceStake < 0.01
                }
                onClick={() =>
                  updateBalanceStake(maxBalanceStake)
                }
              >
                MAX
              </button>
            </div>

            {sourceMode === "balance" &&
              selectedItem?.isBalanceStake && (
                <div className="balance-stake-active">
                  СТАВКА ВЫБРАНА
                </div>
              )}
          </div>
        </div>

        <div className="upgrade-wheel-area">
          <div className="upgrade-wheel">
            <div className="upgrade-pointer" aria-hidden="true">
              <svg
                viewBox="0 0 52 46"
                className="upgrade-pointer-svg"
                focusable="false"
              >
                <path
                  d="M26 5 V23"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M12 18 Q17 29 26 39 Q35 29 40 18"
                  fill="none"
                  stroke="currentColor"
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
                  ? "transform 10s cubic-bezier(0.08, 0.85, 0.12, 1)"
                  : "none",
                background: `conic-gradient(
                  from 0deg,
                  #f5c400 0deg,
                  #f5c400 ${(displayChance / 100) * 360}deg,
                  #111111 ${(displayChance / 100) * 360}deg,
                  #111111 360deg
                )`
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
                {displayChance > 0
                  ? `${displayChance}%`
                  : "—"}
              </div>

              <div className="upgrade-wheel-label">
                ШАНС
              </div>
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
                style={{ outline: "none" }}
              >
                x{multiplier}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="upgrade-button"
            disabled={
              !selectedItem ||
              !selectedTarget ||
              spinning ||
              (sourceMode === "balance" &&
                currentBalance < getPrice(selectedItem))
            }
            onClick={startUpgrade}
            style={{ outline: "none" }}
          >
            {spinning ? "АПГРЕЙД..." : "АПГРЕЙД"}
          </button>
        </div>

        <div className="selected-side target-side">
          <div className="selected-title">
            ЦЕЛЬ
          </div>

          {selectedTarget ? (
            <div className="selected-card target selected">
              <img
                src={selectedTarget.image}
                alt={selectedTarget.name}
              />

              <div className="selected-name">
                {selectedTarget.name}
              </div>

              <div className="selected-price">
                {getPrice(selectedTarget).toLocaleString("ru-RU")} ₽
              </div>
            </div>
          ) : (
            <div className="selected-card target empty">
              <span>
                Выбери цель ниже
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="upgrade-selection">
        <div className="selection-panel">
          <div className="selection-header">
            <div>
              <h2>
                {tab === "inventory" ? "Инвентарь" : "Маркет"}
              </h2>

              <span>
                {tab === "inventory"
                  ? "Твои предметы"
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
                style={{ outline: "none" }}
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
                style={{ outline: "none" }}
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
                      selectedInventoryIndex === index)

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
                      style={{
                        outline: "none",
                        WebkitTapHighlightColor: "transparent"
                      }}
                    >
                      <img
                        src={item.image || "/avatar.png"}
                        alt={item.name}
                      />

                      <span>{item.name}</span>

                      <strong>
                        {getPrice(item).toLocaleString("ru-RU")} ₽
                      </strong>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="empty-selection">
                Инвентарь пуст
              </div>
            )
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "14px",
                  flexWrap: "wrap",
                  alignItems: "center"
                }}
              >
                <input
                  type="text"
                  value={marketSearch}
                  onChange={(event) =>
                    setMarketSearch(event.target.value)
                  }
                  placeholder="Поиск скина..."
                  style={filterInputStyle}
                  onFocus={(event) => {
                    event.currentTarget.style.outline = "none"
                  }}
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
                  <option value="price-asc">
                    Цена: по возрастанию
                  </option>
                  <option value="price-desc">
                    Цена: по убыванию
                  </option>
                  <option value="name-asc">
                    Название: А → Я
                  </option>
                  <option value="name-desc">
                    Название: Я → А
                  </option>
                </select>

                <button
                  type="button"
                  style={actionButtonStyle}
                  onClick={() => setCartOpen((value) => !value)}
                >
                  Корзина ({cart.length})
                </button>
              </div>

              {cartOpen && (
                <div
                  className="selection-panel"
                  style={{
                    marginBottom: "14px",
                    padding: "14px"
                  }}
                >
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
                        style={actionButtonStyle}
                        onClick={() => setCart([])}
                      >
                        Очистить
                      </button>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="selection-grid">
                      {cart.map((item, index) => (
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
                          />

                          <span>{item.name}</span>

                          <strong>
                            {getPrice(item).toLocaleString("ru-RU")} ₽
                          </strong>

                          <div
                            style={{
                              display: "flex",
                              gap: "6px"
                            }}
                          >
                            <button
                              type="button"
                              className="inventory-buy-button"
                              disabled={
                                spinning ||
                                currentBalance < getPrice(item)
                              }
                              onClick={() => buySkin(item)}
                              style={{ outline: "none" }}
                            >
                              {currentBalance >= getPrice(item)
                                ? "Купить"
                                : "Недостаточно"}
                            </button>

                            <button
                              type="button"
                              style={actionButtonStyle}
                              onClick={() => removeFromCart(item)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {marketLoading ? (
                <div className="empty-selection">
                  Загружаем до 100 скинов...
                </div>
              ) : (
                <div className="selection-grid">
                  {filteredMarket.map((item, index) => {
                    const price = getPrice(item)
                    const canBuy = currentBalance >= price

                    const cartKey =
                      item?.market_hash_name ||
                      item?.id ||
                      item?.name

                    const inCart = cart.some(
                      (cartItem) =>
                        (cartItem?.market_hash_name ||
                          cartItem?.id ||
                          cartItem?.name) === cartKey
                    )

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
                          style={{ outline: "none" }}
                        >
                          {inCart ? "В корзине" : "В корзину"}
                        </button>

                        <button
                          type="button"
                          className="inventory-buy-button"
                          disabled={spinning || !canBuy}
                          onClick={() => buySkin(item)}
                          style={{ outline: "none" }}
                        >
                          {canBuy ? "Купить" : "Недостаточно"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {marketError && (
                <div
                  className="empty-selection"
                  role="alert"
                  style={{ marginTop: 12 }}
                >
                  {marketError}
                </div>
              )}

              {(marketHasMore || marketError) && (
                <button
                  type="button"
                  disabled={marketLoading || marketLoadingMore}
                  onClick={() =>
                    loadMarketSkins(!market.length && marketStart === 0)
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 12,
                    padding: "12px 14px",
                    border: "1px solid #514515",
                    borderRadius: 8,
                    background: "#111111",
                    color: "#f5c400",
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "none",
                    opacity:
                      marketLoading || marketLoadingMore ? 0.55 : 1
                  }}
                >
                  {marketLoadingMore
                    ? "ЗАГРУЗКА..."
                    : marketError
                    ? "ПОВТОРИТЬ ЗАГРУЗКУ"
                    : "ЗАГРУЗИТЬ ЕЩЁ"}
                </button>
              )}

              {!marketLoading && filteredMarket.length === 0 && (
                <div className="empty-selection">
                  Ничего не найдено
                </div>
              )}
            </>
          )}
        </div>

        <div className="selection-panel">
          <div className="selection-header">
            <div>
              <h2>Выбор цели</h2>

              <span>
                Все скины рынка · цель должна быть дороже своего предмета
              </span>
            </div>

            <div className="market-label">
              ЦЕЛЬ
            </div>
          </div>

          {marketLoading ? (
            <div className="empty-selection">
              Загружаем цели...
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "14px",
                  flexWrap: "wrap",
                  alignItems: "center"
                }}
              >
                <input
                  type="text"
                  value={targetSearch}
                  onChange={(event) =>
                    setTargetSearch(event.target.value)
                  }
                  placeholder="Поиск цели..."
                  style={filterInputStyle}
                  onFocus={(event) => {
                    event.currentTarget.style.outline = "none"
                  }}
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
                  <option value="price-asc">
                    Цена: по возрастанию
                  </option>
                  <option value="price-desc">
                    Цена: по убыванию
                  </option>
                  <option value="name-asc">
                    Название: А → Я
                  </option>
                  <option value="name-desc">
                    Название: Я → А
                  </option>
                </select>
              </div>

              <div className="selection-grid">
                {filteredTargetMarket.map((item, index) => {
                  const price = getPrice(item)
                  const sourcePrice = getPrice(selectedItem)

                  const disabled =
                    !selectedItem ||
                    price <= sourcePrice

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
                    getPrice(selectedTarget) === price

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
                      style={{
                        outline: "none",
                        WebkitTapHighlightColor: "transparent"
                      }}
                    >
                      <img
                        src={item.image || "/avatar.png"}
                        alt={item.name}
                      />

                      <span>{item.name}</span>

                      <strong>
                        {price.toLocaleString("ru-RU")} ₽
                      </strong>
                    </button>
                  )
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
                  src={result.item.image}
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
                    style={{ outline: "none" }}
                  >
                    Продать
                  </button>

                  <button
                    type="button"
                    className="result-inventory-button"
                    onClick={keepResult}
                    style={{ outline: "none" }}
                  >
                    В инвентарь
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="upgrade-fail-text">
                  {result.balanceStake
                    ? "Ставка потеряна."
                    : "Предмет потерян."}
                </div>

                <button
                  type="button"
                  className="result-inventory-button only"
                  onClick={closeResult}
                  style={{ outline: "none" }}
                >
                  Закрыть
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Upgrade