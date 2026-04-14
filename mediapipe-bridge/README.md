# MediaPipe 브리지

이 폴더는 Mocha용 FastAPI 기반 MediaPipe 브리지 프로젝트입니다.

현재 목적은 계약 우선 방식의 실행 가능한 브리지를 제공하는 것입니다.

- Spring 백엔드가 `HttpMediaPipeBridgeClient`를 통해 바로 호출할 수 있습니다.
- 문서화된 요청/응답 형태를 유지합니다.
- `stub` 모드와 실제 `MediaPipe pose` 모드를 모두 지원합니다.

## 실행

`C:\SpringWork\Mocha\mediapipe-bridge`에서 실행합니다.

```powershell
.\run-bridge.ps1
```

수동 실행 경로:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 엔드포인트

- `GET /health`
- `POST /api/v1/analyze`

## 동작 모드

기본 모드:

- `MEDIAPIPE_BRIDGE_MODE=stub`
- 계약 형태를 유지하는 가짜 landmark 데이터를 반환합니다.

실제 추출 모드:

- `MEDIAPIPE_BRIDGE_MODE=mediapipe`
- `opencv-python-headless`와 MediaPipe Tasks API(`PoseLandmarker`)를 사용합니다.
- Spring 요청 payload에 담긴 저장 영상 경로를 읽습니다.
- `.task` 포즈 랜드마커 모델 파일이 필요합니다.

예시:

```powershell
$env:MEDIAPIPE_BRIDGE_MODE='mediapipe'
.\run-bridge.ps1
```

모델 경로:

- 기본값: `C:\SpringWork\Mocha\mediapipe-bridge\models\pose_landmarker_lite.task`
- 아래 환경 변수로 덮어쓸 수 있습니다.

```powershell
$env:MEDIAPIPE_BRIDGE_MODEL_PATH='C:\path\to\pose_landmarker_lite.task'
```

## 요청 예시

```json
{
  "schemaVersion": "v1",
  "analysisPhase": "reference",
  "sourceVideo": {
    "originalFileName": "reference.mp4",
    "storagePath": "uploads/challenges/1/reference.mp4",
    "contentType": "video/mp4",
    "size": 2483201
  },
  "runtime": {
    "timeoutMillis": 5000
  }
}
```

## Spring 백엔드 실행

FastAPI 브리지를 백엔드에서 호출하려면:

```powershell
cd ..\backend
.\run-mediapipe-http.ps1
```

## 다음 단계

`app/analysis.py`의 실제 `mediapipe` 모드를 더 단단하게 다듬되, 응답 필드는 그대로 유지하는 것이 목표입니다.

## 전체 검증 문서

- [브리지 검증 기록](../docs/archive/MEDIAPIPE_BRIDGE_VERIFICATION.md)
