"""Sentinel-1 analysis and map tiles for a browser-selected field."""
import base64
import json
import os
from datetime import date
from io import BytesIO
from pathlib import Path

import ee
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from . import satellite_core

router = APIRouter(prefix="/satellite", tags=["satellite"])


class Selection(BaseModel):
    geometry: dict
    start: date
    end: date

    @model_validator(mode="after")
    def validate_selection(self):
        if not 1 <= (self.end - self.start).days <= 366:
            raise ValueError("조회 기간은 1~366일이어야 합니다 (종료일 제외).")
        geo = self.geometry
        if geo.get("type") != "Polygon" or not isinstance(geo.get("coordinates"), list):
            raise ValueError("GeoJSON Polygon 경계가 필요합니다.")
        rings = geo["coordinates"]
        if len(rings) != 1 or not isinstance(rings[0], list) or not 4 <= len(rings[0]) <= 201:
            raise ValueError("구멍 없는 3~200개 꼭짓점의 Polygon을 지정하세요.")
        ring = rings[0]
        for p in ring:
            if (not isinstance(p, list) or len(p) != 2 or
                not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in p) or
                not -180 <= p[0] <= 180 or not -90 <= p[1] <= 90):
                raise ValueError("경계 좌표는 [경도, 위도] 형식이어야 합니다.")
        if ring[0] != ring[-1] or len({tuple(p) for p in ring}) < 3:
            raise ValueError("경계의 시작점과 끝점이 같아야 합니다.")
        return self


class SceneSelection(Selection):
    scene_id: str = Field(min_length=1, max_length=160)


def settings():
    # By default, read the local configuration from the JBNU_Nonstop root.
    default = Path(__file__).resolve().parents[2] / "config.json"
    path = Path(os.environ.get("SATELLITE_CONFIG_FILE", default)).expanduser().resolve()
    if not path.is_file():
        raise HTTPException(503, "SATELLITE_CONFIG_FILE 경로에 분석 설정 파일이 없습니다.")
    cfg = json.loads(path.read_text(encoding="utf-8-sig"))
    key = os.environ.get("EE_SERVICE_ACCOUNT_KEY_FILE", cfg.get("service_account_key_file", ""))
    key_path = Path(key).expanduser()
    if not key_path.is_absolute():
        key_path = path.parent / key_path
    return cfg, key_path


def initialize():
    cfg, key_path = settings()
    try:
        credentials = satellite_core.service_account_key_credentials(cfg["service_account"], str(key_path))
        ee.Initialize(credentials=credentials, project=cfg["project"])
    except (FileNotFoundError, KeyError, ValueError) as exc:
        raise HTTPException(503, f"Earth Engine 서비스 계정 설정 오류: {exc}") from exc
    return cfg


@router.post("/analyze")
def analyze(body: Selection):
    cfg = initialize()
    cfg = {**cfg, "start": body.start.isoformat(), "end": body.end.isoformat()}
    try:
        frame = satellite_core.analyze_frame(body.geometry, cfg)
        observations = json.loads(frame.to_json(orient="records"))
        chart_url = None
        if observations:
            chart = BytesIO()
            satellite_core.save_chart(frame, cfg, chart)
            chart_url = "data:image/png;base64," + base64.b64encode(chart.getvalue()).decode("ascii")
        return {"observations": observations, "chart_url": chart_url,
                "algorithm_version": satellite_core.VERSION}
    except Exception as exc:
        raise HTTPException(502, f"Sentinel-1 분석 실패: {exc}") from exc


@router.post("/scene")
def scene(body: SceneSelection):
    cfg = initialize()
    roi = ee.Geometry(body.geometry)
    images = satellite_core.sentinel_collection(roi, body.start.isoformat(), body.end.isoformat())
    images = images.filter(ee.Filter.eq("system:index", body.scene_id))
    try:
        if images.size().getInfo() == 0:
            raise HTTPException(404, "선택한 기간과 경계에 해당 영상이 없습니다.")
        image = ee.Image(images.first())
        if cfg.get("speckle_radius", 0):
            image = image.focalMedian(radius=cfg["speckle_radius"], units="meters")
        image = image.select("VV").clip(roi)
        tile_url = image.getMapId({"min": -22, "max": -5,
                                   "palette": ["142b5c", "2474ff", "e1d6a6", "b98943"]})["tile_fetcher"].url_format
        return {"tile_url": tile_url, "scene_id": body.scene_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Sentinel-1 영상 생성 실패: {exc}") from exc
