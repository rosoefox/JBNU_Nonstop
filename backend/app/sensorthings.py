"""OGC SensorThings API v1.1 (Sensing 핵심) — 기존 표를 표준 형식으로 보여주는 읽기 전용 계층 + 관측값 등록.

DB에 표를 새로 만들지 않고 아래처럼 대응시킴:
  Thing / Location / HistoricalLocation = nodes (같은 id)
  Datastream   = 노드 × 측정 항목 (id = 노드id*10 + 항목번호, 1: 수위, 2: 배터리 전압)
  Sensor / ObservedProperty = 측정 항목 2종 (고정값)
  Observation  = sensor_logs 한 줄 × 항목 (id = 로그id*10 + 항목번호)
  FeatureOfInterest = fields (필지 경계, 없으면 논 좌표)

지원: 모든 엔티티 조회, 관계 따라가기, $top $skip $count $orderby $select $filter $expand,
      POST Observations (수위만). 미지원: 수정·삭제, MQTT, 일괄 등록, $filter 함수.
"""
import json
import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .db import get_engine

router = APIRouter(prefix="/v1.1", tags=["OGC SensorThings API v1.1"])

DEFAULT_TOP = 100
MAX_TOP = 1000

# 측정 항목 (Datastream 번호 끝자리 = 항목 번호)
KINDS = {
    1: {
        "name": "수위",
        "definition": "https://en.wikipedia.org/wiki/Water_level",
        "description": "논 내부 수위 (지표면 0cm 기준, 물이 위에 있으면 +)",
        "unit": {"name": "centimetre", "symbol": "cm", "definition": "http://qudt.org/vocab/unit/CentiM"},
        "column": "inner_water_level",
        "sensor_name": "수위 센서",
        "sensor_description": "논 수위 측정 센서 (모델은 센서 팀 확인 후 기재)",
    },
    2: {
        "name": "배터리 전압",
        "definition": "https://en.wikipedia.org/wiki/Voltage",
        "description": "센서 노드 배터리 전압",
        "unit": {"name": "volt", "symbol": "V", "definition": "http://qudt.org/vocab/unit/V"},
        "column": "battery_voltage",
        "sensor_name": "배터리 전압 측정",
        "sensor_description": "STM32 노드(NUCLEO-WL55JC1) 내장 ADC 전압 측정",
    },
}
OBSERVATION_TYPE = "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement"


def _values(rows: list[tuple]) -> str:
    """고정값 표를 SQL VALUES로 (작은따옴표 이스케이프)."""
    def lit(v):
        return "NULL" if v is None else str(v) if isinstance(v, int) else "'" + str(v).replace("'", "''") + "'"
    return ", ".join("(" + ", ".join(lit(v) for v in row) + ")" for row in rows)


_KIND_ROWS = _values([
    (k, v["name"], v["definition"], v["description"], json.dumps(v["unit"], ensure_ascii=False),
     v["sensor_name"], v["sensor_description"])
    for k, v in KINDS.items()
])


def _observations_sql(kinds=(1, 2), node_id_param: str | None = None) -> str:
    branches = []
    for k in kinds:
        col = KINDS[k]["column"]
        node_filter = f" and l.node_id = :{node_id_param}" if node_id_param else ""
        branches.append(
            f"select l.id * 10 + {k} as id, l.measured_at as \"phenomenonTime\", l.measured_at as \"resultTime\", "
            f"l.{col}::float8 as result, l.node_id * 10 + {k} as datastream_id, n.field_id as foi_id "
            f"from sensor_logs l join nodes n on n.id = l.node_id where l.{col} is not null{node_filter}"
        )
    return " union all ".join(branches)


# 엔티티별: SQL(표준 속성 이름으로), 밖으로 내보낼 속성, $filter/$orderby에 쓸 수 있는 속성
ENTITIES = {
    "Things": {
        "sql": "select n.id, n.node_name as name, coalesce(n.location_desc, '') as description, "
               "json_build_object('devEUI', n.dev_eui, 'fieldId', n.field_id, 'hasPump', n.has_pump, "
               "'isActive', n.is_active) as properties from nodes n",
        "fields": ["name", "description", "properties"],
        "filterable": ["id", "name", "description"],
        "navs": ["Locations", "HistoricalLocations", "Datastreams"],
    },
    "Locations": {
        "sql": "select n.id, n.node_name as name, coalesce(n.location_desc, '') as description, "
               "'application/geo+json' as \"encodingType\", ST_AsGeoJSON(n.geom)::json as location from nodes n",
        "fields": ["name", "description", "encodingType", "location"],
        "filterable": ["id", "name", "description", "encodingType"],
        "navs": ["Things", "HistoricalLocations"],
    },
    "HistoricalLocations": {
        "sql": "select n.id, n.created_at as time from nodes n",
        "fields": ["time"],
        "filterable": ["id", "time"],
        "navs": ["Thing", "Locations"],
    },
    "Datastreams": {
        "sql": "select n.id * 10 + k.kind as id, coalesce(n.node_name, 'Node ' || n.id) || ' ' || k.name as name, "
               "k.description, k.unit::json as \"unitOfMeasurement\", "
               f"'{OBSERVATION_TYPE}' as \"observationType\", n.id as thing_id, k.kind "
               f"from nodes n cross join (values {_KIND_ROWS}) "
               "as k(kind, name, definition, description, unit, sensor_name, sensor_description)",
        "fields": ["name", "description", "unitOfMeasurement", "observationType"],
        "filterable": ["id", "name", "description", "observationType"],
        "navs": ["Thing", "Sensor", "ObservedProperty", "Observations"],
    },
    "Sensors": {
        "sql": "select k.kind as id, k.sensor_name as name, k.sensor_description as description, "
               "'text/plain' as \"encodingType\", k.sensor_description as metadata "
               f"from (values {_KIND_ROWS}) as k(kind, name, definition, description, unit, sensor_name, sensor_description)",
        "fields": ["name", "description", "encodingType", "metadata"],
        "filterable": ["id", "name", "description"],
        "navs": ["Datastreams"],
    },
    "ObservedProperties": {
        "sql": "select k.kind as id, k.name, k.definition, k.description "
               f"from (values {_KIND_ROWS}) as k(kind, name, definition, description, unit, sensor_name, sensor_description)",
        "fields": ["name", "definition", "description"],
        "filterable": ["id", "name", "definition", "description"],
        "navs": ["Datastreams"],
    },
    "Observations": {
        "sql": _observations_sql(),
        "fields": ["phenomenonTime", "resultTime", "result"],
        "filterable": ["id", "phenomenonTime", "resultTime", "result"],
        "navs": ["Datastream", "FeatureOfInterest"],
    },
    "FeaturesOfInterest": {
        "sql": "select f.id, f.field_name as name, coalesce(f.jibun_addr, '') as description, "
               "'application/geo+json' as \"encodingType\", "
               "coalesce(ST_AsGeoJSON(f.boundary), ST_AsGeoJSON(f.geom))::json as feature from fields f",
        "fields": ["name", "description", "encodingType", "feature"],
        "filterable": ["id", "name", "description"],
        "navs": ["Observations"],
    },
}

# 관계: (출발 엔티티, 이동 이름) → (도착 엔티티, 도착 쪽 열, 출발 쪽 열, 목록 여부)
RELATIONS = {
    ("Things", "Locations"): ("Locations", "id", "id", True),
    ("Things", "HistoricalLocations"): ("HistoricalLocations", "id", "id", True),
    ("Things", "Datastreams"): ("Datastreams", "thing_id", "id", True),
    ("Locations", "Things"): ("Things", "id", "id", True),
    ("Locations", "HistoricalLocations"): ("HistoricalLocations", "id", "id", True),
    ("HistoricalLocations", "Thing"): ("Things", "id", "id", False),
    ("HistoricalLocations", "Locations"): ("Locations", "id", "id", True),
    ("Datastreams", "Thing"): ("Things", "id", "thing_id", False),
    ("Datastreams", "Sensor"): ("Sensors", "id", "kind", False),
    ("Datastreams", "ObservedProperty"): ("ObservedProperties", "id", "kind", False),
    ("Datastreams", "Observations"): ("Observations", "datastream_id", "id", True),
    ("Sensors", "Datastreams"): ("Datastreams", "kind", "id", True),
    ("ObservedProperties", "Datastreams"): ("Datastreams", "kind", "id", True),
    ("Observations", "Datastream"): ("Datastreams", "id", "datastream_id", False),
    ("Observations", "FeatureOfInterest"): ("FeaturesOfInterest", "id", "foi_id", False),
    ("FeaturesOfInterest", "Observations"): ("Observations", "foi_id", "id", True),
}

CONFORMANCE = [
    "http://www.opengis.net/spec/iot_sensing/1.1/req/datamodel",
    "http://www.opengis.net/spec/iot_sensing/1.1/req/resource-path/resource-path-to-entities",
    "http://www.opengis.net/spec/iot_sensing/1.1/req/request-data",
]


# ---------- $filter: 비교(eq ne gt ge lt le) + and/or/not + 괄호 → SQL ----------

_TOKEN = re.compile(
    r"\s*(?:(?P<str>'(?:[^']|'')*')|(?P<dt>\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)"
    r"|(?P<num>-?\d+(?:\.\d+)?)|(?P<paren>[()])|(?P<word>[A-Za-z_][A-Za-z0-9_/]*))"
)
_OPS = {"eq": "=", "ne": "<>", "gt": ">", "ge": ">=", "lt": "<", "le": "<="}


class _FilterParser:
    def __init__(self, expr: str, allowed: list[str], params: dict, prefix: str):
        self.tokens = []
        pos = 0
        while pos < len(expr):
            m = _TOKEN.match(expr, pos)
            if not m or m.end() == pos:
                if expr[pos:].strip() == "":
                    break
                raise HTTPException(status_code=400, detail=f"$filter를 해석할 수 없습니다: {expr[pos:]}")
            kind = m.lastgroup
            self.tokens.append((kind, m.group(kind)))
            pos = m.end()
        self.i = 0
        self.allowed = allowed
        self.params = params
        self.prefix = prefix

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else (None, None)

    def take(self):
        tok = self.peek()
        self.i += 1
        return tok

    def parse(self) -> str:
        sql = self.or_expr()
        if self.i != len(self.tokens):
            raise HTTPException(status_code=400, detail="$filter 끝에 해석할 수 없는 부분이 있습니다")
        return sql

    def or_expr(self):
        left = self.and_expr()
        while self.peek() == ("word", "or"):
            self.take()
            left = f"({left} or {self.and_expr()})"
        return left

    def and_expr(self):
        left = self.not_expr()
        while self.peek() == ("word", "and"):
            self.take()
            left = f"({left} and {self.not_expr()})"
        return left

    def not_expr(self):
        if self.peek() == ("word", "not"):
            self.take()
            return f"(not {self.not_expr()})"
        return self.comparison()

    def comparison(self):
        left = self.operand()
        kind, value = self.peek()
        if kind == "word" and value in _OPS:
            self.take()
            return f"({left} {_OPS[value]} {self.operand()})"
        return left

    def operand(self):
        kind, value = self.take()
        if kind == "paren" and value == "(":
            inner = self.or_expr()
            if self.take() != ("paren", ")"):
                raise HTTPException(status_code=400, detail="$filter 괄호가 맞지 않습니다")
            return inner
        if kind == "word":
            if value in ("true", "false", "null"):
                return value
            if value not in self.allowed:
                raise HTTPException(status_code=400, detail=f"$filter에서 쓸 수 없는 속성입니다: {value} (가능: {', '.join(self.allowed)})")
            return f'e."{value}"'
        name = f"{self.prefix}{len(self.params)}"
        if kind == "str":
            self.params[name] = value[1:-1].replace("''", "'")
        elif kind == "num":
            self.params[name] = float(value) if "." in value else int(value)
        elif kind == "dt":
            self.params[name] = datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            raise HTTPException(status_code=400, detail="$filter 형식이 올바르지 않습니다")
        return f":{name}"


# ---------- 쿼리 옵션 ----------

def _split_top_level(s: str, sep: str) -> list[str]:
    """괄호 안은 건드리지 않고 sep로 나눔 ($expand=Datastreams($top=1;$select=name),Locations)."""
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def _parse_expand(value: str) -> list[tuple[str, dict]]:
    items = []
    for part in _split_top_level(value, ","):
        m = re.fullmatch(r"([A-Za-z]+)(?:\((.*)\))?", part, re.S)
        if not m:
            raise HTTPException(status_code=400, detail=f"$expand 형식이 올바르지 않습니다: {part}")
        opts = {}
        for opt in _split_top_level(m.group(2) or "", ";"):
            k, _, v = opt.partition("=")
            opts[k.strip()] = v.strip()
        items.append((m.group(1), opts))
    return items


def _int_opt(opts: dict, key: str, default: int) -> int:
    try:
        return int(opts.get(key, default))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{key} 값은 숫자여야 합니다")


def _order_sql(entity: str, value: str | None) -> str:
    if not value:
        # 관측값은 최신순, 나머지는 id순이 기본
        return 'e."phenomenonTime" desc, e.id desc' if entity == "Observations" else "e.id"
    allowed = ENTITIES[entity]["filterable"]
    parts = []
    for item in value.split(","):
        prop, *direction = item.split()
        if prop not in allowed:
            raise HTTPException(status_code=400, detail=f"$orderby에서 쓸 수 없는 속성입니다: {prop}")
        d = (direction[0].lower() if direction else "asc")
        if d not in ("asc", "desc"):
            raise HTTPException(status_code=400, detail="$orderby 방향은 asc 또는 desc입니다")
        parts.append(f'e."{prop}" {d}')
    return ", ".join(parts + ["e.id"])


def _with_page(link: str, top: int, skip: int) -> str:
    """요청 주소에서 $top/$skip만 바꾼 다음 페이지 주소."""
    parts = urlsplit(link)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in ("$top", "$skip")]
    query += [("$top", str(top)), ("$skip", str(skip))]
    return urlunsplit(parts._replace(query=urlencode(query, safe="$(),;'")))


def _iso(v):
    return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if isinstance(v, datetime) else v


# ---------- 조회 ----------

class _Ctx:
    def __init__(self, conn, base: str):
        self.conn = conn
        self.base = base


def _entity_json(ctx: _Ctx, entity: str, row: dict, opts: dict) -> dict:
    spec = ENTITIES[entity]
    selected = [s.strip() for s in opts["$select"].split(",")] if opts.get("$select") else None
    self_link = f"{ctx.base}/{entity}({row['id']})"
    out = {"@iot.id": row["id"], "@iot.selfLink": self_link}
    for f in spec["fields"]:
        if selected is None or f in selected:
            out[f] = _iso(row[f])
    expands = dict(_parse_expand(opts["$expand"])) if opts.get("$expand") else {}
    for nav in spec["navs"]:
        if nav in expands:
            out[nav] = _navigate(ctx, entity, row, nav, expands[nav])
        elif selected is None or nav in selected:
            out[f"{nav}@iot.navigationLink"] = f"{self_link}/{nav}"
    unknown = set(expands) - set(spec["navs"])
    if unknown:
        raise HTTPException(status_code=400, detail=f"{entity}에서 펼칠 수 없는 관계입니다: {', '.join(unknown)}")
    return out


def _query(ctx: _Ctx, entity: str, opts: dict, where: list[str] | None = None, params: dict | None = None,
           base_sql: str | None = None, single: bool = False, link: str | None = None):
    spec = ENTITIES[entity]
    params = dict(params or {})
    conds = list(where or [])
    if opts.get("$filter"):
        conds.append(_FilterParser(opts["$filter"], spec["filterable"], params, f"f{len(params)}_").parse())
    where_sql = (" where " + " and ".join(conds)) if conds else ""
    source = f"({base_sql or spec['sql']}) e"

    if single:
        row = ctx.conn.execute(text(f"select * from {source}{where_sql} limit 1"), params).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail=f"{entity}를 찾을 수 없습니다")
        return _entity_json(ctx, entity, dict(row), opts)

    top = min(max(_int_opt(opts, "$top", DEFAULT_TOP), 0), MAX_TOP)
    skip = max(_int_opt(opts, "$skip", 0), 0)
    rows = ctx.conn.execute(
        text(f"select * from {source}{where_sql} order by {_order_sql(entity, opts.get('$orderby'))} "
             f"limit {top + 1} offset {skip}"),
        params,
    ).mappings().all()
    result = {}
    if str(opts.get("$count", "false")).lower() == "true":
        result["@iot.count"] = ctx.conn.execute(text(f"select count(*) from {source}{where_sql}"), params).scalar()
    result["value"] = [_entity_json(ctx, entity, dict(r), opts) for r in rows[:top]]
    if len(rows) > top and link:
        result["@iot.nextLink"] = _with_page(link, top, skip + top)
    return result


def _navigate(ctx: _Ctx, src_entity: str, src_row: dict, nav: str, opts: dict, link: str | None = None):
    target, target_col, src_col, is_list = RELATIONS[(src_entity, nav)]
    value = src_row[src_col]
    base_sql = None
    if target == "Observations" and src_entity == "Datastreams":
        # 한 Datastream의 관측값만: 해당 항목·노드만 읽게 해서 인덱스(node_id, measured_at)를 탐
        base_sql = _observations_sql(kinds=(value % 10,), node_id_param="nav_node")
        params = {"nav_node": value // 10, "nav_value": value}
    else:
        params = {"nav_value": value}
    result = _query(ctx, target, opts, [f'e."{target_col}" = :nav_value'], params, base_sql,
                    single=not is_list, link=link)
    return result["value"] if is_list and link is None else result


_PATH = re.compile(r"^(?P<entity>[A-Za-z]+)(?:\((?P<id>\d+)\)(?:/(?P<nav>[A-Za-z]+))?)?$")


def _base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/") + "/v1.1"


@router.get("")
def service_root(request: Request):
    base = _base_url(request)
    return {
        "value": [{"name": name, "url": f"{base}/{name}"} for name in ENTITIES],
        "serverSettings": {"conformance": CONFORMANCE},
    }


@router.get("/{path:path}")
def get_resource(path: str, request: Request):
    m = _PATH.match(path.strip("/"))
    if not m or m.group("entity") not in ENTITIES:
        raise HTTPException(status_code=404, detail=f"지원하지 않는 경로입니다: {path}")
    entity, id_, nav = m.group("entity"), m.group("id"), m.group("nav")
    opts = {k: v for k, v in request.query_params.items() if k.startswith("$")}
    base = _base_url(request)
    link = str(request.url)
    with get_engine().connect() as conn:
        ctx = _Ctx(conn, base)
        if id_ is None:
            return _query(ctx, entity, opts, link=link)
        if nav is None:
            return _query(ctx, entity, opts, ['e.id = :id'], {"id": int(id_)}, single=True)
        if (entity, nav) not in RELATIONS:
            raise HTTPException(status_code=404, detail=f"{entity}에는 {nav} 관계가 없습니다")
        src = conn.execute(text(f"select * from ({ENTITIES[entity]['sql']}) e where e.id = :id"),
                           {"id": int(id_)}).mappings().first()
        if src is None:
            raise HTTPException(status_code=404, detail=f"{entity}({id_})를 찾을 수 없습니다")
        return _navigate(ctx, entity, dict(src), nav, opts, link=link)


# ---------- 관측값 등록 (수위만) ----------

def _create_observation(body: dict, datastream_id: int | None, request: Request):
    ds_id = datastream_id or (body.get("Datastream") or {}).get("@iot.id")
    if not isinstance(ds_id, int):
        raise HTTPException(status_code=400, detail='Datastream {"@iot.id": 번호}가 필요합니다')
    node_id, kind = divmod(ds_id, 10)
    if kind != 1:
        raise HTTPException(status_code=400, detail="수위 Datastream(번호 끝자리 1)에만 관측값을 등록할 수 있습니다")
    result = body.get("result")
    if not isinstance(result, (int, float)) or isinstance(result, bool):
        raise HTTPException(status_code=400, detail="result는 숫자(cm)여야 합니다")
    time = body.get("phenomenonTime")
    try:
        measured_at = datetime.fromisoformat(time.replace("Z", "+00:00")) if time else datetime.now(timezone.utc)
    except (AttributeError, ValueError):
        raise HTTPException(status_code=400, detail="phenomenonTime은 ISO 8601 시각이어야 합니다")
    with get_engine().begin() as conn:
        if conn.execute(text("select 1 from nodes where id = :id"), {"id": node_id}).first() is None:
            raise HTTPException(status_code=404, detail=f"Datastreams({ds_id})를 찾을 수 없습니다")
        log_id = conn.execute(
            text("insert into sensor_logs (node_id, inner_water_level, measured_at, raw) "
                 "values (:node_id, :level, :measured_at, cast(:raw as jsonb)) returning id"),
            {"node_id": node_id, "level": float(result), "measured_at": measured_at,
             "raw": json.dumps({"source": "sensorthings", "body": body}, ensure_ascii=False)},
        ).scalar()
        ctx = _Ctx(conn, _base_url(request))
        obs = _query(ctx, "Observations", {}, ["e.id = :id"], {"id": log_id * 10 + 1}, single=True)
    return JSONResponse(status_code=201, content=obs, headers={"Location": obs["@iot.selfLink"]})


@router.post("/Observations")
async def post_observation(request: Request):
    return _create_observation(await request.json(), None, request)


@router.post("/Datastreams({datastream_id})/Observations")
async def post_datastream_observation(datastream_id: int, request: Request):
    return _create_observation(await request.json(), datastream_id, request)
