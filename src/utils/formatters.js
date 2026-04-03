export const formatCurrency = (value) => {
  if (value === null || value === undefined) return '$0.00'
  
  const num = Number(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(Math.abs(num))

  return num < 0 ? `-${formatted}` : formatted
}

export const formatPercent = (value) => {
  if (value === null || value === undefined) return '0.00%'
  return `${Number(value).toFixed(2)}%`
}