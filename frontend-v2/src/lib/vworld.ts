// V-WORLD 연속지적도(LP_PA_CBND_BUBUN)에서 좌표가 속한 필지를 가져옴.
// V-WORLD는 해외 서버(Render, 싱가포르) 접속을 막고 CORS도 허용하지 않아서,
// 지도 타일처럼 사용자 브라우저가 JSONP로 직접 받아 온 뒤 백엔드에 저장함.

const VWORLD_KEY = import.meta.env.VITE_VWORLD_KEY
// 인증키에 등록한 서비스 도메인 (로컬 개발 중에도 등록된 배포 도메인 값을 씀)
const VWORLD_DOMAIN = import.meta.env.VITE_VWORLD_DOMAIN || 'jbnu-nonstop.vercel.app'
const TIMEOUT_MS = 15000

export interface Parcel {
  pnu: string
  jibun_addr: string | null
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

interface VworldResponse {
  response: {
    status: 'OK' | 'NOT_FOUND' | 'ERROR'
    error?: { text?: string }
    result?: {
      featureCollection: {
        features: { geometry: Parcel['geometry']; properties: { pnu: string; addr?: string } }[]
      }
    }
  }
}

let seq = 0

export function fetchParcel(lat: number, lng: number): Promise<Parcel> {
  return new Promise((resolve, reject) => {
    const callbackName = `__vworldParcel${Date.now()}_${seq++}`
    const callbacks = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    const cleanup = () => {
      clearTimeout(timer)
      delete callbacks[callbackName]
      script.remove()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('V-WORLD 응답이 늦어요. 잠시 후 다시 시도해 주세요'))
    }, TIMEOUT_MS)

    callbacks[callbackName] = (data: VworldResponse) => {
      cleanup()
      const res = data.response
      if (res.status === 'NOT_FOUND') return reject(new Error('이 좌표에서 필지를 찾지 못했어요'))
      const feature = res.result?.featureCollection.features[0]
      if (res.status !== 'OK' || !feature) return reject(new Error(`V-WORLD 오류: ${res.error?.text ?? '알 수 없음'}`))
      resolve({ pnu: feature.properties.pnu, jibun_addr: feature.properties.addr ?? null, geometry: feature.geometry })
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('V-WORLD에 연결하지 못했어요'))
    }

    const query = new URLSearchParams({
      service: 'data', request: 'GetFeature', data: 'LP_PA_CBND_BUBUN',
      key: VWORLD_KEY, domain: VWORLD_DOMAIN,
      geomFilter: `POINT(${lng} ${lat})`, crs: 'EPSG:4326', format: 'json', size: '1',
      callback: callbackName,
    })
    script.src = `https://api.vworld.kr/req/data?${query}`
    document.head.appendChild(script)
  })
}
