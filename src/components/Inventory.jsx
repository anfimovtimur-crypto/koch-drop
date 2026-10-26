import { useMemo, useState } from "react"
import { useEffect, useState } from "react"
import { getMarketSkins } from "../lib/marketSkins"
import "./Inventory.css"

function Inventory({
  inventory,
  balance,
  setBalance,
  setInventory
}) {
  const [marketOpen, setMarketOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState("default")

  const safeInventory = Array.isArray(inventory) ? inventory : []

  const filteredSkins = useMemo(() => {
    let result = [...skins]

    if (search.trim()) {
      const query = search.toLowerCase()

      result = result.filter((item) =>
        item.name.toLowerCase().includes(query)
      )
    }

    if (filter !== "all") {
      result = result.filter((item) => {
        if (filter === "weapon") {
          return item.rarity !== "knife"
        }

        if (filter === "knife") {
          return item.rarity === "knife"
        }

        return item.rarity === filter
      })
    }

    if (sort === "cheap") {
      result.sort((a, b) => a.price - b.price)
    }

    if (sort === "expensive") {
      result.sort((a, b) => b.price - a.price)
    }

    return result
  }, [search, filter, sort])

  function sellItem(item, index) {
    const price = Number(item.price || 0)

    setBalance((prev) => prev + price)

    setInventory((prev) =>
      prev.filter((_, i) => i !== index)
    )
  }

  function buyItem(item) {
    const price = Number(item.price || 0)

    if (balance < price) {
      alert("❌ Недостаточно средств")
      return
    }

    const boughtItem = {
      ...item,
      id: `${Date.now()}-${Math.random()}`
    }

    setBalance((prev) => prev - price)

    setInventory((prev) => [
      ...prev,
      boughtItem
    ])
  }

  function rarityName(rarity) {
    const names = {
      consumer: "Consumer",
      "mil-spec": "Mil-Spec",
      restricted: "Restricted",
      classified: "Classified",
      covert: "Covert",
      knife: "Knife"
    }

    return names[rarity] || rarity
  }

  return (
    <div className="inventory-container">

      {/* =================================================
          SWITCH
      ================================================= */}

      <div className="inventory-switch">

        <button
          className={!marketOpen ? "switch-active" : ""}
          onClick={() => setMarketOpen(false)}
        >
          <span>🎒</span>
          Инвентарь
        </button>

        <button
          className={marketOpen ? "switch-active" : ""}
          onClick={() => setMarketOpen(true)}
        >
          <span>🛒</span>
          Маркет
        </button>

      </div>


      {/* =================================================
          INVENTORY
      ================================================= */}

      {!marketOpen && (
        <div className="inventory-section">

          <div className="inventory-top">

            <div>
              <span className="inventory-small-label">
                COLLECTION
              </span>

              <h2>
                Твои предметы
              </h2>

              <p>
                Выбирай скины для контрактов или продавай их
              </p>
            </div>

            <div className="inventory-count">
              {safeInventory.length}
            </div>

          </div>


          {safeInventory.length === 0 ? (

            <div className="inventory-empty">

              <div className="empty-icon">
                🎒
              </div>

              <h3>
                Инвентарь пуст
              </h3>

              <p>
                Открой маркет и купи свой первый скин
              </p>

              <button
                className="empty-market-button"
                onClick={() => setMarketOpen(true)}
              >
                Открыть маркет
              </button>

            </div>

          ) : (

            <div className="inventory-grid">

              {safeInventory.map((item, index) => (

                <div
                  key={item.id || index}
                  className={`market-skin-card rarity-${item.rarity || "consumer"}`}
                >

                  <div className="skin-rarity-line"></div>

                  <div className="skin-image-container">

                    <img
                      src={item.image || "/skins/default.png"}
                      alt={item.name}
                      className="inventory-skin-image"
                    />

                  </div>

                  <div className="skin-card-info">

                    <span className="skin-rarity">
                      {rarityName(item.rarity)}
                    </span>

                    <h3>
                      {item.name}
                    </h3>

                    <div className="skin-card-bottom">

                      <strong>
                        {Number(item.price || 0).toLocaleString("ru-RU")}₽
                      </strong>

                      <button
                        className="sell-skin-button"
                        onClick={() => sellItem(item, index)}
                      >
                        Продать
                      </button>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>
      )}


      {/* =================================================
          MARKET
      ================================================= */}

      {marketOpen && (
        <div className="market-section">

          <div className="market-heading">

            <div>

              <span className="market-small-label">
                CONTRACTER MARKET
              </span>

              <h2>
                Маркет
              </h2>

              <p>
                Покупай предметы и используй их в апгрейде и контрактах
              </p>

            </div>

            <div className="market-balance">

              <span>
                БАЛАНС
              </span>

              <strong>
                {Number(balance || 0).toLocaleString("ru-RU")}₽
              </strong>

            </div>

          </div>


          {/* SEARCH + FILTERS */}

          <div className="market-controls">

            <div className="market-search">

              <span>
                🔎
              </span>

              <input
                type="text"
                placeholder="Поиск скина..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {search && (
                <button
                  className="clear-search"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}

            </div>


            <div className="market-filters">

              <button
                className={filter === "all" ? "filter-active" : ""}
                onClick={() => setFilter("all")}
              >
                Все
              </button>

              <button
                className={filter === "weapon" ? "filter-active" : ""}
                onClick={() => setFilter("weapon")}
              >
                Оружие
              </button>

              <button
                className={filter === "consumer" ? "filter-active" : ""}
                onClick={() => setFilter("consumer")}
              >
                Consumer
              </button>

              <button
                className={filter === "mil-spec" ? "filter-active" : ""}
                onClick={() => setFilter("mil-spec")}
              >
                Mil-Spec
              </button>

              <button
                className={filter === "restricted" ? "filter-active" : ""}
                onClick={() => setFilter("restricted")}
              >
                Restricted
              </button>

              <button
                className={filter === "classified" ? "filter-active" : ""}
                onClick={() => setFilter("classified")}
              >
                Classified
              </button>

              <button
                className={filter === "covert" ? "filter-active" : ""}
                onClick={() => setFilter("covert")}
              >
                Covert
              </button>

              <button
                className={filter === "knife" ? "filter-active" : ""}
                onClick={() => setFilter("knife")}
              >
                Ножи
              </button>

            </div>


            <select
              className="market-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="default">
                Сортировка
              </option>

              <option value="cheap">
                Сначала дешёвые
              </option>

              <option value="expensive">
                Сначала дорогие
              </option>
            </select>

          </div>


          {/* MARKET COUNT */}

          <div className="market-result-info">

            <span>
              Найдено предметов: <b>{filteredSkins.length}</b>
            </span>

            <span>
              Все предметы доступны для апгрейда
            </span>

          </div>


          {/* SKINS */}

          {filteredSkins.length === 0 ? (

            <div className="market-empty">

              <div>
                🔎
              </div>

              <h3>
                Ничего не найдено
              </h3>

              <p>
                Попробуй изменить поиск или фильтр
              </p>

            </div>

          ) : (

            <div className="market-grid">

              {filteredSkins.map((item, index) => (

                <div
                  key={`${item.name}-${index}`}
                  className={`market-skin-card rarity-${item.rarity || "consumer"}`}
                >

                  <div className="skin-rarity-line"></div>


                  <div className="market-card-top">

                    <span className="skin-rarity">
                      {rarityName(item.rarity)}
                    </span>

                    <span className="skin-number">
                      #{String(index + 1).padStart(2, "0")}
                    </span>

                  </div>


                  <div className="skin-image-container">

                    <img
                      src={item.image || "/skins/default.png"}
                      alt={item.name}
                      className="market-skin-image"
                      onError={(e) => {
                        e.currentTarget.src = "/skins/default.png"
                      }}
                    />

                  </div>


                  <div className="market-card-info">

                    <h3>
                      {item.name}
                    </h3>

                    <div className="market-card-bottom">

                      <div className="market-price">

                        <span>
                          Цена
                        </span>

                        <strong>
                          {Number(item.price || 0).toLocaleString("ru-RU")}₽
                        </strong>

                      </div>

                      <button
                        className="buy-skin-button"
                        onClick={() => buyItem(item)}
                      >
                        Купить
                      </button>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>
      )}

    </div>
  )
}

export default Inventory