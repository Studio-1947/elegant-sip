const getLoadingMessage = (percent: number) => {
  if (percent < 20) return "Gathering the harvest..."
  if (percent < 40) return "Selecting the finest leaves..."
  if (percent < 65) return "Preparing the sensory flight..."
  if (percent < 85) return "Refining the steeping temperature..."
  return "Enjoying the first sip..."
}

/** Full-screen branded loading overlay. Percentage reflects real video buffering. */
export default function LoadingOverlay({ percentage, fading }: { percentage: number; fading: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060b08] transition-opacity duration-1000 ease-in-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="text-center space-y-6">
        <p className="text-white text-5xl md:text-6xl font-extrabold tracking-tight uppercase font-sans animate-pulse">
          Elegant Sip
        </p>
        <p className="text-[#8bb56e] text-sm font-mono tracking-widest uppercase">
          The Journey of Tea
        </p>
        <div className="w-64 h-[1px] bg-white/10 mx-auto relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-[#8bb56e] transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="space-y-1">
          <p className="text-white/60 text-xs font-light italic">
            {getLoadingMessage(percentage)}
          </p>
          <p className="text-white/30 text-[11px] font-mono tracking-wider">
            Loading Experience... {percentage}%
          </p>
        </div>
      </div>
    </div>
  )
}
