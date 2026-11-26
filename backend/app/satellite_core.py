"""Sentinel-1 observations, trial classification, and status chart."""
import math
from datetime import date
from pathlib import Path

import ee
import pandas as pd

VERSION = "sentinel1_vv_rule_v2_relaxed_unvalidated"
LABELS = {"flooded": "담수", "uncertain": "습윤", "drained": "낙수"}
COLUMNS = ["date", "timestamp", "scene_id", "VV_median", "VH_median",
           "valid_pixel_count", "orbit_direction", "relative_orbit"]


def validate_config(cfg):
    if not cfg.get("project") or cfg["project"].startswith("YOUR_"):
        raise ValueError("config.json의 project에 실제 Google Cloud 프로젝트 ID를 입력하세요.")
    if not 1 <= (date.fromisoformat(cfg["end"]) - date.fromisoformat(cfg["start"])).days <= 366:
        raise ValueError("start 포함, end 미포함으로 1~366일을 지정하세요.")
    for key in ("flooded_vv_max", "drained_vv_min", "speckle_radius", "scale"):
        if not isinstance(cfg[key], (int, float)) or not math.isfinite(cfg[key]):
            raise ValueError(f"{key}는 유한한 숫자여야 합니다.")
    if cfg["flooded_vv_max"] >= cfg["drained_vv_min"] or cfg["speckle_radius"] < 0 or cfg["scale"] <= 0:
        raise ValueError("담수 기준 < 낙수 기준, 필터 반경 ≥ 0, 분석 간격 > 0이어야 합니다.")


def sentinel_collection(roi, start, end):
    return (ee.ImageCollection("COPERNICUS/S1_GRD")
            .filterBounds(roi).filterDate(start, end)
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH")))


def fetch_observations(roi, cfg):
    images = sentinel_collection(roi, cfg["start"], cfg["end"]).select(["VV", "VH"]).sort("system:time_start")

    def observation(original):
        image = original.focalMedian(radius=cfg["speckle_radius"], units="meters") if cfg["speckle_radius"] else original
        stats = image.reduceRegion(
            reducer=ee.Reducer.median().combine(ee.Reducer.count(), sharedInputs=True),
            geometry=roi, scale=cfg["scale"], maxPixels=10000000)
        acquired = ee.Date(original.get("system:time_start"))
        return ee.Feature(None, {
            "date": acquired.format("YYYY-MM-dd", "Asia/Seoul"),
            "timestamp": acquired.format("YYYY-MM-dd'T'HH:mm:ss'Z'", "UTC"),
            "scene_id": original.get("system:index"),
            "VV_median": stats.get("VV_median"), "VH_median": stats.get("VH_median"),
            "valid_pixel_count": stats.get("VV_count"),
            "orbit_direction": original.get("orbitProperties_pass"),
            "relative_orbit": original.get("relativeOrbitNumber_start")})

    return ee.data.computeFeatures({"expression": ee.FeatureCollection(images.map(observation)),
                                    "fileFormat": "PANDAS_DATAFRAME"})


def classify(frame, cfg):
    frame = frame.reindex(columns=COLUMNS).copy()
    vv = pd.to_numeric(frame["VV_median"], errors="coerce")
    pixels = pd.to_numeric(frame["valid_pixel_count"], errors="coerce")
    valid = vv.map(math.isfinite) & pixels.gt(0) & pixels.map(math.isfinite)
    frame["status"], frame["status_code"] = "uncertain", 1
    frame.loc[valid & vv.le(cfg["flooded_vv_max"]), ["status", "status_code"]] = ["flooded", 0]
    frame.loc[valid & vv.ge(cfg["drained_vv_min"]), ["status", "status_code"]] = ["drained", 2]
    frame["status_ko"] = frame["status"].map(LABELS)
    frame["algorithm_version"] = VERSION
    return frame.sort_values(["timestamp", "scene_id"]).reset_index(drop=True)


def analyze_frame(geometry, cfg):
    """Analyze a GeoJSON geometry after the caller initializes Earth Engine."""
    validate_config(cfg)
    return classify(fetch_observations(ee.Geometry(geometry), cfg), cfg)


def service_account_key_credentials(email, key_file):
    from google.oauth2 import service_account

    if not email or not email.endswith(".iam.gserviceaccount.com"):
        raise ValueError("config.json의 service_account에 서비스 계정 이메일을 지정하세요.")
    if not key_file:
        raise ValueError("config.json의 service_account_key_file에 JSON 키 파일 경로를 입력하세요.")
    path = Path(key_file).expanduser()
    if not path.is_file():
        raise FileNotFoundError(f"서비스 계정 JSON 키 파일을 찾을 수 없습니다: {path}")
    credentials = service_account.Credentials.from_service_account_file(
        str(path), scopes=["https://www.googleapis.com/auth/earthengine",
                           "https://www.googleapis.com/auth/cloud-platform"])
    if credentials.service_account_email != email:
        raise ValueError("JSON 키의 client_email과 config.json의 service_account가 다릅니다.")
    return credentials


def save_chart(frame, cfg, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    times = pd.to_datetime(frame["timestamp"], utc=True)
    fig, axes = plt.subplots(2, 1, figsize=(12, 6), sharex=True)
    axes[0].plot(times, pd.to_numeric(frame["VV_median"], errors="coerce"), ".-", color="#333333", label="VV")
    axes[0].axhline(cfg["flooded_vv_max"], color="#2474ff", linestyle="--", label="Flooded threshold")
    axes[0].axhline(cfg["drained_vv_min"], color="#d8b365", linestyle="--", label="Drained threshold")
    axes[0].set_ylabel("VV median (dB)")
    axes[0].legend()
    for status, color in [("flooded", "#2474ff"), ("uncertain", "#9e9e9e"), ("drained", "#d8b365")]:
        selected = frame["status"].eq(status)
        axes[1].scatter(times[selected], frame.loc[selected, "status_code"], color=color)
    axes[1].set_yticks([0, 1, 2], ["Flooded", "Uncertain", "Drained"])
    axes[1].set_ylim(-.3, 2.3)
    for axis in axes:
        axis.grid(alpha=.2)
    fig.suptitle("Sentinel-1 VV trial rule (unvalidated)")
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)
