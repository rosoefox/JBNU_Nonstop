import clsx from 'clsx'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, FileText, FlaskConical, LandPlot, LogIn, Map, Menu, Satellite, Settings, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { setExperimentMode } from '../lib/api'
import { DATA_SCOPE_LABEL, setDataScope, useDataScope, type DataScope } from '../lib/dataScope'
import { useAlerts, useExperimentMode, useServerHealth } from '../lib/queries'

const NAV: { to: string; label: string; icon: typeof Map; soon?: boolean; main?: boolean }[] = [
  { to: '/fields', label: '대시보드', icon: LandPlot, main: true },
  { to: '/', label: '관제', icon: Map },
  { to: '/alerts', label: '알림', icon: Bell },
  { to: '/mrv', label: 'MRV 보고서', icon: FileText },
  { to: '/validation', label: '위성·드론 검증', icon: Satellite },
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

// 실험 모드 전환: 켜면 서버가 알림을 10분 기준으로 판정 (평소 6시간·통신 끊김 30분)
function ExperimentToggle() {
  const queryClient = useQueryClient()
  const { data, isError } = useExperimentMode()
  const on = data?.experiment_mode ?? false
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setExperimentMode(enabled),
    onSuccess: (rules) => {
      queryClient.setQueryData(['experiment-mode'], rules)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: (err) => window.alert(err instanceof Error ? err.message : '모드를 바꾸지 못했어요'),
  })

  function onClick() {
    const next = !on
    const message = next
      ? '실험 모드를 켤까요?\n수위 알림을 10분, 통신 끊김을 10분 기준으로 판정해요.'
      : '평소 모드로 돌릴까요?\n수위 알림 6시간, 통신 끊김 30분 기준으로 돌아가요.'
    if (window.confirm(message)) toggle.mutate(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={!data || toggle.isPending}
      title={isError ? '서버에서 모드를 확인하지 못했어요' : undefined}
      className={clsx(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
        on ? 'border-mustard-500 bg-mustard-500/15 text-mustard-200 hover:bg-mustard-500/25'
          : 'border-sprout-600 text-sprout-200/80 hover:bg-sprout-700',
      )}
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block">{on ? '실험 모드' : '평소 모드'}</span>
        <span className={clsx('mt-0.5 block truncate whitespace-nowrap text-[11px]', on ? 'text-mustard-200/80' : 'text-sprout-300/70')}>
          {data ? `알림 ${data.sustained_label} · 끊김 ${data.comm_lost_minutes}분` : '확인 중'}
        </span>
      </span>
      <span className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-mustard-500' : 'bg-sprout-700')}>
        <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', on ? 'left-4.5' : 'left-0.5')} />
      </span>
    </button>
  )
}

// 화면에 보여줄 데이터: 전체 / 실제만 / 실험만 (실험 모드에서 들어온 데이터 구분)
function DataScopeSwitch() {
  const scope = useDataScope()
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 pl-1 text-[11px] text-sprout-300/70">데이터</span>
      <div className="grid flex-1 grid-cols-3 gap-0.5 rounded-lg bg-sprout-900/40 p-0.5" role="radiogroup" aria-label="보여줄 데이터">
        {(['all', 'real', 'experiment'] as DataScope[]).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setDataScope(s)}
            className={clsx('rounded-md py-1 text-xs font-semibold transition-colors',
              scope === s ? (s === 'experiment' ? 'bg-mustard-500 text-sprout-900' : 'bg-sprout-300 text-sprout-900') : 'text-sprout-200/70 hover:bg-sprout-700')}>
            {DATA_SCOPE_LABEL[s]}
          </button>
        ))}
      </div>
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

// 좁은 화면 위쪽 막대: 로고 오른쪽에 설명
function BrandInline() {
  return (
    <div className="flex items-baseline gap-2.5">
      <p className="font-display text-2xl font-extrabold tracking-tight text-sprout-100">Nonstop</p>
      <p className="text-xs text-sprout-300/80">논 물관리 · 탄소 MRV</p>
    </div>
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
          <div className="flex flex-col gap-2">
            <ExperimentToggle />
            <DataScopeSwitch />
            <LoginButton />
          </div>
          <ServerStatus />
        </div>
      </aside>

      <header className="flex items-center justify-between bg-sprout-800 px-4 py-3 md:hidden">
        <BrandInline />
        <button type="button" onClick={() => setOpen(!open)} className="rounded-lg p-2 text-sprout-100 hover:bg-sprout-700" aria-label="메뉴">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open && (
        <div className="border-t border-sprout-700 bg-sprout-800 px-4 pt-3 pb-4 md:hidden">
          <NavItems onNavigate={() => setOpen(false)} />
          <div className="mt-3 flex flex-col gap-2"><ExperimentToggle /><DataScopeSwitch /><LoginButton /></div>
        </div>
      )}

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children ?? <Outlet />}</main>
    </div>
  )
}
