import { useEffect, useRef, useState } from "react"
import skins from "../data/skins"
import "./Event.css"

const getSkin = (name) => {
  return skins.find((skin) => skin.name === name)
}

const rewards = [
  {
    level: 1,
    free: {
      type: "balance",
      value: "10₽"
    },
    premium: {
      type: "skin",
      value: "Glock-18 | Winterized"
    }
  },
  {
    level: 2,
    free: {
      type: "promo",
      value: "+5% к пополнению"
    },
    premium: {
      type: "promo",
      value: "+10% к пополнению"
    }
  },
  {
    level: 3,
    free: {
      type: "skin",
      value: "P250 | Sand Dune",
      rewardType: "КОНТРАКТ"
    },
    premium: {
      type: "skin",
      value: "MP9 | Dark Age",
      rewardType: "АПГРЕЙД"
    }
  },
  {
    level: 4,
    free: {
      type: "balance",
      value: "15₽"
    },
    premium: {
      type: "balance",
      value: "50₽"
    }
  },
  {
    level: 5,
    free: {
      type: "promo",
      value: "+7% к пополнению"
    },
    premium: {
      type: "promo",
      value: "+15% к пополнению"
    },
    big: true
  },
  {
    level: 6,
    free: {
      type: "skin",
      value: "Tec-9 | Ice Cap",
      rewardType: "КОНТРАКТ"
    },
    premium: {
      type: "skin",
      value: "MAC-10 | Silver"
    }
  },
  {
    level: 7,
    free: {
      type: "balance",
      value: "25₽"
    },
    premium: {
      type: "skin",
      value: "FAMAS | Cyanospatter",
      rewardType: "АПГРЕЙД"
    }
  },
  {
    level: 8,
    free: {
      type: "promo",
      value: "+10% к пополнению"
    },
    premium: {
      type: "promo",
      value: "+20% к пополнению"
    }
  },
  {
    level: 9,
    free: {
      type: "skin",
      value: "P2000 | Ivory",
      rewardType: "АПГРЕЙД"
    },
    premium: {
      type: "skin",
      value: "P250 | Nevermore",
      rewardType: "КОНТРАКТ"
    }
  },
  {
    level: 10,
    free: {
      type: "balance",
      value: "40₽"
    },
    premium: {
      type: "skin",
      value: "USP-S | Cortex",
      rewardType: "АПГРЕЙД"
    },
    big: true
  },
  {
    level: 11,
    free: {
      type: "promo",
      value: "+5% к пополнению"
    },
    premium: {
      type: "balance",
      value: "100₽"
    }
  },
  {
    level: 12,
    free: {
      type: "skin",
      value: "MAG-7 | Heat",
      rewardType: "КОНТРАКТ"
    },
    premium: {
      type: "skin",
      value: "MP9 | Food Chain"
    }
  },
  {
    level: 13,
    free: {
      type: "balance",
      value: "50₽"
    },
    premium: {
      type: "promo",
      value: "+15% к пополнению"
    }
  },
  {
    level: 14,
    free: {
      type: "promo",
      value: "+7% к пополнению"
    },
    premium: {
      type: "skin",
      value: "Glock-18 | Vogue",
      rewardType: "АПГРЕЙД"
    }
  },
  {
    level: 15,
    free: {
      type: "skin",
      value: "CZ75-Auto | Polymer",
      rewardType: "КОНТРАКТ"
    },
    premium: {
      type: "skin",
      value: "AK-47 | Slate",
      rewardType: "АПГРЕЙД"
    },
    big: true
  },
  {
    level: 16,
    free: {
      type: "balance",
      value: "75₽"
    },
    premium: {
      type: "promo",
      value: "+20% к пополнению"
    }
  },
  {
    level: 17,
    free: {
      type: "skin",
      value: "MP5-SD | Condition Zero",
      rewardType: "АПГРЕЙД"
    },
    premium: {
      type: "skin",
      value: "AWP | Worm God",
      rewardType: "КОНТРАКТ"
    }
  },
  {
    level: 18,
    free: {
      type: "promo",
      value: "+10% к пополнению"
    },
    premium: {
      type: "skin",
      value: "AK-47 | Crane Flight",
      rewardType: "АПГРЕЙД"
    }
  },
  {
    level: 19,
    free: {
      type: "balance",
      value: "100₽"
    },
    premium: {
      type: "skin",
      value: "M4A4 | Evil Daimyo",
      rewardType: "КОНТРАКТ"
    }
  },
  {
    level: 20,
    free: {
      type: "skin",
      value: "PP-Bizon | Antique",
      rewardType: "КОНТРАКТ"
    },
    premium: {
      type: "skin",
      value: "M4A1-S | Flashback",
      rewardType: "АПГРЕЙД"
    },
    big: true
  },
  {
    level: 21,
    free: {
      type: "promo",
      value: "+7% к пополнению"
    },
    premium: {
      type: "promo",
      value: "+20% к пополнению"
    }
  },
  {
    level: 22,
    free: {
      type: "balance",
      value: "150₽"
    },
    premium: {
      type: "skin",
      value: "AWP | Atheris",
      rewardType: "КОНТРАКТ"
    }
  },
  {
    level: 23,
    free: {
      type: "skin",
      value: "AK-47 | Steel Delta",
      rewardType: "АПГРЕЙД"
    },
    premium: {
      type: "skin",
      value: "M4A4 | Spider Lily",
      rewardType: "АПГРЕЙД"
    }
  },
  {
    level: 24,
    free: {
      type: "promo",
      value: "+10% к пополнению"
    },
    premium: {
      type: "balance",
      value: "250₽"
    }
  },
  {
    level: 25,
    free: {
      type: "skin",
      value: "PP-Bizon | Antique",
      rewardType: "КОНТРАКТ"
    },
    premium: {
      type: "skin",
      value: "AWP | Fever Dream",
      rewardType: "АПГРЕЙД"
    },
    big: true
  }
]

function Event({
  inventory,
  setInventory,
  balance,
  setBalance
}) {
  const [xp, setXp] = useState(
    Number(localStorage.getItem("eventXP") || 0)
  )

  const [claimed, setClaimed] = useState(
    JSON.parse(
      localStorage.getItem("eventClaimed") || "[]"
    )
  )

  const trackRef = useRef(null)

  useEffect(() => {
    const updateXP = () => {
      setXp(
        Number(
          localStorage.getItem("eventXP") || 0
        )
      )
    }

    window.addEventListener(
      "contracter-xp",
      updateXP
    )

    return () => {
      window.removeEventListener(
        "contracter-xp",
        updateXP
      )
    }
  }, [])

  const currentLevel = Math.min(
    Math.floor(xp / 100) + 1,
    25
  )

  const currentLevelXP =
    xp >= 2500 ? 100 : xp % 100

  const scrollPass = (direction) => {
    if (!trackRef.current) return

    trackRef.current.scrollBy({
      left: direction * 500,
      behavior: "smooth"
    })
  }

  const claimReward = (reward, level, type) => {
    const requiredXP = level * 100

    if (xp < requiredXP) {
      return
    }

    const rewardId = `${type}-${level}`

    if (claimed.includes(rewardId)) {
      return
    }

    if (reward.type === "skin") {
      const skin = getSkin(reward.value)

      if (skin && setInventory) {
        setInventory((prev) => [
          ...prev,
          {
            ...skin,
            id: `${skin.name}-${Date.now()}-${Math.random()}`
          }
        ])
      }
    }

    if (reward.type === "balance") {
      const value = parseInt(
        reward.value.replace(/\D/g, ""),
        10
      )

      if (!isNaN(value) && setBalance) {
        setBalance((prev) => prev + value)
      }
    }

    if (reward.type === "promo") {
      const percent = parseInt(
        reward.value.replace(/\D/g, ""),
        10
      )

      const currentBonus = Number(
        localStorage.getItem(
          "depositBonusPercent"
        ) || 0
      )

      localStorage.setItem(
        "depositBonusPercent",
        currentBonus + percent
      )

      window.dispatchEvent(
        new Event("deposit-bonus-update")
      )
    }

    const newClaimed = [
      ...claimed,
      rewardId
    ]

    setClaimed(newClaimed)

    localStorage.setItem(
      "eventClaimed",
      JSON.stringify(newClaimed)
    )
  }

  const renderReward = (
    reward,
    type,
    level,
    big
  ) => {
    const requiredXP = level * 100
    const unlocked = xp >= requiredXP

    const rewardId = `${type}-${level}`

    const isClaimed =
      claimed.includes(rewardId)

    const skin =
      reward.type === "skin"
        ? getSkin(reward.value)
        : null

    let icon = "★"

    if (reward.type === "balance") {
      icon = "₽"
    }

    if (reward.type === "promo") {
      icon = "%"
    }

    const rewardLabel =
      reward.rewardType ||
      (
        reward.type === "balance"
          ? "БАЛАНС"
          : reward.type === "promo"
            ? "ПОПОЛНЕНИЕ"
            : "СКИН"
      )

    return (
      <div
        className={`pass-reward ${
          big
            ? "pass-reward-big"
            : ""
        } ${
          unlocked
            ? "pass-unlocked"
            : ""
        } ${
          isClaimed
            ? "pass-claimed"
            : ""
        }`}
        key={`${type}-${level}`}
      >

        <div className="reward-level">
          {level}
        </div>

        <div className="reward-icon">

          {skin ? (
            <img
              src={skin.image}
              alt={skin.name}
            />
          ) : (
            icon
          )}

        </div>

        <div className="reward-type">
          {rewardLabel}
        </div>

        <div className="reward-name">
          {skin
            ? skin.name
            : reward.value}
        </div>

        {isClaimed ? (
          <div className="reward-status claimed-status">
            ✓
          </div>
        ) : unlocked ? (
          <button
            type="button"
            className="reward-claim"
            onClick={() =>
              claimReward(
                reward,
                level,
                type
              )
            }
          >
            Забрать
          </button>
        ) : (
          <div className="reward-lock">
            🔒
          </div>
        )}

      </div>
    )
  }

  return (
    <div className="event-page">

      <div className="event-bg">
        <div className="event-glow event-glow-1" />
        <div className="event-glow event-glow-2" />
      </div>

      <div className="event-content">

        <div className="pass-header">

          <div className="pass-header-left">

            <div className="pass-label">
              CONTRACTER
            </div>

            <h1>
              CONTRACTER PASS
            </h1>

            <span>
              СЕЗОН 1
            </span>

          </div>

          <div className="pass-level-info">

            <div className="pass-level">
              УРОВЕНЬ

              <strong>
                {currentLevel}
              </strong>
            </div>

            <div className="pass-xp">
              {xp} XP
            </div>

          </div>

        </div>

        <div className="pass-progress">

          <div className="pass-progress-text">

            <span>
              ПРОГРЕСС
            </span>

            <strong>
              {currentLevelXP} / 100 XP
            </strong>

          </div>

          <div className="pass-progress-bar">

            <div
              className="pass-progress-fill"
              style={{
                width: `${currentLevelXP}%`
              }}
            />

          </div>

          <div className="pass-progress-levels">

            <span>
              Уровень {currentLevel}
            </span>

            <span>
              {currentLevel >= 25
                ? "Максимальный уровень"
                : `До уровня ${
                    currentLevel + 1
                  }: ${
                    (currentLevel + 1) * 100
                  } XP`}
            </span>

          </div>

        </div>

        <div className="pass-container">

          <button
            type="button"
            className="pass-arrow pass-arrow-left"
            onClick={() =>
              scrollPass(-1)
            }
          >
            ‹
          </button>

          <div
            className="pass-track"
            ref={trackRef}
          >

            <div className="pass-row">

              <div className="pass-row-title free-title">
                FREE
              </div>

              <div className="pass-rewards">

                {rewards.map((item) =>
                  renderReward(
                    item.free,
                    "free",
                    item.level,
                    item.big
                  )
                )}

              </div>

            </div>

            <div className="pass-row premium-row">

              <div className="pass-row-title premium-title">
                PREMIUM
              </div>

              <div className="pass-rewards">

                {rewards.map((item) =>
                  renderReward(
                    item.premium,
                    "premium",
                    item.level,
                    item.big
                  )
                )}

              </div>

            </div>

          </div>

          <button
            type="button"
            className="pass-arrow pass-arrow-right"
            onClick={() =>
              scrollPass(1)
            }
          >
            ›
          </button>

        </div>

        <div className="pass-info">

          <div className="pass-info-item">
            <strong>
              +10 XP
            </strong>

            <span>
              за каждые 100₽ в контракте
            </span>
          </div>

          <div className="pass-info-item">
            <strong>
              25 УРОВНЕЙ
            </strong>

            <span>
              100 XP для каждого нового уровня
            </span>
          </div>

          <div className="pass-info-item">
            <strong>
              PREMIUM
            </strong>

            <span>
              Дополнительная линия наград
            </span>
          </div>

        </div>

      </div>

    </div>
  )
}

export default Event