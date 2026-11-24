# Nonstop · 논 물관리 탄소 MRV 플랫폼

전북대학교 × 한국국토정보공사(LX) 산학 캡스톤 프로젝트.
AWD(주기적 습윤 건조) 논의 수위를 IoT 센서로 측정하고, 웹에서 관제하며, 메탄 감축량을 MRV 보고서로 자동 산출합니다.

- 웹: https://jbnu-nonstop.vercel.app
- API 문서: https://nonstop-backend-9nxc.onrender.com/docs

## 구조

```
센서(STM32 + 초음파) → LoRaWAN → RAK7268V2 → ChirpStack
                                                  ↓
            웹(frontend-v2, Vercel) ← FastAPI(backend, Render) → Supabase(PostgreSQL + PostGIS)
                                                  ↓
                                   Google Earth Engine (Sentinel-1)
```

| 폴더 | 내용 |
|---|---|
| `backend/` | FastAPI 서버: 필지·센서·수위·알림·AWD 지표·MRV 계산, OGC SensorThings API v1.1, Sentinel-1 분석 |
| `frontend-v2/` | 웹 (React + Vite + Tailwind). 대시보드, 관제, 알림, MRV 보고서, 위성 검증, 관리 |
| `frontend/` | 이전 버전 웹 (보관용) |
| `config.json` | Sentinel-1 분석 설정 (프로젝트 ID, 기간, 판정 기준값). 비밀 정보 없음 |

## 실행

**서버**
```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # macOS/Linux: venv/bin/pip
cp .env.example .env                           # DATABASE_URL 입력
venv/Scripts/python -m uvicorn app.main:app --port 8000
```

**웹**
```bash
cd frontend-v2
npm install
cp .env.example .env                           # VITE_API_URL, V-WORLD 키 입력
npm run dev
```

## Sentinel-1 위성 검증

'위성·드론 검증' 화면에서 등록된 필지를 고르거나 지도에 다각형을 그리면, 해당 영역의 Sentinel-1 SAR 관측값(VV 후방산란 중앙값, dB)을 날짜별로 보여주고 담수·낙수를 판정합니다.

| VV 중앙값 | 판정 |
|---|---|
| −14 dB 이하 | 담수 |
| −14 ~ −12 dB | 판정 불확실 |
| −12 dB 이상 | 낙수 |

- 기준값은 실측으로 검증하지 않은 **시범 규칙**입니다 (`config.json`에서 조정).
- 벼가 자라는 7월 이후에는 반사가 강해져 판정을 신뢰하기 어려워, **5월 ~ 7월 초** 분석을 권장합니다.
- 수위(cm)를 직접 재는 값이 아니며, 센서 측정을 보조하는 광역 검증 지표입니다.

**키 설정**
1. Google Cloud 서비스 계정 JSON 키를 받아 저장소 맨 위(`config.json`과 같은 폴더)에 둡니다. 파일 이름은 `config.json`의 `service_account_key_file`과 같아야 합니다.
2. 다른 위치에 두려면 `backend/.env`에 `EE_SERVICE_ACCOUNT_KEY_FILE=<경로>`를 지정합니다.
3. **키 파일은 절대 Git에 올리지 않습니다** (`.gitignore`에 등록됨).

## 배포

| 서비스 | 설정 |
|---|---|
| Render (backend) | 환경 변수 `DATABASE_URL`, `CORS_ORIGINS`. 위성 분석용 키는 **Secret Files**에 올리고 `EE_SERVICE_ACCOUNT_KEY_FILE=/etc/secrets/<파일 이름>` 지정 |
| Vercel (frontend-v2) | Root Directory `frontend-v2`, 환경 변수 `VITE_API_URL`, V-WORLD 키 |
