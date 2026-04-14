# MediaPipe 브리지 검증

이 문서는 Spring 백엔드가 인프로세스 스텁이 아니라 실제 HTTP MediaPipe 브리지 경로를 타는지 검증하던 보관 문서입니다.

## 당시 검증 포인트

- FastAPI 브리지가 정상 기동되는지
- 백엔드가 HTTP 클라이언트 경로를 사용하는지
- 기준 영상 분석과 시도 업로드가 브리지 응답 형태와 맞는지
- 모델 파일 경로와 브리지 모드 전환이 정상인지

## 현재 기준

- 현재 브리지 실행과 사용 방법은 [../../mediapipe-bridge/README.md](../../mediapipe-bridge/README.md)를 우선해서 봐야 합니다.
