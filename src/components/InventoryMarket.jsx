import { useEffect, useMemo, useState } from "react"

import { getMarketSkins } from "../lib/marketSkins"

function InventoryMarket({
  balance = 0,
  setBalance,
  inventory = [],
  setInventory,
  onSelect,
  selectedUid = null,
  title = "Предметы"
}) {
  const [tab, setTab] = useState("inventory")

  const [message, setMessage] = useState("")

  const [skins, setSkins] = useState([])

  const [loading, setLoading] = useState(false)

  const [loadingMore, setLoadingMore] = useState(false)

  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState("")

  const items = Array.isArray(inventory)
    ? inventory
    : []

  useEffect(() => {
    loadInitialSkins()
  }, [])

  async function loadInitialSkins() {
    if (skins.length > 0) {
      return
    }

    setLoading(true)

    try {
      const data = await getMarketSkins({
        start: 0,
        count: 100
      })

      setSkins(
        Array.isArray(data.items)
          ? data.items
          : []
      )

      setTotal(
        Number(data.total || 0)
      )
    } catch (error) {
      console.error(
        "Ошибка загрузки Market:",
        error
      )

      setMessage(
        "Не удалось загрузить маркет"
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadMoreSkins() {
    if (loadingMore) {
      return
    }

    if (
      skins.length >= total &&
      total > 0
    ) {
      return
    }

    setLoadingMore(true)

    try {
      const data = await getMarketSkins({
        start: skins.length,
        count: 100
      })

      const newItems =
        Array.isArray(data.items)
          ? data.items
          : []

      setSkins((current) => {
        const map = new Map()

        for (const item of current) {
          map.set(
            item.market_hash_name ||
              item.id ||
              item.name,
            item
          )
        }

        for (const item of newItems) {
          map.set(
            item.market_hash_name ||
              item.id ||
              item.name,
            item
          )
        }

        return Array.from(map.values())
      })

      setTotal(
        Number(data.total || total)
      )
    } catch (error) {
      console.error(
        "Ошибка загрузки дополнительных скинов:",
        error
      )

      setMessage(
        "Не удалось загрузить ещё скины"
      )
    } finally {
      setLoadingMore(false)
    }
  }

  function showMessage(text) {
    setMessage(text)

    setTimeout(() => {
      setMessage("")
    }, 1800)
  }

  function buySkin(skin) {
    const price = Number(
      skin.price ??
      skin.cost ??
      0
    )

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      showMessage("Ошибка цены")
      return
    }

    if (Number(balance) < price) {
      showMessage("Недостаточно баланса")
      return
    }

    const newItem = {
      ...skin,

      uid: `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`
    }

    if (typeof setBalance === "function") {
      setBalance(
        (prev) =>
          Number(prev || 0) - price
      )
    }

    if (typeof setInventory === "function") {
      setInventory((prev) => [
        ...(Array.isArray(prev)
          ? prev
          : []),
        newItem
      ])
    }

    showMessage("Скин куплен")
  }

  function handleInventoryClick(item) {
    if (typeof onSelect === "function") {
      onSelect(item)
    }
  }

  const filteredSkins = useMemo(() => {
    const query =
      search.trim().toLowerCase()

    if (!query) {
      return skins
    }

    return skins.filter((skin) => {
      const name =
        String(
          skin.name ||
          skin.market_hash_name ||
          ""
        ).toLowerCase()

      return name.includes(query)
    })
  }, [skins, search])

  return (
    <div className="inventory-market-box">

      <div className="inventory-market-header">

        <div>
          <span>ITEMS</span>
          <h3>{title}</h3>
        </div>

        <div className="inventory-market-tabs">

          <button
            type="button"
            className={
              tab === "inventory"
                ? "inventory-market-tab active"
                : "inventory-market-tab"
            }
            onClick={() =>
              setTab("inventory")
            }
          >
            Инвентарь
          </button>

          <button
            type="button"
            className={
              tab === "market"
                ? "inventory-market-tab active"
                : "inventory-market-tab"
            }
            onClick={() => {
              setTab("market")

              if (!skins.length) {
                loadInitialSkins()
              }
            }}
          >
            Маркет
          </button>

        </div>

      </div>

      {message && (
        <div className="inventory-market-message">
          {message}
        </div>
      )}

      {tab === "inventory" && (
        <div className="inventory-market-grid">

          {items.length === 0 ? (
            <div className="inventory-market-empty">
              Инвентарь пуст
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected =
                selectedUid &&
                item.uid === selectedUid

              const price = Number(
                item.price ??
                item.cost ??
                0
              )

              return (
                <button
                  type="button"
                  className={
                    isSelected
                      ? "inventory-market-item selected"
                      : "inventory-market-item"
                  }
                  key={
                    item.uid ||
                    `${item.name}-${index}`
                  }
                  onClick={() =>
                    handleInventoryClick(item)
                  }
                >

                  <div className="inventory-market-image">

                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : (
                      <span>?</span>
                    )}

                  </div>

                  <div className="inventory-market-info">

                    <strong>
                      {item.name ||
                        "Предмет"}
                    </strong>

                    <span>
                      {price.toLocaleString(
                        "ru-RU"
                      )} ₽
                    </span>

                  </div>

                </button>
              )
            })
          )}

        </div>
      )}

      {tab === "market" && (
        <div className="inventory-market-market">

          <div className="inventory-market-search">

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Поиск скина..."
            />

            <span>
              {skins.length.toLocaleString(
                "ru-RU"
              )}
            </span>

          </div>

          {loading && (
            <div className="inventory-market-loading">
              Загружаем скины...
            </div>
          )}

          {!loading &&
            filteredSkins.length === 0 && (
              <div className="inventory-market-empty">
                Ничего не найдено
              </div>
            )}

          {!loading && (
            <div className="inventory-market-grid">

              {filteredSkins.map(
                (skin, index) => {
                  const price = Number(
                    skin.price ??
                    skin.cost ??
                    0
                  )

                  return (
                    <div
                      className="inventory-market-item market-item"
                      key={
                        skin.market_hash_name ||
                        skin.id ||
                        `${skin.name}-${index}`
                      }
                    >

                      <div className="inventory-market-image">

                        {skin.image ? (
                          <img
                            src={skin.image}
                            alt={skin.name}
                            loading="lazy"
                          />
                        ) : (
                          <span>?</span>
                        )}

                      </div>

                      <div className="inventory-market-info">

                        <strong>
                          {skin.name}
                        </strong>

                        <span>
                          {price.toLocaleString(
                            "ru-RU"
                          )} ₽
                        </span>

                        <button
                          type="button"
                          className="inventory-buy-button"
                          onClick={() =>
                            buySkin(skin)
                          }
                        >
                          Купить
                        </button>

                      </div>

                    </div>
                  )
                }
              )}

            </div>
          )}

          {!loading &&
            skins.length < total && (
              <button
                type="button"
                className="inventory-market-load-more"
                onClick={loadMoreSkins}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Загрузка..."
                  : `Загрузить ещё · ${
                      Math.max(
                        total - skins.length,
                        0
                      ).toLocaleString(
                        "ru-RU"
                      )}`}
              </button>
            )}

        </div>
      )}

    </div>
  )
}

export default InventoryMarket