import { useMemo, useRef, useState } from "react"

import skins from "../data/skins"

import "./Contracts.css"

function Contracts({
  inventory = [],
  setInventory,
  balance,
  setBalance,
  setPage
}) {
  const [selected, setSelected] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [rouletteItems, setRouletteItems] = useState([])
  const [result, setResult] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [rouletteKey, setRouletteKey] = useState(0)

  const trackRef = useRef(null)
  const animationRef = useRef(null)

  const totalPrice = useMemo(() => {
    return selected.reduce(
      (sum, item) => sum + Number(item.price || 0),
      0
    )
  }, [selected])

  // =========================
  // XP ИВЕНТА
  // =========================

  const addEventXP = (amount) => {
    const oldXP = Number(
      localStorage.getItem("eventXP") || 0
    )

    const newXP = oldXP + amount

    localStorage.setItem(
      "eventXP",
      String(newXP)
    )

    window.dispatchEvent(
      new Event("contracter-xp")
    )
  }

  // =========================
  // ДОБАВЛЕНИЕ ПРЕДМЕТА
  // =========================

  const addItem = (item, index) => {
    if (spinning) return
    if (selected.length >= 10) return

    const alreadySelected = selected.some(
      selectedItem =>
        selectedItem.inventoryIndex === index
    )

    if (alreadySelected) return

    setSelected(prev => [
      ...prev,
      {
        ...item,
        inventoryIndex: index
      }
    ])
  }

  // =========================
  // УДАЛЕНИЕ ПРЕДМЕТА
  // =========================

  const removeItem = index => {
    if (spinning) return

    setSelected(prev =>
      prev.filter((_, i) => i !== index)
    )
  }

  // =========================
  // ВЫБОР РЕЗУЛЬТАТА
  // =========================

  const chooseResult = () => {
    if (!skins.length) return null

    const contract = totalPrice

    const cheap = skins.filter(item => {
      const price = Number(item.price || 0)

      return (
        price >= 1 &&
        price < contract
      )
    })

    const normal = skins.filter(item => {
      const price = Number(item.price || 0)

      return (
        price >= contract &&
        price <= contract * 1.5
      )
    })

    const profit = skins.filter(item => {
      const price = Number(item.price || 0)

      return (
        price > contract * 1.5 &&
        price <= contract * 4
      )
    })

    const huge = skins.filter(item => {
      const price = Number(item.price || 0)

      return price > contract * 4
    })

    const roll = Math.random()

    let pool

    // 70% — предмет дешевле контракта
    if (roll < 0.70 && cheap.length) {
      pool = cheap
    }

    // 20% — примерно стоимость контракта
    else if (roll < 0.90 && normal.length) {
      pool = normal
    }

    // 9% — хороший плюс
    else if (roll < 0.99 && profit.length) {
      pool = profit
    }

    // 1% — огромный плюс
    else if (huge.length) {
      pool = huge
    }

    // Если нужного пула нет
    else if (profit.length) {
      pool = profit
    }

    else if (normal.length) {
      pool = normal
    }

    else if (cheap.length) {
      pool = cheap
    }

    else {
      pool = skins
    }

    return pool[
      Math.floor(
        Math.random() * pool.length
      )
    ]
  }

  // =========================
  // СОЗДАНИЕ РУЛЕТКИ
  // =========================

  const createRoulette = winningItem => {
    const totalItems = 80
    const winnerIndex = 58

    const items = []

    for (let i = 0; i < totalItems; i++) {
      if (i === winnerIndex) {
        items.push(winningItem)
      } else {
        const randomSkin =
          skins[
            Math.floor(
              Math.random() * skins.length
            )
          ]

        items.push(randomSkin)
      }
    }

    return {
      items,
      winnerIndex
    }
  }

  // =========================
  // ЗАПУСК РУЛЕТКИ
  // =========================

  const startRoulette = roulette => {
    const track = trackRef.current

    if (!track) {
      const visualWinner =
        roulette.items[
          roulette.winnerIndex
        ]

      setResult(visualWinner)
      setSpinning(false)

      // XP за контракт
      const earnedXP = Math.floor(
        totalPrice / 10
      )

      if (earnedXP > 0) {
        addEventXP(earnedXP)
      }

      setShowResult(true)

      return
    }

    const firstItem =
      track.children[0]

    if (!firstItem) return

    const itemWidth =
      firstItem.getBoundingClientRect().width

    const trackStyle =
      window.getComputedStyle(track)

    const gap =
      parseFloat(trackStyle.gap) || 10

    const step =
      itemWidth + gap

    const trackWidth =
      track.scrollWidth

    const winnerCenter =
      roulette.winnerIndex * step +
      itemWidth / 2

    const finalOffset =
      trackWidth / 2 -
      winnerCenter

    track.style.transition = "none"

    track.style.transform =
      "translateX(-50%)"

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        track.style.transition =
          "transform 6.5s cubic-bezier(0.08, 0.72, 0.12, 1)"

        track.style.transform =
          `translateX(calc(-50% + ${finalOffset}px))`
      })
    })

    if (animationRef.current) {
      clearTimeout(animationRef.current)
    }

    animationRef.current = setTimeout(() => {
      const visualWinner =
        roulette.items[
          roulette.winnerIndex
        ]

      setResult(visualWinner)
      setSpinning(false)

      // =========================
      // НАЧИСЛЯЕМ XP
      // =========================

      const earnedXP = Math.floor(
        totalPrice / 10
      )

      if (earnedXP > 0) {
        addEventXP(earnedXP)
      }

      setTimeout(() => {
        setShowResult(true)
      }, 150)

    }, 6550)
  }

  // =========================
  // СОЗДАНИЕ КОНТРАКТА
  // =========================

  const createContract = () => {
    if (selected.length < 3) return
    if (selected.length > 10) return
    if (spinning) return
    if (totalPrice <= 0) return

    const winningItem =
      chooseResult()

    if (!winningItem) return

    const roulette =
      createRoulette(winningItem)

    setShowResult(false)
    setResult(null)

    setRouletteItems(
      roulette.items
    )

    setRouletteKey(
      prev => prev + 1
    )

    setSpinning(true)

    // =========================
    // УДАЛЯЕМ ПРЕДМЕТЫ
    // =========================

    const indexes = selected
      .map(item => item.inventoryIndex)
      .sort((a, b) => b - a)

    const newInventory =
      [...inventory]

    indexes.forEach(index => {
      if (
        index >= 0 &&
        index < newInventory.length
      ) {
        newInventory.splice(index, 1)
      }
    })

    setInventory(newInventory)

    // =========================
    // ЗАПУСК РУЛЕТКИ
    // =========================

    setTimeout(() => {
      startRoulette(roulette)
    }, 100)
  }

  // =========================
  // ПРОДАЖА РЕЗУЛЬТАТА
  // =========================

  const sellResult = () => {
    if (!result) return

    const price =
      Number(result.price || 0)

    setBalance(current =>
      Number(current || 0) + price
    )

    setResult(null)
    setShowResult(false)
    setRouletteItems([])
    setSelected([])

    if (trackRef.current) {
      trackRef.current.style.transition =
        "none"

      trackRef.current.style.transform =
        "translateX(-50%)"
    }
  }

  // =========================
  // ОТПРАВИТЬ В АПГРЕЙД
  // =========================

  const upgradeResult = () => {
    if (!result) return

    setInventory(current => [
      ...current,
      result
    ])

    setResult(null)
    setShowResult(false)
    setRouletteItems([])
    setSelected([])

    if (trackRef.current) {
      trackRef.current.style.transition =
        "none"

      trackRef.current.style.transform =
        "translateX(-50%)"
    }

    if (setPage) {
      setPage("upgrade")
    }
  }

  return (
    <div className="contracts-page">

      <div className="contracts-background">

        <div className="blue-glow glow-one"></div>

        <div className="blue-glow glow-two"></div>

        <div className="blue-grid"></div>

      </div>

      <div className="contracts-content">

        <div className="contracts-header">

          <div className="contracts-title">

            <span>
              КОНТРАКТЫ
            </span>

            <h1>
              Создай свой контракт
            </h1>

            <p>
              Объедини минимум 3 предмета
              и получи новый скин
            </p>

          </div>

        </div>

        <div className="contracts-layout single">

          <section className="contract-card">

            <div className="section-header">

              <div>

                <h2>
                  Твой контракт
                </h2>

                <p>
                  Выбери от 3 до 10 предметов
                </p>

              </div>

              <div className="counter">
                {selected.length}/10
              </div>

            </div>

            <div className="contract-slots">

              {Array.from({
                length: 10
              }).map((_, index) => {

                const item =
                  selected[index]

                return (
                  <div
                    key={index}
                    className={`contract-slot ${
                      item
                        ? "has-item"
                        : ""
                    }`}
                    onClick={() =>
                      item &&
                      removeItem(index)
                    }
                  >

                    {item ? (
                      <>
                        <img
                          src={item.image}
                          alt={item.name}
                        />

                        <span>
                          {item.name}
                        </span>

                        <b>
                          {Number(
                            item.price || 0
                          ).toFixed(0)}
                          ₽
                        </b>
                      </>
                    ) : (
                      <div className="empty-slot">

                        <span>
                          +
                        </span>

                        <small>
                          ПРЕДМЕТ
                        </small>

                      </div>
                    )}

                  </div>
                )
              })}

            </div>

            <div className="contract-footer">

              <div className="contract-cost">

                <span>
                  Стоимость контракта
                </span>

                <strong>
                  {totalPrice.toFixed(0)}₽
                </strong>

              </div>

              <button
                className="create-contract"
                disabled={
                  selected.length < 3 ||
                  spinning
                }
                onClick={createContract}
              >

                {spinning
                  ? "Открытие..."
                  : selected.length < 3
                    ? `Нужно ещё ${
                        3 - selected.length
                      }`
                    : "Создать контракт"}

              </button>

            </div>

          </section>

        </div>

        {rouletteItems.length > 0 && (

          <section
            className="roulette-section"
            style={{
              width: "100%"
            }}
          >

            <div className="roulette-title">

              {spinning
                ? ""
                : "РЕЗУЛЬТАТ"}

            </div>

            <div
              className="roulette-wrapper"
              style={{
                width: "100%"
              }}
            >

              <div className="roulette-pointer"></div>

              <div
                key={rouletteKey}
                ref={trackRef}
                className="roulette-track"
              >

                {rouletteItems.map(
                  (item, index) => (

                    <div
                      className="roulette-item"
                      key={`${rouletteKey}-${index}`}
                    >

                      <img
                        src={item.image}
                        alt={item.name}
                      />

                      <span>
                        {item.name}
                      </span>

                      <b>
                        {Number(
                          item.price || 0
                        ).toFixed(0)}
                        ₽
                      </b>

                    </div>

                  )
                )}

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

              <h2>
                Инвентарь
              </h2>

              <p>
                Нажми на предмет,
                чтобы добавить его
              </p>

            </div>

            <div className="inventory-count">
              {inventory.length}
            </div>

          </div>

          {inventory.length === 0 ? (

            <div className="empty-inventory">

              <div>
                📦
              </div>

              <p>
                В инвентаре пока нет
                предметов
              </p>

            </div>

          ) : (

            <div className="inventory-grid">

              {inventory.map(
                (item, index) => {

                  const isSelected =
                    selected.some(
                      selectedItem =>
                        selectedItem.inventoryIndex ===
                        index
                    )

                  return (

                    <div
                      className={`inventory-item ${
                        isSelected
                          ? "inventory-item-selected"
                          : ""
                      }`}
                      key={index}
                      onClick={() =>
                        addItem(
                          item,
                          index
                        )
                      }
                    >

                      <img
                        src={item.image}
                        alt={item.name}
                      />

                      <span>
                        {item.name}
                      </span>

                      <b>
                        {Number(
                          item.price || 0
                        ).toFixed(0)}
                        ₽
                      </b>

                      {isSelected && (

                        <div className="inventory-selected">
                          В контракте
                        </div>

                      )}

                    </div>

                  )
                }
              )}

            </div>

          )}

        </section>

      </div>

      {showResult && result && (

        <div className="result-overlay">

          <div className="result-modal">

            <div className="result-label">
              КОНТРАКТ ЗАВЕРШЁН
            </div>

            <h2>
              Тебе выпал предмет
            </h2>

            <div className="result-item">

              <div className="result-glow"></div>

              <img
                src={result.image}
                alt={result.name}
              />

            </div>

            <h3>
              {result.name}
            </h3>

            <div className="result-price">

              {Number(
                result.price || 0
              ).toFixed(0)}
              ₽

            </div>

            <div className="result-actions">

              <button
                type="button"
                className="sell-button"
                onClick={sellResult}
              >
                💰 Продать
              </button>

              <button
                type="button"
                className="upgrade-button"
                onClick={upgradeResult}
              >

                <img
                  src="/icons/upgrade.png"
                  alt=""
                  className="upgrade-icon"
                />

                <span>
                  В апгрейд
                </span>

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default Contracts