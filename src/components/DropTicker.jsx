import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import "./DropTicker.css"

function DropTicker() {
  const [drops, setDrops] = useState([])

  useEffect(() => {
    loadDrops()

    const channel = supabase
      .channel("drops-feed-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "drops"
        },
        (payload) => {
          const newDrop = payload.new

          if (!newDrop) {
            return
          }

          setDrops((current) => {
            const exists = current.some(
              (drop) =>
                drop.id === newDrop.id
            )

            if (exists) {
              return current
            }

            return [
              newDrop,
              ...current
            ].slice(0, 30)
          })
        }
      )
      .subscribe((status) => {
        console.log(
          "Drops realtime:",
          status
        )
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadDrops() {
    const {
      data,
      error
    } = await supabase
      .from("drops")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(30)

    if (error) {
      console.error(
        "Ошибка загрузки дропов:",
        error
      )
      return
    }

    setDrops(data || [])
  }

  return (
    <div className="drop-ticker">

      <div className="drop-online">

        <span className="drop-online-dot" />

        <strong>
          30
        </strong>

        <span>
          ОНЛАЙН
        </span>

      </div>

      <div className="drop-list">

        {drops.map((drop) => (
          <div
            className="drop-card"
            key={drop.id}
          >

            <div className="drop-image-wrap">

              {drop.item_image ? (
                <img
                  className="drop-image"
                  src={drop.item_image}
                  alt={drop.item_name}
                />
              ) : (
                <div className="drop-no-image">
                  ?
                </div>
              )}

            </div>

            <div className="drop-info">

              <span className="drop-user">
                {drop.username ||
                  "Гость"}
              </span>

              <strong>
                {drop.item_name ||
                  "Предмет"}
              </strong>

            </div>

            <span className="drop-price">
              {Number(
                drop.item_price || 0
              ).toLocaleString(
                "ru-RU"
              )} ₽
            </span>

          </div>
        ))}

        {drops.length === 0 && (
          <span className="drop-empty">
            Ожидание новых дропов...
          </span>
        )}

      </div>

    </div>
  )
}

export default DropTicker