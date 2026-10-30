import os
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise HTTPException(status_code=500, detail="DATABASE_URL is not set")
        # Supabase에서 복사한 postgresql:// 주소를 psycopg3 드라이버용으로 변환
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        # DB가 꺼져 있을 때 오래 붙잡지 않게 연결 대기 5초
        _engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})
    return _engine


def to_dict(row) -> dict:
    return {k: float(v) if isinstance(v, Decimal) else v for k, v in row._mapping.items()}
