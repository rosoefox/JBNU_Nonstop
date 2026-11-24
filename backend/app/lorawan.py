"""LoRaWAN 업링크 수신: 게이트웨이(RAK WisGate 내장 서버) 또는 ChirpStack의 HTTP 연동이 보내는 JSON을 sensor_logs에 저장.

센서 페이로드는 두 가지를 받음 (길이로 구분):
  ① 3바이트 이하 (Nonstop 펌웨어 lora_app.c): 바이트 0~1 = 수위(mm, 보드에서 이미 변환), 바이트 2 = 펌프 상태
  ② 7바이트 (팀원 펌웨어, 2026-11 초기화 후): 바이트 0~1 = 초음파 거리(mm, 센서~수면)
     → 서버에서 수위로 바꿈: 수위(mm) = SENSOR_TO_GROUND_MM(센서~흙 표면, 기본 350) - 거리
       관 600mm = 땅 위 350 + 땅 아래 250 → 빈 관(거리 600) = -250mm
     나머지 바이트(2~6)의 뜻은 아직 확인 전이라 펌프 상태는 저장하지 않음 (raw에 원본 보관)
  그 밖의 길이(기본 펌웨어 상태 정보 등)와 측정 실패 값은 저장하지 않고 이유만 응답
  모두 부호 있는 16비트 빅엔디언, 측정 실패 시 -999. 저장할 때는 cm로 바꿈

받는 JSON 모양이 서버마다 조금씩 달라서 아래 이름을 모두 받음:
  기기 번호: devEUI / devEui / dev_eui / deviceInfo.devEui
  데이터:   data (Base64 기본, data_encode가 hex면 16진수)
  시각:     time / rxInfo[0].time / timestamp(초·밀리초) — 없으면 받은 시각

보안: 환경변수 LORAWAN_WEBHOOK_TOKEN을 정하면 주소 뒤 ?token=값 이 맞아야 저장함.
"""
import base64
import binascii
import json
import os
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

from .db import get_engine
from .settings import experiment_mode

router = APIRouter(prefix="/lorawan", tags=["LoRaWAN 업링크 수신"])

INVALID_READING_MM = -999  # 펌웨어가 초음파 측정 실패 때 보내는 값
# 거리 형식(7바이트) 변환 기준: 센서에서 흙 표면까지 거리, 관 바닥(빈 관) 수위
SENSOR_TO_GROUND_MM = int(os.environ.get("SENSOR_TO_GROUND_MM", "350"))
LEVEL_MIN_MM = -int(os.environ.get("PIPE_BELOW_GROUND_MM", "250"))
DISTANCE_VALID_MM = (30, 4500)  # 초음파 센서 측정 범위 (A02YYUW)


def _dev_eui(body: dict) -> str:
    info = body.get("deviceInfo") if isinstance(body.get("deviceInfo"), dict) else {}
    for value in (body.get("devEUI"), body.get("devEui"), body.get("dev_eui"), info.get("devEui"), info.get("devEUI")):
        if isinstance(value, str) and value.strip():
            return re.sub(r"[\s:\-]", "", value).upper()
    return ""


def _payload(body: dict) -> bytes:
    data = body.get("data")
    if not isinstance(data, str) or not data:
        return b""
    encoding = str(body.get("data_encode") or body.get("dataEncode") or "").lower()
    if "hex" in encoding:
        return bytes.fromhex(data)
    try:
        return base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        # Base64가 아니면 16진수 문자열로 한 번 더 시도
        return bytes.fromhex(data)


def _measured_at(body: dict) -> datetime:
    candidates = [body.get("time")]
    rx = body.get("rxInfo")
    if isinstance(rx, list) and rx and isinstance(rx[0], dict):
        candidates += [rx[0].get("time"), rx[0].get("gwTime")]
    for value in candidates:
        if isinstance(value, str) and value:
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    stamp = body.get("timestamp")
    if isinstance(stamp, (int, float)) and stamp > 0:
        return datetime.fromtimestamp(stamp / 1000 if stamp > 1e12 else stamp, tz=timezone.utc)
    return datetime.now(timezone.utc)


def _is_distance_format(raw: bytes) -> bool:
    return len(raw) == 7


def _is_known_format(raw: bytes) -> bool:
    # 2~3바이트(Nonstop 펌웨어) 또는 7바이트(팀원 펌웨어). 그 밖(예: 기본 펌웨어의 15바이트 상태 정보)은 센서 값이 아님
    return 2 <= len(raw) <= 3 or _is_distance_format(raw)


def _pump_on(raw: bytes) -> bool | None:
    if _is_distance_format(raw):
        return None  # 7바이트 형식의 펌프 바이트 위치는 확인 전
    return bool(raw[2]) if len(raw) >= 3 else None


def _distance_mm(raw: bytes) -> int | None:
    if not _is_distance_format(raw):
        return None
    mm = int.from_bytes(raw[:2], byteorder="big", signed=True)
    return mm if DISTANCE_VALID_MM[0] <= mm <= DISTANCE_VALID_MM[1] else None


def _water_level_cm(raw: bytes) -> float | None:
    if len(raw) < 2:
        return None
    if _is_distance_format(raw):
        distance = _distance_mm(raw)
        if distance is None:
            return None
        # 거리 → 흙 표면 기준 수위. 관 바닥보다 아래로 잰 값(반사 등)은 빈 관으로 봄
        mm = max(LEVEL_MIN_MM, min(SENSOR_TO_GROUND_MM, SENSOR_TO_GROUND_MM - distance))
        return round(mm / 10, 1)
    mm = int.from_bytes(raw[:2], byteorder="big", signed=True)
    if mm == INVALID_READING_MM:
        return None
    return round(mm / 10, 1)


@router.post("/uplink")
async def receive_uplink(request: Request, token: str | None = None):
    """게이트웨이 HTTP 연동의 업링크 주소. 등록된 센서(DevEUI)의 수위를 저장."""
    expected = os.environ.get("LORAWAN_WEBHOOK_TOKEN", "").strip()
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="token이 맞지 않습니다")
    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="JSON 본문이 필요합니다")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="JSON 객체가 필요합니다")

    dev_eui = _dev_eui(body)
    if not dev_eui:
        raise HTTPException(status_code=400, detail="DevEUI가 없습니다")
    try:
        raw = _payload(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="data를 해석할 수 없습니다 (Base64 또는 16진수)")
    if not raw:
        # 데이터 없는 프레임(접속 확인 등)은 저장하지 않고 성공으로 응답
        return {"stored": False, "reason": "데이터 없음", "dev_eui": dev_eui}

    if not _is_known_format(raw):
        return {"stored": False, "reason": f"수위 데이터 형식이 아님 ({len(raw)}바이트)", "dev_eui": dev_eui,
                "payload_hex": raw.hex()}
    level = _water_level_cm(raw)
    if level is None:
        # 측정 실패(-999)나 범위 밖 거리: 수위 칸은 비울 수 없어서 저장하지 않음
        return {"stored": False, "reason": "센서 측정 실패 값", "dev_eui": dev_eui, "payload_hex": raw.hex()}
    pump_on = _pump_on(raw)
    measured_at = _measured_at(body)
    with get_engine().begin() as conn:
        node_id = conn.execute(
            text("select id from nodes where upper(dev_eui) = :dev_eui "
                 "order by (is_experiment = :exp) desc, id desc limit 1"),
            {"dev_eui": dev_eui, "exp": experiment_mode()},
        ).scalar()
        if node_id is None:
            # 게이트웨이가 같은 데이터를 계속 다시 보내지 않게 200으로 응답하고 이유만 알림
            return {"stored": False, "reason": "등록되지 않은 센서 (웹 관리 페이지에서 DevEUI 등록 필요)", "dev_eui": dev_eui}
        log_id = conn.execute(
            text("insert into sensor_logs (node_id, inner_water_level, pump_on, measured_at, raw, is_experiment) "
                 "values (:node_id, :level, :pump_on, :measured_at, cast(:raw as jsonb), :exp) returning id"),
            {"node_id": node_id, "level": level, "pump_on": pump_on, "measured_at": measured_at,
             "exp": experiment_mode(),
             "raw": json.dumps({"source": "lorawan", "payload_hex": raw.hex(), "distance_mm": _distance_mm(raw),
                                "sensor_to_ground_mm": SENSOR_TO_GROUND_MM if _is_distance_format(raw) else None,
                                "body": body}, ensure_ascii=False)},
        ).scalar()
    return {"stored": True, "id": log_id, "node_id": node_id, "inner_water_level": level, "pump_on": pump_on,
            "measured_at": measured_at.isoformat(), "valid_reading": level is not None}
