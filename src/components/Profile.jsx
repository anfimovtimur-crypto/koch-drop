import { useEffect, useState } from "react"
import InventoryMarket from "./InventoryMarket"

function formatMoney(value) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) {
    return "0"
  }

  return number.toLocaleString("ru-RU")
}

function loadTopUpgradeDrop() {
  try {
    const saved = localStorage.getItem(
      "koch_top_upgrade_drop"
    )

    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function loadUpgradeStats() {
  try {
    const saved = localStorage.getItem(
      "koch_upgrade_stats"
    )

    if (!saved) {
      return {
        2: 0,
        3: 0,
        5: 0,
        10: 0
      }
    }

    const data = JSON.parse(saved)

    return {
      2: Number(data?.[2] || 0),
      3: Number(data?.[3] || 0),
      5: Number(data?.[5] || 0),
      10: Number(data?.[10] || 0)
    }
  } catch {
    return {
      2: 0,
      3: 0,
      5: 0,
      10: 0
    }
  }
}

function Profile({
  balance,
  inventory = [],
  setBalance,
  setInventory,
  steamUser,
  onLogout
}) {
  const items = Array.isArray(inventory)
    ? inventory
    : []

  const [topDrop, setTopDrop] =
    useState(loadTopUpgradeDrop)

  const [upgradeStats, setUpgradeStats] =
    useState(loadUpgradeStats)

  useEffect(() => {
    function updateProfileStats() {
      setTopDrop(loadTopUpgradeDrop())
      setUpgradeStats(loadUpgradeStats())
    }

    window.addEventListener(
      "koch-top-upgrade-drop",
      updateProfileStats
    )

    window.addEventListener(
      "koch-upgrade-stats",
      updateProfileStats
    )

    window.addEventListener(
      "storage",
      updateProfileStats
    )

    return () => {
      window.removeEventListener(
        "koch-top-upgrade-drop",
        updateProfileStats
      )

      window.removeEventListener(
        "koch-upgrade-stats",
        updateProfileStats
      )

      window.removeEventListener(
        "storage",
        updateProfileStats
      )
    }
  }, [])

  const multipliers = [
    {
      value: 2,
      count: Number(upgradeStats[2] || 0)
    },
    {
      value: 3,
      count: Number(upgradeStats[3] || 0)
    },
    {
      value: 5,
      count: Number(upgradeStats[5] || 0)
    },
    {
      value: 10,
      count: Number(upgradeStats[10] || 0)
    }
  ]

  const totalMultiplierUses =
    multipliers.reduce(
      (sum, item) => sum + item.count,
      0
    )

  let favoriteMultiplier = null

  if (totalMultiplierUses > 0) {
    favoriteMultiplier = multipliers.reduce(
      (best, item) => {
        if (!best) {
          return item
        }

        return item.count > best.count
          ? item
          : best
      },
      null
    )
  }

  const favoritePercent =
    favoriteMultiplier &&
    totalMultiplierUses > 0
      ? Math.round(
          (favoriteMultiplier.count /
            totalMultiplierUses) *
            100
        )
      : 0

  const username =
    steamUser?.persona_name ||
    steamUser?.name ||
    "Steam"

  const avatar =
    steamUser?.avatar ||
    steamUser?.avatarfull ||
    "/avatar.png"

  return (
    <div className="ko-profile">

      <div className="ko-profile-container">

        <section className="ko-profile-header">

          <div className="ko-profile-header-bg" />
          <div className="ko-profile-header-grid" />
          <div className="ko-profile-yellow-line" />

          <div className="ko-profile-avatar-area">

            <div className="ko-profile-avatar-ring">

              <img
                src={avatar}
                alt=""
                className="ko-profile-avatar"
                onError={(event) => {
                  event.currentTarget.src =
                    "/avatar.png"
                }}
              />

            </div>

            <span className="ko-profile-online" />

          </div>

          <div className="ko-profile-user">

            <div className="ko-profile-name-row">
              <h1>{username}</h1>
            </div>

          </div>

          <div className="ko-profile-top-drop">

            <span>ТОП ДРОП</span>

            {topDrop ? (
              <div className="ko-profile-top-drop-item">

                <div className="ko-profile-top-drop-image">
                  <img
                    src={
                      topDrop.image ||
                      "/avatar.png"
                    }
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src =
                        "/avatar.png"
                    }}
                  />
                </div>

                <div className="ko-profile-top-drop-info">

                  <strong>
                    {topDrop.name ||
                      "Предмет"}
                  </strong>

                  <b>
                    {formatMoney(
                      topDrop.price
                    )} ₽
                  </b>

                </div>

              </div>
            ) : (
              <div className="ko-profile-top-drop-empty">
                Пока нет выигрышей
              </div>
            )}

          </div>

          <div className="ko-profile-favorite">

            <span>ЛЮБИМЫЙ ШАНС</span>

            {favoriteMultiplier ? (
              <>
                <strong>
                  x{favoriteMultiplier.value}
                </strong>

                <small>
                  {favoriteMultiplier.count} раз ·{" "}
                  {favoritePercent}%
                </small>
              </>
            ) : (
              <>
                <strong>—</strong>
                <small>
                  Пока нет данных
                </small>
              </>
            )}

          </div>

          <div className="ko-profile-right">

            <div className="ko-profile-balance">

              <span>БАЛАНС</span>

              <strong>
                {formatMoney(balance)}
                <small>₽</small>
              </strong>

            </div>

            <button
              type="button"
              className="ko-profile-logout"
              onClick={onLogout}
            >
              Выйти
            </button>

          </div>

        </section>

        <section className="ko-profile-inventory">

          <div className="ko-profile-inventory-head">

            <div className="ko-profile-title">

              <div className="ko-profile-title-mark" />

              <h2>Инвентарь</h2>

            </div>

            <div className="ko-profile-inventory-count">
              {items.length}
            </div>

          </div>

          <div className="ko-profile-content">

            {items.length === 0 ? (
              <div className="ko-profile-empty">

                <div className="ko-profile-empty-shape">
                  <div />
                  <div />
                  <div />
                </div>

                <h3>
                  Здесь пока пусто
                </h3>

                <p>
                  Получай скины через кейсы,
                  контракты или апгрейд.
                </p>

              </div>
            ) : (
              <InventoryMarket
                balance={balance}
                setBalance={setBalance}
                inventory={items}
                setInventory={setInventory}
              />
            )}

          </div>

        </section>

      </div>

    </div>
  )
}

export default Profile