import { useState } from "react"
import "./Withdraw.css"

const methods = [
  {
    id: "usdt",
    name: "USDT",
    description: "Вывод криптовалюты",
    image: "/usdt.png"
  },
  {
    id: "gram",
    name: "GRAM",
    description: "Вывод криптовалюты",
    image: "/gram.png"
  },
  {
    id: "steam",
    name: "Steam",
    description: "Вывод на Steam",
    image: "/steam.png"
  }
]

function Withdraw({
  balance = 0,
  setBalance
}) {
  const [selectedMethod, setSelectedMethod] =
    useState(null)

  const [amount, setAmount] =
    useState("")

  const [details, setDetails] =
    useState("")

  const [message, setMessage] =
    useState("")

  function chooseMethod(method) {
    setSelectedMethod(method)
    setMessage("")
  }

  function handleAmountChange(e) {
    const value = e.target.value

    if (
      value === "" ||
      /^\d*\.?\d*$/.test(value)
    ) {
      setAmount(value)
      setMessage("")
    }
  }

  function submitWithdraw() {
    const withdrawAmount =
      Number(amount)

    if (!selectedMethod) {
      setMessage(
        "Сначала выбери способ вывода"
      )
      return
    }

    if (
      !withdrawAmount ||
      withdrawAmount <= 0
    ) {
      setMessage(
        "Введите сумму вывода"
      )
      return
    }

    if (
      withdrawAmount >
      Number(balance || 0)
    ) {
      setMessage(
        "Недостаточно средств на балансе"
      )
      return
    }

    if (!details.trim()) {
      setMessage(
        "Введите реквизиты"
      )
      return
    }

    if (
      typeof setBalance === "function"
    ) {
      setBalance(
        prev =>
          Number(prev || 0) -
          withdrawAmount
      )
    }

    setMessage(
      `Заявка на вывод ${withdrawAmount.toLocaleString(
        "ru-RU"
      )} ₽ создана`
    )

    setAmount("")
    setDetails("")
  }

  return (
    <div className="withdraw-page">

      <div className="withdraw-container">

        <div className="withdraw-header">

          <div className="withdraw-kicker">
            KOCH DROP
          </div>

          <h1>
            Вывод
          </h1>

          <p>
            Выбери способ вывода и
            укажи необходимые данные
          </p>

        </div>

        <div className="withdraw-balance">

          <div>
            <span>
              ДОСТУПНО
            </span>

            <strong>
              {Number(
                balance || 0
              ).toLocaleString(
                "ru-RU"
              )} ₽
            </strong>
          </div>

          <div className="withdraw-balance-mark">
            ₽
          </div>

        </div>

        <div className="withdraw-section-title">
          <span>01</span>
          <h2>
            Способ вывода
          </h2>
        </div>

        <div className="withdraw-methods">

          {methods.map((method) => {

            const active =
              selectedMethod?.id ===
              method.id

            return (
              <button
                type="button"
                key={method.id}
                className={
                  active
                    ? "withdraw-method active"
                    : "withdraw-method"
                }
                onClick={() =>
                  chooseMethod(method)
                }
              >

                <div className="withdraw-method-image">
                  <img
                    src={method.image}
                    alt={method.name}
                  />
                </div>

                <div className="withdraw-method-info">

                  <strong>
                    {method.name}
                  </strong>

                  <span>
                    {method.description}
                  </span>

                </div>

                <div className="withdraw-method-arrow">
                  →
                </div>

              </button>
            )
          })}

        </div>

        <div className="withdraw-form">

          <div className="withdraw-section-title">
            <span>02</span>
            <h2>
              Данные вывода
            </h2>
          </div>

          <div className="withdraw-form-grid">

            <div className="withdraw-input-block">

              <label>
                СУММА
              </label>

              <div className="withdraw-input-wrap">

                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={
                    handleAmountChange
                  }
                />

                <span>
                  ₽
                </span>

              </div>

            </div>

            <div className="withdraw-input-block">

              <label>
                РЕКВИЗИТЫ
              </label>

              <input
                type="text"
                placeholder={
                  selectedMethod
                    ? selectedMethod.id ===
                      "steam"
                      ? "Введите Steam ID / ссылку"
                      : "Введите адрес кошелька"
                    : "Сначала выберите способ"
                }
                value={details}
                disabled={!selectedMethod}
                onChange={(e) => {
                  setDetails(
                    e.target.value
                  )
                  setMessage("")
                }}
              />

            </div>

          </div>

          <button
            type="button"
            className="withdraw-submit"
            onClick={
              submitWithdraw
            }
          >
            <span>
              Создать заявку
            </span>

            <strong>
              →
            </strong>
          </button>

          {message && (
            <div className="withdraw-message">
              {message}
            </div>
          )}

        </div>

      </div>

    </div>
  )
}

export default Withdraw