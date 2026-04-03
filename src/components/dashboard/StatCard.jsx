export default function StatCard({ title, value, isNegative }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        {title}
        <span style={{opacity: 0.5}}>ⓘ</span>
      </div>
      <div className={`stat-value ${isNegative ? 'negative' : 'positive'}`}>
        {value}
      </div>
    </div>
  )
}