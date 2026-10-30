import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from html import escape
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

from . import sensorthings
from .db import get_engine, to_dict

load_dotenv()

app = FastAPI(title="Nonstop Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    ).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# OGC SensorThings API v1.1 (/v1.1/...)
app.include_router(sensorthings.router)


@app.get("/health")
def health():
    return {"status": "ok"}


def db_status() -> dict:
    """DB 연결 확인 + 버전(짧게) + 표별 행 수 + 마지막 측정 시각."""
    with get_engine().connect() as conn:
        version = conn.execute(text("show server_version")).scalar()
        postgis = conn.execute(
            text("select extversion from pg_extension where extname = 'postgis'")
        ).scalar()
        counts = conn.execute(
            text(
                "select (select count(*) from fields) as fields, (select count(*) from nodes) as nodes, "
                "(select count(*) from sensor_logs) as sensor_logs, (select count(*) from alerts) as alerts, "
                "(select max(measured_at) from sensor_logs) as latest_measured_at"
            )
        ).one()
    return {
        "status": "ok",
        "postgres": f"PostgreSQL {version.split()[0]}",
        "postgis": postgis,
        **to_dict(counts),
    }


@app.get("/health/db")
def health_db():
    try:
        return db_status()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def status_page():
    """브라우저로 열었을 때 보는 서버 상태 페이지 (프로그램용은 /health, /health/db)."""
    try:
        s = db_status()
        latest = s["latest_measured_at"]
        latest_text = (
            latest.astimezone(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M (한국 시각)")
            if latest else "측정 기록 없음"
        )
        db_ok = True
        rows = [
            ("DB", s["postgres"]),
            ("PostGIS", s["postgis"] or "설치 안 됨"),
            ("논", f"{s['fields']}개"),
            ("센서", f"{s['nodes']}대"),
            ("수위 측정값", f"{s['sensor_logs']:,}건"),
            ("알람", f"{s['alerts']}건"),
            ("마지막 측정", latest_text),
        ]
    except Exception as e:
        db_ok = False
        rows = [("오류", str(e)[:200])]

    badge = ("정상", "#1D9E75", "#e8f5e9") if db_ok else ("DB 연결 실패", "#c62828", "#fce4ec")
    table = "".join(f"<tr><th>{escape(k)}</th><td>{escape(str(v))}</td></tr>" for k, v in rows)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nonstop Backend</title>
<style>
  body {{ margin: 0; background: #fafafa; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #222; }}
  .card {{ max-width: 520px; margin: 48px auto; background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px; }}
  h1 {{ margin: 0 0 4px; font-size: 22px; color: #1D9E75; }}
  .sub {{ margin: 0 0 16px; font-size: 13px; color: #888; }}
  .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 13px;
           color: {badge[1]}; background: {badge[2]}; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }}
  th, td {{ text-align: left; padding: 9px 10px; border-bottom: 1px solid #f0f0f0; }}
  th {{ width: 35%; color: #666; font-weight: 600; }}
  .links {{ margin-top: 18px; font-size: 13px; }}
  .links a {{ color: #1D9E75; margin-right: 14px; }}
</style></head>
<body><div class="card">
  <h1>Nonstop Backend</h1>
  <p class="sub">AWD 논 물관리 · 탄소 MRV API 서버</p>
  <span class="badge">서버 {badge[0]}</span>
  <table>{table}</table>
  <div class="links"><a href="/docs">API 문서 (/docs)</a><a href="/v1.1">OGC SensorThings API (/v1.1)</a><a href="/health/db">상태 JSON</a></div>
</div></body></html>"""


# boundary는 GeoJSON으로, 필지 면적(ha)은 경계로 계산해서 같이 돌려줌
FIELD_COLUMNS = (
    "id, field_name, location_desc, latitude, longitude, area_ha, created_at, pnu, jibun_addr, "
    "ST_AsGeoJSON(boundary)::json as boundary, "
    "round((ST_Area(boundary::geography) / 10000)::numeric, 4) as parcel_area_ha"
)


class FieldCreate(BaseModel):
    field_name: str = Field(min_length=1)
    location_desc: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    area_ha: float | None = Field(default=None, gt=0)


@app.get("/fields")
def list_fields():
    with get_engine().connect() as conn:
        rows = conn.execute(text(f"select {FIELD_COLUMNS} from fields order by id")).all()
    return [to_dict(r) for r in rows]


@app.post("/fields", status_code=201)
def create_field(body: FieldCreate):
    with get_engine().begin() as conn:
        row = conn.execute(
            text(
                "insert into fields (field_name, location_desc, latitude, longitude, area_ha) "
                "values (:field_name, :location_desc, :latitude, :longitude, :area_ha) "
                f"returning {FIELD_COLUMNS}"
            ),
            body.model_dump(),
        ).one()
    return to_dict(row)


class FieldUpdate(BaseModel):
    field_name: str | None = Field(default=None, min_length=1)
    location_desc: str | None = None
    area_ha: float | None = Field(default=None, gt=0)


@app.patch("/fields/{field_id}")
def update_field(field_id: int, body: FieldUpdate):
    """논 이름·지역·사업 면적 수정 (보낸 항목만 바꿈, 지역·면적은 null로 비울 수 있음)."""
    changes = body.model_dump(exclude_unset=True)
    if changes.get("field_name") is None:
        changes.pop("field_name", None)  # 이름은 비울 수 없음
    if not changes:
        raise HTTPException(status_code=400, detail="바꿀 항목이 없습니다")
    sets = ", ".join(f"{k} = :{k}" for k in changes)  # 키는 FieldUpdate 필드명으로 고정
    with get_engine().begin() as conn:
        row = conn.execute(
            text(f"update fields set {sets} where id = :field_id returning {FIELD_COLUMNS}"),
            {**changes, "field_id": field_id},
        ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="존재하지 않는 논입니다")
    return to_dict(row)


class ParcelBody(BaseModel):
    """브라우저가 V-WORLD 연속지적도에서 받아 온 필지 (V-WORLD가 해외 서버 접속을 막아서 서버가 직접 못 부름)."""
    pnu: str = Field(min_length=19, max_length=19)
    jibun_addr: str | None = None
    geometry: dict  # GeoJSON Polygon 또는 MultiPolygon (EPSG:4326)

    @field_validator("geometry")
    @classmethod
    def check_geometry(cls, v: dict) -> dict:
        if v.get("type") not in ("Polygon", "MultiPolygon") or not v.get("coordinates"):
            raise ValueError("geometry는 GeoJSON Polygon 또는 MultiPolygon이어야 합니다")
        return v


@app.put("/fields/{field_id}/parcel")
def save_parcel(field_id: int, body: ParcelBody):
    """논의 필지 경계·PNU·지번 주소 저장 (경계로 필지 면적도 같이 계산해서 돌려줌)."""
    try:
        with get_engine().begin() as conn:
            row = conn.execute(
                text(
                    "update fields set pnu = :pnu, jibun_addr = :jibun_addr, "
                    "boundary = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326)) "
                    f"where id = :id returning {FIELD_COLUMNS}"
                ),
                {"pnu": body.pnu, "jibun_addr": body.jibun_addr,
                 "geometry": json.dumps(body.geometry), "id": field_id},
            ).first()
    except DBAPIError:
        raise HTTPException(status_code=400, detail="필지 경계 도형이 올바르지 않습니다")
    if row is None:
        raise HTTPException(status_code=404, detail="존재하지 않는 논입니다")
    return to_dict(row)


NODE_COLUMNS = (
    "id, field_id, node_name, dev_eui, latitude, longitude, location_desc, is_active, has_pump, created_at"
)


class NodeCreate(BaseModel):
    field_id: int
    node_name: str = Field(min_length=1)
    dev_eui: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_desc: str | None = None
    has_pump: bool = False

    @field_validator("dev_eui")
    @classmethod
    def normalize_dev_eui(cls, v: str) -> str:
        v = re.sub(r"[\s:\-]", "", v).upper()
        if not re.fullmatch(r"[0-9A-F]{16}", v):
            raise ValueError("DevEUI는 16자리 16진수여야 합니다")
        return v


@app.get("/nodes")
def list_nodes(field_id: int | None = None):
    query = f"select {NODE_COLUMNS} from nodes"
    params = {}
    if field_id is not None:
        query += " where field_id = :field_id"
        params["field_id"] = field_id
    with get_engine().connect() as conn:
        rows = conn.execute(text(query + " order by id"), params).all()
    return [to_dict(r) for r in rows]


@app.post("/nodes", status_code=201)
def create_node(body: NodeCreate):
    try:
        with get_engine().begin() as conn:
            row = conn.execute(
                text(
                    "insert into nodes (field_id, node_name, dev_eui, latitude, longitude, location_desc, has_pump) "
                    "values (:field_id, :node_name, :dev_eui, :latitude, :longitude, :location_desc, :has_pump) "
                    f"returning {NODE_COLUMNS}"
                ),
                body.model_dump(),
            ).one()
    except IntegrityError as e:
        sqlstate = getattr(e.orig, "sqlstate", None)
        if sqlstate == "23505":
            raise HTTPException(status_code=409, detail="이미 등록된 DevEUI입니다")
        if sqlstate == "23503":
            raise HTTPException(status_code=400, detail="존재하지 않는 논입니다")
        raise
    return to_dict(row)


class NodeUpdate(BaseModel):
    node_name: str | None = Field(default=None, min_length=1)
    location_desc: str | None = None
    has_pump: bool | None = None


@app.patch("/nodes/{node_id}")
def update_node(node_id: int, body: NodeUpdate):
    """센서 이름·설명·펌프 연결 여부 수정 (보낸 항목만 바꿈)."""
    changes = body.model_dump(exclude_unset=True)
    if changes.get("node_name") is None:
        changes.pop("node_name", None)  # 이름은 비울 수 없음
    if changes.get("has_pump") is None:
        changes.pop("has_pump", None)
    if not changes:
        raise HTTPException(status_code=400, detail="바꿀 항목이 없습니다")
    sets = ", ".join(f"{k} = :{k}" for k in changes)  # 키는 NodeUpdate 필드명으로 고정
    with get_engine().begin() as conn:
        row = conn.execute(
            text(f"update nodes set {sets} where id = :node_id returning {NODE_COLUMNS}"),
            {**changes, "node_id": node_id},
        ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="존재하지 않는 센서입니다")
    return to_dict(row)


LOG_COLUMNS = "node_id, inner_water_level, pump_on, battery_voltage, measured_at"

# 기간이 길면 점이 너무 많아져서 일정 간격으로 평균을 내서 보냄 (None = 원본 그대로)
PERIODS = {
    "1h": ("1 hour", None),
    "1d": ("1 day", None),
    "1w": ("7 days", "1 hour"),
    "1m": ("30 days", "4 hours"),
}


@app.get("/nodes/latest")
def latest_logs():
    """센서별 가장 최근 측정값."""
    with get_engine().connect() as conn:
        rows = conn.execute(
            text(
                f"select distinct on (node_id) {LOG_COLUMNS} from sensor_logs "
                "order by node_id, measured_at desc"
            )
        ).all()
    return [to_dict(r) for r in rows]


@app.get("/nodes/{node_id}/logs")
def node_logs(node_id: int, period: Literal["1h", "1d", "1w", "1m"] = "1d"):
    interval, bucket = PERIODS[period]
    if bucket is None:
        query = (
            f"select {LOG_COLUMNS} from sensor_logs "
            "where node_id = :node_id and measured_at >= now() - cast(:interval as interval) "
            "order by measured_at"
        )
    else:
        query = (
            "select node_id, round(avg(inner_water_level)::numeric, 1) as inner_water_level, "
            "bool_or(pump_on) as pump_on, round(avg(battery_voltage)::numeric, 2) as battery_voltage, "
            "date_bin(cast(:bucket as interval), measured_at, timestamptz '2000-01-01') as measured_at "
            "from sensor_logs "
            "where node_id = :node_id and measured_at >= now() - cast(:interval as interval) "
            "group by node_id, 5 order by 5"
        )
    with get_engine().connect() as conn:
        rows = conn.execute(
            text(query), {"node_id": node_id, "interval": interval, "bucket": bucket}
        ).all()
    return [to_dict(r) for r in rows]


# 낙수 = 수위가 -15cm 이하까지 내려간 횟수 (완전히 마른 경우만 세는 보수적 기준).
# 기준선 근처 흔들림으로 중복 집계되지 않게, -10cm 위로 회복된 뒤에만 다음 낙수를 셈.
DRY_LEVEL_CM = -15.0
REARM_LEVEL_CM = -10.0

# Gold Standard 방법론 3번째 방법(IPCC 기본값) 표 4의 물관리 계수 SF_w
WATER_REGIMES = {
    "CONTINUOUS": 1.0,  # 낙수 0회: 상시 담수
    "SINGLE": 0.71,     # 낙수 1회
    "MULTIPLE": 0.55,   # 낙수 2회 이상 (AWD)
}


def detect_drains(rows):
    """(수위, 시각) 목록에서 낙수 사건을 찾음: -15cm 도달 시각, 최저 수위, -10cm 위로 회복된 시각."""
    events = []
    current = None
    for level, measured_at in rows:
        if current is None:
            if level <= DRY_LEVEL_CM:
                current = {"dry_at": measured_at, "min_level_cm": level, "reflood_at": None}
        elif level > REARM_LEVEL_CM:
            current["reflood_at"] = measured_at
            events.append(current)
            current = None
        else:
            current["min_level_cm"] = min(current["min_level_cm"], level)
    if current is not None:
        events.append(current)  # 기간이 끝날 때까지 회복 안 된 낙수
    for i, e in enumerate(events, start=1):
        e["no"] = i
        e["min_level_cm"] = round(float(e["min_level_cm"]), 1)
    return events


def water_regime(drain_count: int) -> str:
    return "CONTINUOUS" if drain_count == 0 else "SINGLE" if drain_count == 1 else "MULTIPLE"


# 준수율: -15cm 도달 후 이 시간 안에 재관개(-10cm 위로 회복)하면 AWD 운영 원칙을 지킨 것으로 봄
COMPLIANCE_HOURS = 24
# 가동률 계산용 업링크 주기 (센서 팀 확인 전 임시값, 프론트 STALE_MINUTES와 별개)
EXPECTED_UPLINK_MINUTES = 10
# 측정 사이 간격이 이보다 길면 끊긴 구간으로 보고 상태별 일수에 넣지 않음
MAX_GAP_MINUTES = 60


def awd_indicators(rows, events, period_start: datetime, period_end: datetime,
                   sample_count: int, node_count: int) -> dict:
    """AWD 물관리 지표: 상태별 일수(담수/습윤/건조), 사이클 횟수, 준수율, 데이터 수집 가동률."""
    # 각 측정값이 다음 측정 전까지 유지됐다고 보고 상태별 시간을 더함
    minutes = {"flooded": 0.0, "wet": 0.0, "dry": 0.0}
    for (level, t), (_, t_next) in zip(rows, rows[1:]):
        gap = min((t_next - t).total_seconds() / 60, MAX_GAP_MINUTES)
        state = "dry" if level <= DRY_LEVEL_CM else "wet" if level < 0 else "flooded"
        minutes[state] += gap

    # 기간 끝까지 판정 시간이 안 지난 낙수(회복 전이고 24시간 미만)는 판정에서 뺌
    limit = timedelta(hours=COMPLIANCE_HOURS)
    judged = [e for e in events if e["reflood_at"] is not None or period_end - e["dry_at"] >= limit]
    complied = [e for e in judged if e["reflood_at"] is not None and e["reflood_at"] - e["dry_at"] <= limit]

    # 가동률: 첫 측정(설치 시점으로 간주)부터 기간 끝까지 받아야 할 측정 수 대비 실제 받은 수
    start = max(period_start, rows[0][1]) if rows else period_start
    expected = node_count * (period_end - start).total_seconds() / 60 / EXPECTED_UPLINK_MINUTES

    return {
        "flooded_days": round(minutes["flooded"] / 1440, 1),
        "wet_days": round(minutes["wet"] / 1440, 1),
        "dry_days": round(minutes["dry"] / 1440, 1),
        "cycle_count": len(events),
        "compliance_rate": round(100 * len(complied) / len(judged), 1) if judged else None,
        "compliant_events": len(complied),
        "judged_events": len(judged),
        "compliance_hours": COMPLIANCE_HOURS,
        "uptime_rate": min(100.0, round(100 * sample_count / expected, 1)) if expected > 0 else None,
        "expected_uplink_minutes": EXPECTED_UPLINK_MINUTES,
    }


@app.get("/nodes/{node_id}/awd")
def node_awd(node_id: int, period: Literal["1h", "1d", "1w", "1m"] = "1m"):
    """선택 기간의 낙수 횟수, 물관리 계수, AWD 지표."""
    interval, _ = PERIODS[period]
    with get_engine().connect() as conn:
        now, start = conn.execute(text("select now(), now() - cast(:interval as interval)"), {"interval": interval}).one()
        rows = conn.execute(
            text(
                "select inner_water_level, measured_at from sensor_logs "
                "where node_id = :node_id and measured_at >= :start and inner_water_level is not null "
                "order by measured_at"
            ),
            {"node_id": node_id, "start": start},
        ).all()

    events = detect_drains(rows)
    regime = water_regime(len(events))
    return {
        "sample_count": len(rows),
        "drain_events": len(events),
        "last_drain_at": events[-1]["dry_at"] if events else None,
        "water_regime": regime,
        "sf_w": WATER_REGIMES[regime],
        "indicators": awd_indicators(rows, events, start, now, len(rows), 1),
    }


# Gold Standard 방법론 3번째 방법(IPCC 기본값 간이법) 계수
EF_C_KR = 1.83          # 기본 배출계수 (kgCH4/ha/day, 한국)
DEFAULT_SF_P = 0.89     # 작기 전 물관리 보정계수 기본값
DEFAULT_SF_O = 1.48     # 유기물 투입 보정계수 기본값
GWP_CH4 = 28            # 메탄 지구온난화지수 (IPCC AR5)
UNCERTAINTY = 0.15      # 불확도 보수적 차감


def carbon_reduction(area_ha: float, days: int, sf_w: float, sf_p: float, sf_o: float) -> dict:
    """기준(상시담수) 배출량 - 사업(AWD) 배출량, 불확도 차감 후 순 감축량 (tCO2e)."""
    ef_bl = EF_C_KR * 1.0 * sf_p * sf_o
    ef_p = EF_C_KR * sf_w * sf_p * sf_o

    def to_co2e(ef: float) -> float:
        return ef * area_ha * days * 1e-3 * GWP_CH4

    baseline, project = to_co2e(ef_bl), to_co2e(ef_p)
    return {
        "ef_bl": ef_bl,
        "ef_p": ef_p,
        "ef_er": ef_bl - ef_p,
        "baseline_tco2e": baseline,
        "project_tco2e": project,
        "net_tco2e": (baseline - project) * (1 - UNCERTAINTY),
    }


@app.get("/fields/{field_id}/mrv")
def field_mrv(
    field_id: int,
    start: date,
    end: date,
    sf_p: float = Query(DEFAULT_SF_P, gt=0),
    sf_o: float = Query(DEFAULT_SF_O, gt=0),
):
    """MRV 보고서용 재배기간(한국 날짜 기준, 시작·종료일 포함) 모니터링 데이터와 감축량."""
    if end < start:
        raise HTTPException(status_code=400, detail="수확일은 이앙일보다 뒤여야 합니다.")
    period = (
        "measured_at >= cast(:start as date)::timestamp at time zone 'Asia/Seoul' "
        "and measured_at < (cast(:end as date) + 1)::timestamp at time zone 'Asia/Seoul'"
    )
    params = {"field_id": field_id, "start": start, "end": end}
    with get_engine().connect() as conn:
        field = conn.execute(text("select area_ha from fields where id = :field_id"), params).first()
        if field is None:
            raise HTTPException(status_code=404, detail="존재하지 않는 논입니다")
        if field.area_ha is None:
            raise HTTPException(status_code=400, detail="선택한 논에 면적(ha)이 없습니다. 논 정보에 면적을 먼저 입력해 주세요.")
        node_rows = conn.execute(
            text("select id, node_name from nodes where field_id = :field_id order by id"), params
        ).all()
        # 지표 계산용 기간 (아직 안 끝난 재배기간이면 지금까지)
        period_start, period_end = conn.execute(
            text(
                "select cast(:start as date)::timestamp at time zone 'Asia/Seoul', "
                "least(now(), (cast(:end as date) + 1)::timestamp at time zone 'Asia/Seoul')"
            ),
            params,
        ).one()
        # 노드가 여러 개면 10분 단위로 평균 낸 논 전체 수위로 낙수를 판정
        series = conn.execute(
            text(
                "select avg(inner_water_level) as level, "
                "date_bin('10 minutes', measured_at, timestamptz '2000-01-01') as t "
                "from sensor_logs where node_id in (select id from nodes where field_id = :field_id) "
                f"and inner_water_level is not null and {period} group by t order by t"
            ),
            params,
        ).all()
        stats = conn.execute(
            text(
                "select count(*) as sample_count, "
                "percentile_cont(0.5) within group (order by gap) as median_gap_sec "
                "from (select extract(epoch from measured_at - lag(measured_at) over "
                "      (partition by node_id order by measured_at)) as gap "
                "      from sensor_logs where node_id in (select id from nodes where field_id = :field_id) "
                f"      and {period}) s"
            ),
            params,
        ).one()

    events = detect_drains(series)
    regime = water_regime(len(events))
    sf_w = WATER_REGIMES[regime]
    area_ha = float(field.area_ha)
    days = (end - start).days + 1
    gap = stats.median_gap_sec
    return {
        "node_names": [r.node_name or f"Node {r.id}" for r in node_rows],
        "sample_count": stats.sample_count,
        "interval_min": round(float(gap) / 60) if gap else None,
        "drain_events": events,
        "water_regime": regime,
        "area_ha": area_ha,
        "season_days": days,
        "factors": {
            "ef_c": EF_C_KR, "sf_w": sf_w, "sf_p": sf_p, "sf_o": sf_o,
            "gwp_ch4": GWP_CH4, "uncertainty": UNCERTAINTY,
        },
        "calculation": carbon_reduction(area_ha, days, sf_w, sf_p, sf_o),
        "indicators": awd_indicators(
            series, events, period_start, period_end, stats.sample_count, max(len(node_rows), 1)
        ),
    }


@app.get("/nodes/{node_id}/stats")
def node_stats(node_id: int):
    """최근 24시간 수위 평균·최고·최저와 알람 수."""
    with get_engine().connect() as conn:
        row = conn.execute(
            text(
                "select round(avg(inner_water_level)::numeric, 1) as avg, "
                "max(inner_water_level) as max, min(inner_water_level) as min "
                "from sensor_logs where node_id = :node_id and measured_at >= now() - interval '24 hours'"
            ),
            {"node_id": node_id},
        ).one()
        alert_count = conn.execute(
            text(
                "select count(*) from alerts "
                "where node_id = :node_id and created_at >= now() - interval '24 hours'"
            ),
            {"node_id": node_id},
        ).scalar()
    return {**to_dict(row), "alert_count": alert_count}


ALERT_SELECT = (
    "select a.id, a.node_id, n.node_name, n.field_id, n.has_pump, a.alert_type, a.water_level, a.message, "
    "a.is_resolved, a.resolved_at, a.resolution_note, a.created_at "
    "from alerts a join nodes n on n.id = a.node_id"
)

# 업링크 주기를 아직 몰라서 30분으로 잡음 (프론트 STALE_MINUTES와 맞출 것)
COMM_LOST_MINUTES = 30
# 수위가 기준을 벗어난 상태(-15cm 이하 / +5cm 초과)가 이 시간 이상 이어지면 알람
SUSTAINED_HOURS = 6
TARGET_LEVEL_CM = 5.0
# 수위 알람 판정에 볼 최근 기간 (측정값이 많아져도 조회가 느려지지 않게)
LEVEL_ALERT_LOOKBACK_DAYS = 30
# refresh_derived_alerts 동시 실행 방지용 잠금 번호 (아무 고정 숫자)
DERIVED_ALERT_LOCK_KEY = 20261011


def refresh_derived_alerts(conn) -> None:
    """측정값만 보고 판단하는 알람(통신 끊김, 재관개 필요, 수위 높음, 재관개 실패)을 조회 시점에 갱신.

    별도 스케줄러 없이 알람을 열 때마다 확인하고, 같은 알람은 중복으로 만들지 않음.
    """
    # 요청 두 개가 동시에 들어와도 한 번에 하나만 검사하게 잠금 (트랜잭션 끝나면 자동 해제)
    conn.execute(text("select pg_advisory_xact_lock(:key)"), {"key": DERIVED_ALERT_LOCK_KEY})
    # 통신 끊김: 마지막 측정이 기준보다 오래됐고, 이번 끊김에 대한 알람이 아직 없으면 생성
    # (사람이 먼저 해결 처리해도 같은 끊김으로 다시 만들지 않도록 마지막 측정 이후 알람 유무로 판단)
    conn.execute(
        text(
            "insert into alerts (node_id, alert_type, water_level, message, created_at, is_test) "
            "select l.node_id, 'COMM_LOST', l.inner_water_level, "
            "       '마지막 측정 후 ' || :minutes || '분 넘게 데이터 없음', "
            "       l.measured_at + make_interval(mins => :minutes), l.is_test "
            "from (select distinct on (node_id) node_id, inner_water_level, measured_at, is_test "
            "      from sensor_logs order by node_id, measured_at desc) l "
            "where l.measured_at < now() - make_interval(mins => :minutes) "
            "  and not exists (select 1 from alerts a where a.node_id = l.node_id "
            "                  and a.alert_type = 'COMM_LOST' and a.created_at >= l.measured_at)"
        ),
        {"minutes": COMM_LOST_MINUTES},
    )
    # 데이터가 다시 들어오면 통신 끊김 알람 자동 해결
    conn.execute(
        text(
            "update alerts a set is_resolved = true, resolved_at = now(), "
            "       resolution_note = '데이터 수신 재개 (자동 해결)' "
            "where a.alert_type = 'COMM_LOST' and not a.is_resolved "
            "  and exists (select 1 from sensor_logs l where l.node_id = a.node_id "
            "              and l.measured_at > now() - make_interval(mins => :minutes))"
        ),
        {"minutes": COMM_LOST_MINUTES},
    )
    # 수위 알람: 같은 상태가 이어진 구간(-15cm 이하 / +5cm 초과)이 6시간 이상이면 구간마다 1건
    #  - -15cm 이하: 펌프 없음 → 재관개 필요 / 펌프 있음 → 재관개 실패 (자동 재관개가 안 된 것)
    #  - +5cm 초과: 수위 높음
    # 알람 시각 = 구간 시작 + 6시간 (같은 구간으로 다시 만들지 않는 기준으로도 씀)
    conn.execute(
        text(
            "with l as ("
            "  select node_id, measured_at, inner_water_level as lv, is_test, "
            "         case when inner_water_level <= :dry then 'LOW' "
            "              when inner_water_level > :target then 'HIGH' end as state "
            "  from sensor_logs where inner_water_level is not null "
            "    and measured_at >= now() - make_interval(days => :lookback)), "
            "g as ("
            "  select *, row_number() over (partition by node_id order by measured_at) "
            "          - row_number() over (partition by node_id, state order by measured_at) as grp from l), "
            "ep as ("
            "  select node_id, state, min(measured_at) as started, max(measured_at) as ended, "
            "         min(lv) as lowest, max(lv) as highest, bool_or(is_test) as is_test "
            "  from g where state is not null group by node_id, state, grp), "
            "a as ("
            "  select ep.*, ep.started + make_interval(hours => :hours) as alert_at, "
            "         case when ep.state = 'HIGH' then 'HIGH_WATER' "
            "              when n.has_pump then 'IRRIGATION_FAIL' else 'LOW_WATER' end as alert_type "
            "  from ep join nodes n on n.id = ep.node_id "
            "  where ep.ended - ep.started >= make_interval(hours => :hours)) "
            "insert into alerts (node_id, alert_type, water_level, message, created_at, is_test) "
            "select a.node_id, a.alert_type, "
            "       case when a.state = 'HIGH' then a.highest else a.lowest end, "
            "       case a.alert_type when 'HIGH_WATER' then :msg_high when 'LOW_WATER' then :msg_low "
            "            else :msg_fail end, "
            "       a.alert_at, a.is_test "
            "from a "
            "where not exists (select 1 from alerts x where x.node_id = a.node_id "
            "                  and x.alert_type = a.alert_type and x.created_at = a.alert_at)"
        ),
        {
            "dry": DRY_LEVEL_CM, "target": TARGET_LEVEL_CM, "hours": SUSTAINED_HOURS,
            "lookback": LEVEL_ALERT_LOOKBACK_DAYS,
            "msg_high": f"수위 +{TARGET_LEVEL_CM:g}cm 초과가 {SUSTAINED_HOURS}시간 넘게 지속 (물꼬 확인 필요)",
            "msg_low": f"수위 {DRY_LEVEL_CM:g}cm 이하가 {SUSTAINED_HOURS}시간 넘게 지속 (재관개 필요)",
            "msg_fail": f"펌프 연결 센서인데 수위 {DRY_LEVEL_CM:g}cm 이하가 {SUSTAINED_HOURS}시간 넘게 지속 "
                        "(자동 재관개 실패, 펌프 점검 필요)",
        },
    )


@app.get("/alerts")
def list_alerts(field_id: int | None = None):
    query = ALERT_SELECT
    params = {}
    if field_id is not None:
        query += " where n.field_id = :field_id"
        params["field_id"] = field_id
    with get_engine().begin() as conn:
        refresh_derived_alerts(conn)
        rows = conn.execute(text(query + " order by a.created_at desc"), params).all()
    return [to_dict(r) for r in rows]


class ResolveBody(BaseModel):
    note: str | None = Field(default=None, max_length=500)


@app.patch("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, body: ResolveBody | None = None):
    note = ((body.note or "").strip() or None) if body else None
    with get_engine().begin() as conn:
        updated = conn.execute(
            text(
                "update alerts set is_resolved = true, resolved_at = now(), resolution_note = :note "
                "where id = :id and not is_resolved returning id"
            ),
            {"id": alert_id, "note": note},
        ).first()
        if updated is None:
            exists = conn.execute(text("select 1 from alerts where id = :id"), {"id": alert_id}).first()
            if exists is None:
                raise HTTPException(status_code=404, detail="알람을 찾을 수 없습니다")
        row = conn.execute(text(ALERT_SELECT + " where a.id = :id"), {"id": alert_id}).one()
    return to_dict(row)

