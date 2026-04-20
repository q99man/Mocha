# Motion Phase Checklist

Date: 2026-04-20

## Scope

- full/heavy 모델 안정 운용
- 저품질 프레임 내성 강화
- 세그먼트별 판정/피드백 강화
- 결과 리플레이와 인사이트 정교화

## Checklist

- [x] 1. 현재 상태 리뷰와 남은 범위 정리
- [x] 2. 다음 단계용 설계 메모 작성
- [x] 3. 브리지에 `focusProfile` 메타데이터 생성 기반 추가
- [x] 4. 백엔드 스코어링에서 `focusProfile` 파싱
- [x] 5. 포즈 점수에 세그먼트/관절 가중치 반영
- [x] 6. 타이밍 점수에 세그먼트 가중치 반영
- [ ] 7. 스코어 요약/코칭 문구를 세그먼트 중심 설명으로 고도화
- [ ] 8. 타임라인 판정 서비스에서 같은 `focusProfile` 재사용
- [ ] 9. 결과 페이지 인사이트를 세그먼트/관절 중심으로 고도화
- [ ] 10. full/heavy 모델 운용 보강과 회귀 점검
- [ ] 11. 백엔드/프론트 테스트 보강

## Current Step

- 현재 진행: `7. 스코어 요약/코칭 문구를 세그먼트 중심 설명으로 고도화`
- 방금 완료: 포즈/타이밍 scoring 경로에 `focusProfile` 가중치 반영

## Notes

- `focusProfile`은 레퍼런스 프로필 JSON 안에 실려서 DB 스키마 변경 없이 재사용하는 방향으로 진행한다.
- 초기 버전은 휴리스틱 기반이며, 기존 스코어 계산을 바로 바꾸기보다 no-op fallback을 유지하면서 순차적으로 연결한다.
- 검증: `backend/gradlew.bat test --tests com.motionchallenge.scoring.application.DefaultScoringServiceTest --tests com.motionchallenge.scoring.application.DefaultScoringServiceRealAnalysisRegressionTest`
- 메모: 하체 focus 회귀는 테스트로 확인했고, 상체 focus 분리 강도는 이후 추가 튜닝 여지가 있다.
