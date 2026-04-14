# MediaPipe 어댑터 계획

이 문서는 기존 mock motion analyzer를 MediaPipe 기반 처리 경로로 교체하기 위해 남겨둔 계획 보관본입니다.

## 당시 목표

- 업로드 흐름을 깨지 않고 분석기 구현체를 교체할 수 있게 준비
- 점수 계산과 관측 흐름을 유지한 채 MediaPipe 경로 도입
- 브리지 연동과 백엔드 계약을 분리 가능한 구조로 정리

## 현재 기준

- 현재 브리지 사용 방식은 `mediapipe-bridge/README.md`와 실제 백엔드 코드가 기준입니다.
