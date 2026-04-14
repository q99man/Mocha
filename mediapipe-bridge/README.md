# MediaPipe Bridge

Mocha의 FastAPI 기반 MediaPipe 브리지입니다.

현재 브리지는 실제 MediaPipe Pose Landmarker 추출만 지원합니다. 계약용 stub, mock, dummy 응답 경로는 제거되었습니다.

## 실행

`C:\SpringWork\Mocha\mediapipe-bridge` 에서 실행합니다.

```powershell
.\run-bridge.ps1
```

수동 실행:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 엔드포인트

- `GET /health`
- `POST /api/v1/analyze`

## 동작 방식

- `opencv-python-headless` 와 MediaPipe Tasks API(`PoseLandmarker`)를 사용합니다.
- Spring 백엔드가 전달한 로컬 영상 경로를 읽어 landmark를 추출합니다.
- `.task` 모델 파일이 필요합니다.

기본 모델 경로:

- `C:\SpringWork\Mocha\mediapipe-bridge\models\pose_landmarker_lite.task`

환경변수로 모델 경로를 바꿀 수 있습니다.

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

## 백엔드 실행

```powershell
cd ..\backend
.\run-mediapipe-http.ps1
```
