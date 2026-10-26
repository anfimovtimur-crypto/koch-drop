import { useState } from "react"
import "./Bonuses.css"
import promocodes from "../data/promocodes"

function Bonuses({ balance, setBalance }) {
  const [code, setCode] = useState("")
  const [message, setMessage] = useState("")

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  const dailyClaimed =
    localStorage.getItem("koch_daily_bonus") === today

  function claimDaily() {
    if (dailyClaimed) {
      setMessage("Ежедневный бонус уже получен")
      return
    }

    setBalance(
      (prev) => Number(prev || 0) + 20
    )

    localStorage.setItem(
      "koch_daily_bonus",
      today
    )

    setMessage("Бонус +20 ₽ зачислен")
  }

  function activatePromo() {
    const enteredCode =
      code.trim().toUpperCase()

    if (!enteredCode) {
      setMessage("Введите промокод")
      return
    }

    const promo = promocodes.find(
      (item) =>
        String(item.code).toUpperCase() ===
        enteredCode
    )

    if (!promo) {
      setMessage("Промокод не найден")
      return
    }

    const reward = Number(
      promo.amount ??
      promo.reward ??
      promo.balance ??
      0
    )

    if (reward <= 0) {
      setMessage("У промокода нет награды")
      return
    }

    setBalance(
      (prev) =>
        Number(prev || 0) + reward
    )

    setCode("")

    setMessage(
      `Промокод активирован: +${reward} ₽`
    )
  }

  return (
    <div className="bonuses-page">

      <div className="bonuses-container">

        <div className="bonuses-header">

          <img
            src="/logo.png"
            alt="Koch Drop"
            className="bonuses-logo"
          />

          <h1>
            Бонусы
          </h1>

          <p>
            Получай дополнительные награды
            каждый день
          </p>

        </div>


        <div className="bonuses-main">

          {/* ЕЖЕДНЕВНЫЙ БОНУС */}

          <div className="bonus-card">

            

            <div className="bonus-card-body">

              <div className="bonus-status">
                DAILY
              </div>

              <h2>
                Ежедневный бонус
              </h2>

              <p>
                Заходи каждый день и получай
                20 ₽ прямо на свой баланс.
              </p>

              <button
                type="button"
                className={
                  dailyClaimed
                    ? "bonus-button claimed"
                    : "bonus-button"
                }
                disabled={dailyClaimed}
                onClick={claimDaily}
              >
                <span>
                  {dailyClaimed
                    ? "Получено"
                    : "Забрать 20 ₽"}
                </span>

                <strong>
                  {dailyClaimed
                    ? "✓"
                    : "→"}
                </strong>
              </button>

            </div>

          </div>


          {/* TELEGRAM */}

          <div className="bonus-card">

            

            <div className="bonus-card-body">

              <div className="bonus-status">
                TELEGRAM
              </div>

              <h2>
                Подписка на Telegram
              </h2>

              <p>
                Подпишись на наш канал и получи
                дополнительный бонус 10 ₽.
              </p>

              <a
                href="https://t.me/+_S0nYmgMsMVmMTky"
                target="_blank"
                rel="noopener noreferrer"
                className="bonus-button"
              >
                <span>
                  Перейти в Telegram
                </span>

                <strong>
                  →
                </strong>
              </a>

            </div>

          </div>

        </div>


        {/* ПРОМОКОД */}

        <div className="promo-section">

          <div className="promo-title">

            <span>
              PROMO
            </span>

            <h2>
              Промокод
            </h2>

            <p>
              Введи промокод и получи бонус
              на баланс.
            </p>

          </div>

          <div className="promo-form">

            <input
              type="text"
              value={code}
              placeholder="Введите промокод"
              maxLength={32}
              onChange={(e) => {
                setCode(e.target.value)
                setMessage("")
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  activatePromo()
                }
              }}
            />

            <button
              type="button"
              onClick={activatePromo}
            >
              Активировать
              <span>→</span>
            </button>

          </div>

          {message && (
            <div className="promo-message">
              {message}
            </div>
          )}

        </div>

      </div>

    </div>
  )
}

export default Bonuses