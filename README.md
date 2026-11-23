# JBNU_Nonstop

## Sentinel-1 지도 연동

`frontend-v2`의 **위성·드론 검증 → Sentinel-1 SAR** 영역에서 등록된 필지 경계를 선택하거나 지도에 폴리곤을 직접 그릴 수 있습니다. 분석 결과 목록에서 촬영 날짜를 고르면 해당 Sentinel-1 VV 장면이 지도 위에 표시됩니다. 시작일은 포함하고 종료일은 제외하며 조회 기간은 최대 366일입니다. 이 영상은 광학 위성사진이 아닌 레이더 반사도 색상 영상입니다. 이 화면의 배경은 위성 영상이며, VWorld 키가 비어 있으면 Esri World Imagery를 사용합니다.

백엔드는 `backend/requirements.txt`를 설치한 뒤 실행합니다. 기본 설정은 `JBNU_Nonstop/config.json`에서 읽습니다. 설정 파일에는 개인키가 없으므로 Git에 포함할 수 있지만, 서비스 계정 JSON 키는 Git에 올리지 말고 다른 PC나 서버에 별도로 전달하세요. 키 파일 경로는 `config.json`의 `service_account_key_file` 또는 `EE_SERVICE_ACCOUNT_KEY_FILE` 환경 변수로 지정합니다. 설정 파일을 다른 곳에 둘 때만 `SATELLITE_CONFIG_FILE`을 지정하면 됩니다. 키 파일은 프론트엔드 환경 변수에 넣지 마세요. 프론트엔드는 기존 `VITE_API_URL`로 백엔드에 연결합니다.

API: `POST /satellite/analyze`는 `{geometry, start, end}`를 받아 관측값을 반환하고, `POST /satellite/scene`은 여기에 `scene_id`를 더 받아 일시적인 지도 타일 URL을 반환합니다.
