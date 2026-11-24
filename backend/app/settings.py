"""서버 설정 (웹에서 바꾸는 값). 지금은 실험 모드 하나.

실험 모드: 2시간짜리 짧은 실험에서 알람과 가동률을 확인하려고 판정 시간을 줄임.
  평소   — 수위 알람 6시간 지속, 통신 끊김 30분, 가동률 기준 10분 주기
  실험   — 수위 알람 10분 지속, 통신 끊김 10분, 가동률 기준 1분 주기

값은 DB 표 app_settings에 저장하고, 표가 없거나 DB를 못 읽으면 환경변수 EXPERIMENT_MODE(없으면 평소)를 씀.
  create table if not exists app_settings (
    key text primary key, value jsonb not null, updated_at timestamptz not null default now());
"""
import json
import os
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from .db import get_engine

router = APIRouter(prefix="/settings", tags=["설정"])

NORMAL_RULES = {"sustained_minutes": 6 * 60, "comm_lost_minutes": 30, "expected_uplink_minutes": 10}
EXPERIMENT_RULES = {"sustained_minutes": 10, "comm_lost_minutes": 10, "expected_uplink_minutes": 1}

_CACHE_SECONDS = 5  # 요청마다 DB를 읽지 않게 잠깐 기억
_cache: dict = {"at": 0.0, "value": None}


def _env_default() -> bool:
    return os.environ.get("EXPERIMENT_MODE", "").strip().lower() in ("1", "true", "on", "yes")


def experiment_mode() -> bool:
    now = time.monotonic()
    if _cache["value"] is not None and now - _cache["at"] < _CACHE_SECONDS:
        return _cache["value"]
    try:
        with get_engine().connect() as conn:
            value = conn.execute(text("select value from app_settings where key = 'experiment_mode'")).scalar()
        mode = bool(value) if value is not None else _env_default()
    except DBAPIError:
        mode = _env_default()  # 표가 아직 없을 때
    _cache.update(at=now, value=mode)
    return mode


def alert_rules() -> dict:
    mode = experiment_mode()
    rules = dict(EXPERIMENT_RULES if mode else NORMAL_RULES)
    minutes = rules["sustained_minutes"]
    rules["sustained_label"] = f"{minutes // 60}시간" if minutes % 60 == 0 else f"{minutes}분"
    rules["experiment_mode"] = mode
    return rules


class ExperimentModeBody(BaseModel):
    enabled: bool


@router.get("/experiment-mode")
def get_experiment_mode():
    """현재 모드와 알람 판정 기준."""
    return alert_rules()


@router.put("/experiment-mode")
def set_experiment_mode(body: ExperimentModeBody):
    """실험 모드 켜기/끄기 (웹 왼쪽 메뉴 버튼)."""
    try:
        with get_engine().begin() as conn:
            conn.execute(
                text("insert into app_settings (key, value, updated_at) values ('experiment_mode', cast(:v as jsonb), now()) "
                     "on conflict (key) do update set value = excluded.value, updated_at = now()"),
                {"v": json.dumps(body.enabled)},
            )
    except DBAPIError as e:
        raise HTTPException(status_code=503, detail="설정을 저장하지 못했어요 (app_settings 표가 있는지 확인)") from e
    _cache.update(at=0.0, value=None)
    return alert_rules()
