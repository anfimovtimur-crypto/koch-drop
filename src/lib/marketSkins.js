const API =
  "https://rmkszfhwqxomrcowesiu.supabase.co/functions/v1/market-skins"

export async function getMarketSkins({
  start = 0,
  count = 10000
} = {}) {
  const response = await fetch(
    `${API}?start=${start}&count=${count}`,
    {
      cache: "no-store"
    }
  )

  const data = await response.json()

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error ||
      "Ошибка загрузки скинов"
    )
  }

  return {
    items: Array.isArray(data.items)
      ? data.items
      : [],

    total: Number(data.total || 0),

    start: Number(data.start || 0),

    count: Number(data.count || 0),

    returned: Number(
      data.returned || 0
    )
  }
}