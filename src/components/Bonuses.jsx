import { useState } from "react";
import "./Bonuses.css";
import promocodes from "../data/promocodes";

const USED_PROMOS_KEY = "koch_used_promocodes";

function readUsedPromos() {
  try {
    const saved = localStorage.getItem(USED_PROMOS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed)
      ? parsed.map((code) => String(code).toUpperCase())
      : [];
  } catch {
    return [];
  }
}

function Bonuses({ balance, setBalance }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [usedPromos, setUsedPromos] = useState(readUsedPromos);

  const today = new Date().toISOString().slice(0, 10);

  const dailyClaimed =
    localStorage.getItem("koch_daily_bonus") === today;

  function claimDaily() {
    if (localStorage.getItem("koch_daily_bonus") === today) {
      setMessage("Ежедневный бонус уже получен");
      return;
    }

    setBalance((prev) => Number(prev || 0) + 20);

    localStorage.setItem("koch_daily_bonus", today);

    setMessage("Бонус +20 ₽ зачислен");
  }

  function activatePromo() {
    const enteredCode = code.trim().toUpperCase();

    if (!enteredCode) {
      setMessage("Введите промокод");
      return;
    }

    const promo = promocodes.find(
      (item) =>
        String(item.code).trim().toUpperCase() === enteredCode
    );

    if (!promo) {
      setMessage("Промокод не найден");
      return;
    }

    const canonicalCode = String(promo.code).trim().toUpperCase();

    // Читаем сохранённые коды повторно перед каждой активацией.
    const savedPromos = readUsedPromos();

    if (
      savedPromos.includes(canonicalCode) ||
      usedPromos.includes(canonicalCode)
    ) {
      setMessage("Этот промокод уже был использован");
      return;
    }

    const reward = Number(
      promo.amount ?? promo.reward ?? promo.balance ?? 0
    );

    if (!Number.isFinite(reward) || reward <= 0) {
      setMessage("У промокода нет награды");
      return;
    }

    // Сначала сохраняем использованный промокод,
    // затем начисляем награду.
    try {
      const updatedPromos = [...savedPromos, canonicalCode];

      localStorage.setItem(
        USED_PROMOS_KEY,
        JSON.stringify(updatedPromos)
      );

      setUsedPromos(updatedPromos);
    } catch (error) {
      console.error("Не удалось сохранить промокод:", error);
      setMessage("Не удалось сохранить активацию. Попробуй ещё раз");
      return;
    }

    setBalance((prev) => Number(prev || 0) + reward);
    setCode("");
    setMessage(`Промокод активирован: +${reward} ₽`);
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

          <h1>Бонусы</h1>

          <p>Получай дополнительные награды каждый день</p>
        </div>

        <div className="bonuses-main">
          <div className="bonus-card">
            <div className="bonus-card-body">
              <div className="bonus-status">DAILY</div>

              <h2>Ежедневный бонус</h2>

              <p>
                Заходи каждый день и получай 20 ₽ прямо на свой баланс.
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
                  {dailyClaimed ? "Получено" : "Забрать 20 ₽"}
                </span>

                <strong>{dailyClaimed ? "✓" : "→"}</strong>
              </button>
            </div>
          </div>

          <div className="bonus-card">
            <div className="bonus-card-body">
              <div className="bonus-status">TELEGRAM</div>

              <h2>Подписка на Telegram</h2>

              <p>
                Подпишись на наш канал и получи дополнительный бонус 10 ₽.
              </p>

              <a
                href="https://t.me/+_S0nYmgMsMVmMTky"
                target="_blank"
                rel="noopener noreferrer"
                className="bonus-button"
              >
                <span>Перейти в Telegram</span>
                <strong>→</strong>
              </a>
            </div>
          </div>
        </div>

        <div className="promo-section">
          <div className="promo-title">
            <span>PROMO</span>

            <h2>Промокод</h2>

            <p>
              Введи промокод и получи бонус на баланс.
              Каждый промокод можно использовать только один раз в этом браузере.
            </p>
          </div>

          <div className="promo-form">
            <input
              type="text"
              value={code}
              placeholder="Введите промокод"
              maxLength={32}
              autoComplete="off"
              onChange={(event) => {
                setCode(event.target.value);
                setMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  activatePromo();
                }
              }}
            />

            <button type="button" onClick={activatePromo}>
              Активировать
              <span>→</span>
            </button>
          </div>

          {message && (
            <div className="promo-message" role="status">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Bonuses;