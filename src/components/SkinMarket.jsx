import { useState } from "react"
import { useEffect, useState } from "react"
import { getMarketSkins } from "../lib/marketSkins"

function SkinMarket({
  balance = 0,
  setBalance,
  inventory = [],
  setInventory,
  title = "Маркет"
}) {
  const [message, setMessage] = useState("")

  function buySkin(skin) {
    const price = Number(skin.price ?? skin.cost ?? 0)

    if (price <= 0) {
      setMessage("У скина указана неправильная цена")
      return
    }

    if (Number(balance) < price) {
      setMessage("Недостаточно баланса")
      return
    }

    const item = {
      ...skin,
      uid: `${Date.now()}-${Math.random()}`,
      price
    }

    setBalance(prev => Number(prev) - price)

    setInventory(prev => [
      ...(Array.isArray(prev) ? prev : []),
      item
    ])

    setMessage(`Куплено: ${skin.name}`)

    setTimeout(() => {
      setMessage("")
    }, 1800)
  }

  return (
    <div className="skin-market">

      <div className="skin-market-head">
        <div>
          <span className="skin-market-kicker">KOCH DROP</span>
          <h3>{title}</h3>
        </div>

        <div className="skin-market-balance">
          {Number(balance).toLocaleString("ru-RU")} ₽
        </div>
      </div>

      {message && (
        <div className="skin-market-message">
          {message}
        </div>
      )}

      <div className="skin-market-grid">
        {skins.map((skin, index) => {
          const price = Number(
            skin.price ?? skin.cost ?? 0
          )

          return (
            <div
              className="skin-market-card"
              key={`${skin.name}-${index}`}
            >
              <div className="skin-market-image">
                <img
                  src={skin.image}
                  alt={skin.name}
                />
              </div>

              <div className="skin-market-info">
                <strong>{skin.name}</strong>

                <div className="skin-market-bottom">
                  <span>
                    {price.toLocaleString("ru-RU")} ₽
                  </span>

                  <button
                    type="button"
                    onClick={() => buySkin(skin)}
                  >
                    Купить
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

export default SkinMarket