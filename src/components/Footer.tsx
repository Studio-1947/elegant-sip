export default function Footer() {
  return (
    <footer className="px-6 md:px-16 lg:px-24 py-16 border-t border-[#1b261b]/10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <span className="text-[#1b261b] text-sm font-bold uppercase tracking-tight">
            Elegant Sip
          </span>
        </div>
        <p className="text-[#4a584a]/40 text-xs font-mono tracking-wider">
          © 2024 Elegant Sip. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
