import clsx from 'clsx'
import { Bell, FileText, LandPlot, LogIn, Map, Menu, Satellite, Settings, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAlerts, useServerHealth } from '../lib/queries'

const NAV: { to: string; label: string; icon: typeof Map; soon?: boolean; main?: boolean }[] = [
  { to: '/fields', label: '대시보드', icon: LandPlot, main: true },
  { to: '/', label: '관제', icon: Map },
  { to: '/alerts', label: '알림', icon: Bell },
  { to: '/mrv', label: 'MRV 보고서', icon: FileText },
  { to: '/validation', label: '위성·드론 검증', icon: Satellite, soon: true },
  { to: '/admin', label: '관리', icon: Settings },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { data: alerts } = useAlerts()
  const unresolved = alerts?.filter((a) => !a.is_resolved).length ?? 0
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, soon, main }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) => clsx(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-sprout-300 text-sprout-900'
              : main ? 'font-bold text-mustard-200 hover:bg-sprout-700' // 메인 메뉴는 노란 글자로 구분
              : 'text-sprout-200/80 hover:bg-sprout-700 hover:text-sprout-100',
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          {to === '/alerts' && unresolved > 0 && (
            <span className="rounded-full bg-clay-500 px-1.5 text-[11px] font-bold leading-5 text-white tabular-nums">{unresolved}</span>
          )}
          {soon && <span className="text-[10px] text-sprout-300/70">준비중</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function ServerStatus() {
  const { isSuccess, isError, isPending } = useServerHealth()
  const label = isPending ? '서버 확인 중' : isError ? '서버·DB 연결 안 됨' : '서버·DB 정상'
  return (
    <div className="flex items-center gap-2 text-xs text-sprout-200/70">
      <span className={clsx('size-2 rounded-full', isSuccess ? 'bg-sprout-400' : isError ? 'bg-clay-500' : 'bg-soil-400')} />
      {label}
    </div>
  )
}

// 관리자 로그인 자리. 기능은 아직 없음
function LoginButton() {
  return (
    <button
      type="button"
      disabled
      title="준비중"
      className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg border border-sprout-600 px-3 py-2 text-sm font-medium text-sprout-200/80"
    >
      <LogIn className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">관리자 로그인</span>
      <span className="text-[10px] text-sprout-300/70">준비중</span>
    </button>
  )
}

function Brand() {
  return (
    <div className="text-center">
      <p className="font-display text-3xl font-extrabold tracking-tight text-sprout-100">Nonstop</p>
      <p className="mt-1 text-xs text-sprout-300/80">논 물관리 · 탄소 MRV</p>
    </div>
  )
}

// 왼쪽 세로 메뉴 + 본문. 좁은 화면에서는 위쪽 막대 + 펼침 메뉴
export default function AppShell({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col justify-between bg-sprout-800 px-4 py-6 md:flex">
        <div className="flex flex-col gap-8">
          <Brand />
          <NavItems />
        </div>
        <div className="flex flex-col gap-4">
          <LoginButton />
          <ServerStatus />
        </div>
      </aside>

      <header className="flex items-center justify-between bg-sprout-800 px-4 py-3 md:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen(!open)} className="rounded-lg p-2 text-sprout-100 hover:bg-sprout-700" aria-label="메뉴">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open && (
        <div className="border-t border-sprout-700 bg-sprout-800 px-4 pb-4 md:hidden">
          <NavItems onNavigate={() => setOpen(false)} />
          <div className="mt-3"><LoginButton /></div>
        </div>
      )}

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children ?? <Outlet />}</main>
    </div>
  )
}
