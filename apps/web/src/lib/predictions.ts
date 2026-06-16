export type Product = {
  id: string
  name: string
  sku: string
  category: string
  quantity: number
  cost_price: number
  reorder_threshold: number
  expiry_date?: string | null
}

export type SaleItem = {
  product_id: string
  product_name: string
  quantity: number
  created_at: string
}

export type DemandPrediction = {
  product: Product
  avgDailyRate: number
  daysUntilStockout: number
  stockoutDate: Date
  reorderQty: number
  urgency: 'high' | 'medium'
}

export type DeadStockItem = {
  product: Product
  lastSaleDate: string | null
  daysWithoutSales: number
  valueAtCost: number
  recommendation: string
}

export type SeasonalForecast = {
  season: string
  category: string
  multiplier: number
  recommendation: string
}

const SEASONS: Array<{ name: string; months: number[]; categories: string[] }> = [
  { name: 'Summer', months: [3, 4, 5], categories: ['Beverages', 'Personal Care'] },
  { name: 'Monsoon', months: [6, 7, 8], categories: ['Snacks', 'Beverages'] },
  { name: 'Winter', months: [9, 10], categories: ['Dairy', 'Grains & Pulses'] },
  { name: 'Diwali', months: [9, 10], categories: ['Snacks', 'Dairy'] },
  { name: 'Holi', months: [2], categories: ['Beverages', 'Snacks'] },
  { name: 'Christmas & New Year', months: [11, 0], categories: ['Beverages', 'Snacks', 'Dairy'] },
]

export function computeDemandPredictions(
  products: Product[],
  saleItems: SaleItem[],
): DemandPrediction[] {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const results: DemandPrediction[] = []

  for (const product of products) {
    if (product.quantity === 0) continue

    const recentSales = saleItems.filter(
      (s) => s.product_id === product.id && new Date(s.created_at) >= thirtyDaysAgo,
    )
    const totalSold = recentSales.reduce((s, i) => s + i.quantity, 0)
    if (totalSold === 0) continue // flagged for dead stock instead

    const avgDailyRate = totalSold / 30
    const daysUntilStockout = Math.floor(product.quantity / avgDailyRate)
    if (daysUntilStockout > 14) continue

    const stockoutDate = new Date(now.getTime() + daysUntilStockout * 24 * 60 * 60 * 1000)
    const reorderQty = Math.ceil(avgDailyRate * 30)
    const urgency = daysUntilStockout <= 7 ? 'high' : 'medium'

    results.push({ product, avgDailyRate, daysUntilStockout, stockoutDate, reorderQty, urgency })
  }

  return results.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)
}

export function computeDeadStock(products: Product[], saleItems: SaleItem[]): DeadStockItem[] {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const results: DeadStockItem[] = []

  for (const product of products) {
    if (product.quantity === 0) continue

    const recentSales = saleItems.filter(
      (s) => s.product_id === product.id && new Date(s.created_at) >= thirtyDaysAgo,
    )
    if (recentSales.length > 0) continue

    const allSales = saleItems
      .filter((s) => s.product_id === product.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const lastSaleDate = allSales[0]?.created_at ?? null
    const daysWithoutSales = lastSaleDate
      ? Math.floor((now.getTime() - new Date(lastSaleDate).getTime()) / (24 * 60 * 60 * 1000))
      : 999
    const valueAtCost = product.quantity * product.cost_price

    let recommendation: string
    if (product.quantity > 100) recommendation = 'Reduce purchase quantity'
    else if (product.quantity >= 20) recommendation = 'Consider discount promotion'
    else recommendation = 'Review product listing'

    results.push({ product, lastSaleDate, daysWithoutSales, valueAtCost, recommendation })
  }

  return results.sort((a, b) => b.daysWithoutSales - a.daysWithoutSales)
}

export function computeSeasonalForecasts(): SeasonalForecast[] {
  const now = new Date()
  const currentMonth = now.getMonth()
  const results: SeasonalForecast[] = []

  // Check if any season is within 21 days (roughly within current or next month)
  const nextMonthDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
  const nextMonth = nextMonthDate.getMonth()

  for (const season of SEASONS) {
    if (season.months.includes(currentMonth) || season.months.includes(nextMonth)) {
      for (const category of season.categories) {
        results.push({
          season: season.name,
          category,
          multiplier: 1.3,
          recommendation: `Stock up on ${category} for ${season.name} season`,
        })
      }
    }
  }

  return results
}

export function computeExpiringProducts(
  products: Product[],
  daysAhead = 7,
): Product[] {
  const now = new Date()
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
  return products.filter((p) => {
    if (!p.expiry_date) return false
    const exp = new Date(p.expiry_date)
    return exp <= cutoff && exp >= now
  })
}
