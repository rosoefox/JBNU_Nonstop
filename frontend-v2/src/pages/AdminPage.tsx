// 관리: 논·노드 등록, 필지 경계, 기기 상태, 데이터 표준(SensorThings API) 안내
import clsx from 'clsx'
import { Copy, ExternalLink, MapPin, Pencil, RefreshCw } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { CircleMarker, useMapEvents } from 'react-leaflet'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import VworldMap from '../components/VworldMap'
import { Empty } from '../components/common'
import { Card, CardHeader, PageTitle, StatusBadge } from '../components/ui'
import { ApiError, createField, createNode, loadParcel, updateField, updateNode } from '../lib/api'
import { button, input, label } from '../lib/classes'
import { currentStatus, nodeLabel, pumpStatus, timeAgo } from '../lib/domain'
import { useFields, useLatestMap, useNodes } from '../lib/queries'
import type { Field, Node } from '../lib/types'

const REGIONS = ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군']
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : '저장하지 못했어요')

function Labeled({ text, required, children, className }: { text: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block min-w-0', className)}>
      <span className={label}>{text}{required && <span className="text-clay-500"> *</span>}</span>
      {children}
    </label>
  )
}

// 지도를 눌러 좌표 고르기
function PickPoint({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) })
  return null
}

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
      <PageTitle title="관리" subtitle="논·센서 등록, 필지 경계, 기기 상태, 데이터 표준" />
      <div className="grid gap-5 xl:grid-cols-2">
        <AddFieldCard />
        <AddNodeCard />
      </div>
      <FieldTable />
      <DeviceTable />
      <StandardsCard />
    </div>
  )
}

function AddFieldCard() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', lat: '', lng: '', area: '', region: '' })
  const [notice, setNotice] = useState('')
  const lat = Number(form.lat), lng = Number(form.lng)
  const hasPoint = form.lat !== '' && form.lng !== '' && !Number.isNaN(lat) && !Number.isNaN(lng)

  const save = useMutation({
    mutationFn: async () => {
      const area = form.area ? Number(form.area) : null
      if (!form.name.trim() || !hasPoint) throw new Error('논 이름과 위치(위도·경도)는 꼭 넣어 주세요')
      if (area !== null && !(area > 0)) throw new Error('면적은 0보다 큰 숫자로 넣어 주세요')
      const field = await createField({ field_name: form.name.trim(), latitude: lat, longitude: lng, area_ha: area, location_desc: form.region || null })
      // 필지 경계도 바로 불러옴 (실패해도 논은 등록됨)
      return loadParcel(field).then(() => true, () => false)
    },
    onSuccess: (parcel) => {
      setNotice(parcel ? '논을 추가했어요. 필지 경계도 불러왔어요.' : '논을 추가했어요. 필지 경계는 아래 표에서 다시 불러와 주세요.')
      setForm({ name: '', lat: '', lng: '', area: '', region: '' })
      queryClient.invalidateQueries({ queryKey: ['fields'] })
    },
    onError: (e) => setNotice(errorText(e)),
  })

  return (
    <Card>
      <CardHeader title="논 추가" aside={<span className="text-xs text-soil-500">지도를 눌러 위치를 고를 수 있어요</span>} />
      <form className="grid gap-4 px-4 pb-4" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
        <div className="h-56 overflow-hidden rounded-lg border border-soil-300">
          <VworldMap bounds={null}>
            <PickPoint onPick={(la, ln) => setForm((f) => ({ ...f, lat: String(la), lng: String(ln) }))} />
            {hasPoint && <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#243304', fillOpacity: 1 }} />}
          </VworldMap>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled text="논 이름" required><input id="field-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></Labeled>
          <Labeled text="지역">
            <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={input}>
              <option value="">선택</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Labeled>
          <Labeled text="위도" required><input id="field-lat" inputMode="decimal" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="35.8468" className={input} /></Labeled>
          <Labeled text="경도" required><input id="field-lng" inputMode="decimal" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="127.1294" className={input} /></Labeled>
          <Labeled text="사업 면적 (ha)"><input id="field-area" inputMode="decimal" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="0.5" className={input} /></Labeled>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={save.isPending} className={button('primary')}><MapPin className="size-4" />{save.isPending ? '추가 중...' : '논 추가'}</button>
          {notice && <p className={clsx('text-sm', save.isError ? 'text-clay-600' : 'text-forest-600')}>{notice}</p>}
        </div>
      </form>
    </Card>
  )
}

function AddNodeCard() {
  const queryClient = useQueryClient()
  const fields = useFields()
  const empty = { fieldId: '', name: '', devEui: '', lat: '', lng: '', desc: '', pump: false }
  const [form, setForm] = useState(empty)
  const [notice, setNotice] = useState('')

  const pickField = (id: string) => {
    const f = fields.data?.find((x) => x.id === Number(id))
    // 노드는 보통 논 안에 있으니 비어 있는 좌표는 논 좌표로 채움
    setForm((p) => ({ ...p, fieldId: id, lat: p.lat || (f ? String(f.latitude) : ''), lng: p.lng || (f ? String(f.longitude) : '') }))
  }

  const save = useMutation({
    mutationFn: () => {
      const devEui = form.devEui.replace(/[\s:-]/g, '').toUpperCase()
      if (!form.fieldId || !form.name.trim() || !form.lat || !form.lng) throw new Error('논, 센서 이름, 위도, 경도는 꼭 넣어 주세요')
      if (!/^[0-9A-F]{16}$/.test(devEui)) throw new Error('DevEUI는 16자리 영문(A~F)·숫자예요')
      return createNode({
        field_id: Number(form.fieldId), node_name: form.name.trim(), dev_eui: devEui,
        latitude: Number(form.lat), longitude: Number(form.lng), location_desc: form.desc || null, has_pump: form.pump,
      })
    },
    onSuccess: () => {
      setNotice('센서를 추가했어요.')
      setForm(empty)
      queryClient.invalidateQueries({ queryKey: ['nodes'] })
    },
    onError: (e) => setNotice(errorText(e)),
  })

  return (
    <Card>
      <CardHeader title="센서 추가" aside={<span className="text-xs text-soil-500">DevEUI는 TTN 콘솔에서 확인</span>} />
      <form className="grid gap-3 px-4 pb-4 sm:grid-cols-2" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
        <Labeled text="논" required>
          <select value={form.fieldId} onChange={(e) => pickField(e.target.value)} className={input}>
            <option value="">선택</option>
            {(fields.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.field_name}</option>)}
          </select>
        </Labeled>
        <Labeled text="센서 이름" required><input id="node-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="센서 2번" className={input} /></Labeled>
        <Labeled text="DevEUI (16자리)" required className="sm:col-span-2">
          <input id="node-deveui" value={form.devEui} onChange={(e) => setForm({ ...form, devEui: e.target.value })} placeholder="70B3D57ED0012345" className={clsx(input, 'font-mono')} />
        </Labeled>
        <Labeled text="위도" required><input id="node-lat" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className={input} /></Labeled>
        <Labeled text="경도" required><input id="node-lng" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className={input} /></Labeled>
        <Labeled text="설명" className="sm:col-span-2"><input id="node-desc" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="예: 논 북쪽 물꼬 옆" className={input} /></Labeled>
        <label className="flex items-center gap-2 text-sm text-soil-700 sm:col-span-2">
          <input type="checkbox" checked={form.pump} onChange={(e) => setForm({ ...form, pump: e.target.checked })} className="size-4 accent-sprout-700" />
          펌프 연결됨 (자동 재관개 사용)
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={save.isPending} className={button('primary')}>{save.isPending ? '추가 중...' : '센서 추가'}</button>
          {notice && <p className={clsx('text-sm', save.isError ? 'text-clay-600' : 'text-forest-600')}>{notice}</p>}
        </div>
      </form>
    </Card>
  )
}

function FieldTable() {
  const fields = useFields()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [error, setError] = useState('')
  const reload = async (id: number) => {
    const f = fields.data?.find((x) => x.id === id)
    if (!f) return
    setBusy(id)
    setError('')
    try {
      await loadParcel(f)
      await queryClient.invalidateQueries({ queryKey: ['fields'] })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card>
      <CardHeader title="필지" aside={<span className="text-xs text-soil-500">경계는 V-WORLD 연속지적도</span>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-soil-100 text-left text-xs text-soil-600">
            <tr>{['논', '지번 주소', 'PNU', '사업 면적', '필지 면적', ''].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-soil-200">
            {(fields.data ?? []).map((f) => editing === f.id ? (
              <FieldEditRow key={f.id} field={f} onDone={() => setEditing(null)} />
            ) : (
              <tr key={f.id}>
                <td className="px-4 py-3 font-semibold">{f.field_name}<p className="text-xs font-normal text-soil-500">{f.location_desc}</p></td>
                <td className="px-4 py-3 text-soil-700">{f.jibun_addr ?? <span className="text-soil-400">미등록</span>}</td>
                <td className="px-4 py-3 font-mono text-xs">{f.pnu ?? '-'}</td>
                <td className="px-4 py-3 tabular-nums">{f.area_ha !== null ? `${f.area_ha} ha` : '-'}</td>
                <td className="px-4 py-3 tabular-nums">{f.parcel_area_ha !== null ? `${f.parcel_area_ha.toLocaleString('ko-KR')} ha` : '-'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setEditing(f.id)} className={button('ghost', 'px-2 py-1 text-xs')}>
                    <Pencil className="size-3.5" /> 변경
                  </button>
                  <button type="button" onClick={() => reload(f.id)} disabled={busy === f.id} className={button('ghost', 'px-2 py-1 text-xs')}>
                    <RefreshCw className={clsx('size-3.5', busy === f.id && 'animate-spin')} /> 경계 {f.pnu ? '다시 ' : ''}불러오기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {fields.data?.length === 0 && <Empty>등록된 논이 없어요.</Empty>}
      </div>
      {error && <p className="px-4 pb-3 text-xs text-clay-600">{error}</p>}
    </Card>
  )
}

// 필지 표의 한 줄을 입력칸으로 바꿔서 논 이름·지역·사업 면적 수정
function FieldEditRow({ field, onDone }: { field: Field; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: field.field_name,
    region: field.location_desc ?? '',
    area: field.area_ha !== null ? String(field.area_ha) : '',
  })
  const save = useMutation({
    mutationFn: () => {
      const area = form.area.trim() ? Number(form.area) : null
      if (!form.name.trim()) throw new Error('논 이름을 입력해 주세요')
      if (area !== null && !(area > 0)) throw new Error('사업 면적은 0보다 커야 해요')
      return updateField(field.id, { field_name: form.name.trim(), location_desc: form.region || null, area_ha: area })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fields'] })
      onDone()
    },
  })
  const cell = 'px-4 py-2 align-top'
  return (
    <tr className="bg-sprout-100/60">
      <td className={cell}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={clsx(input, 'py-1.5')} aria-label="논 이름" />
        <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={clsx(input, 'mt-1.5 py-1.5')} aria-label="지역">
          <option value="">지역 없음</option>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
          {form.region && !REGIONS.includes(form.region) && <option>{form.region}</option>}
        </select>
      </td>
      <td className={clsx(cell, 'pt-4 text-soil-500')}>{field.jibun_addr ?? '미등록'}</td>
      <td className={clsx(cell, 'pt-4 font-mono text-xs text-soil-500')}>{field.pnu ?? '-'}</td>
      <td className={cell}>
        <div className="flex items-center gap-1.5">
          <input type="number" step="0.01" min="0" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={clsx(input, 'w-24 py-1.5')} aria-label="사업 면적" />
          <span className="text-soil-500">ha</span>
        </div>
      </td>
      <td className={clsx(cell, 'pt-4 whitespace-nowrap text-soil-500')}>{field.parcel_area_ha !== null ? `${field.parcel_area_ha.toLocaleString('ko-KR')} ha` : '-'}</td>
      <td className={clsx(cell, 'text-right whitespace-nowrap')}>
        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={onDone} className={button('secondary', 'px-3 py-1.5 text-xs')}>취소</button>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className={button('primary', 'px-3 py-1.5 text-xs')}>
            {save.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
        {save.isError && <p className="mt-1.5 text-xs text-clay-600">{errorText(save.error)}</p>}
      </td>
    </tr>
  )
}

function DeviceTable() {
  const nodes = useNodes()
  const fields = useFields()
  const latest = useLatestMap()
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: (n: Node) => updateNode(n.id, { has_pump: !n.has_pump }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nodes'] }),
  })
  const fieldName = (id: number) => fields.data?.find((f) => f.id === id)?.field_name ?? '-'
  return (
    <Card>
      <CardHeader title="기기 상태" aside={<span className="text-xs text-soil-500">배터리·마지막 수신·펌프 연결</span>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-soil-100 text-left text-xs text-soil-600">
            <tr>{['센서', '논', 'DevEUI', '상태', '배터리', '마지막 수신', '펌프 연결'].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-soil-200">
            {(nodes.data ?? []).map((n) => {
              const log = latest.map[n.id]
              const st = currentStatus(log?.inner_water_level, log?.measured_at)
              return (
                <tr key={n.id}>
                  <td className="px-4 py-3 font-semibold">{nodeLabel(n)}<p className="text-xs font-normal text-soil-500">{n.location_desc}</p></td>
                  <td className="px-4 py-3">{fieldName(n.field_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{n.dev_eui}</td>
                  <td className="px-4 py-3"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                  <td className="px-4 py-3 tabular-nums">{log?.battery_voltage != null ? `${log.battery_voltage} V` : '-'}</td>
                  <td className="px-4 py-3 text-soil-600">{log ? `${timeAgo(log.measured_at)} · ${new Date(log.measured_at).toLocaleString('ko-KR')}` : '-'}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 text-xs text-soil-600">
                      <input type="checkbox" checked={n.has_pump} onChange={() => toggle.mutate(n)} disabled={toggle.isPending} className="size-4 accent-rain-600" />
                      {pumpStatus(n.has_pump, log?.pump_on).label}
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {nodes.data?.length === 0 && <Empty>등록된 센서가 없어요.</Empty>}
      </div>
    </Card>
  )
}

function StandardsCard() {
  const [copied, setCopied] = useState('')
  const endpoints = [
    { path: '/v1.1', desc: '서비스 루트 (엔티티 목록)' },
    { path: '/v1.1/Things', desc: '센서' },
    { path: '/v1.1/Datastreams', desc: '센서별 수위(cm)·배터리(V) 측정 흐름' },
    { path: '/v1.1/Observations?$top=10&$orderby=phenomenonTime desc', desc: '최근 관측값 10건' },
    { path: '/v1.1/FeaturesOfInterest', desc: '논 (V-WORLD 필지 경계)' },
  ]
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
    } catch {
      setCopied('')
    }
  }
  return (
    <Card>
      <CardHeader
        title="데이터 표준 · OGC SensorThings API v1.1"
        aside={<a href={`${API_URL}/docs`} target="_blank" rel="noreferrer" className={button('ghost', 'px-2 py-1 text-xs')}>API 문서 <ExternalLink className="size-3.5" /></a>}
      />
      <p className="px-4 text-sm text-soil-600">
        센서 관측 데이터를 OGC 국제 표준 형식으로 제공해요. 위치·필지는 OGC Simple Features(WGS84) 형식으로 저장해요.
      </p>
      <ul className="m-4 divide-y divide-soil-200 rounded-lg border border-soil-200">
        {endpoints.map((e) => {
          const url = `${API_URL}${e.path}`
          return (
            <li key={e.path} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-forest-800">{e.path}</code>
              <span className="text-xs text-soil-500">{e.desc}</span>
              <button type="button" onClick={() => copy(url)} className={button('ghost', 'px-2 py-1 text-xs')} aria-label="주소 복사">
                <Copy className="size-3.5" />{copied === url ? '복사됨' : '복사'}
              </button>
              <a href={url} target="_blank" rel="noreferrer" className={button('ghost', 'px-2 py-1 text-xs')}>열기</a>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
