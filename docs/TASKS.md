# TASKS

## 완료
- [x] React + TypeScript + Vite 기반 프론트 기본 구조 구성
- [x] Spring Boot + Gradle 기반 백엔드 기본 구조 구성
- [x] Docker Compose로 MySQL/Redis 로컬 개발 환경 구성
- [x] 챌린지 목록/상세/시도 기록 기본 라우팅과 API 구성
- [x] 챌린지/시도 기본 JPA 구조와 샘플 데이터 구성
- [x] 카메라 준비 흐름과 결과 화면을 포함한 MVP 사용자 흐름 구성
- [x] 시도 수동 저장 흐름과 샘플 scoring stub 흐름 구성
- [x] scoring completion service와 prototype/manual save 경계 정리
- [x] sample scoring stub을 로컬 검증용 설정 가드와 테스트로 고정
- [x] motion session 상태를 challenge 도메인 내부 factory로 정리
- [x] 레퍼런스 비디오 업로드 기반 챌린지 생성 API 추가
- [x] 레퍼런스 비디오를 별도 실행 흐름으로 분석하는 API 추가
- [x] 시도 비디오 업로드 + mock 분석 + 자동 점수 계산 + 시도 저장 API 추가
- [x] ChallengeVideo, ChallengeMotionProfile, AttemptVideo 메타데이터 구조 추가
- [x] 로컬 파일 저장 추상화(`VideoStorageService`)와 구현(`LocalVideoStorageService`) 추가
- [x] mock 모션 분석 추상화(`MotionAnalysisService`)와 구현(`MockMotionAnalysisService`) 추가
- [x] 자동 점수 계산 서비스(`ScoringService`) 추가
- [x] multipart 업로드 검증과 공통 예외 응답 처리 추가
- [x] 챌린지 생성 -> 레퍼런스 분석 -> 시도 업로드 자동 채점 흐름 통합 테스트 추가
- [x] 프론트 도전 준비 화면에서 실제 `/api/attempts/video` 업로드 API 연결
- [x] 카메라 준비 화면, 시작 화면, 결과 화면의 깨진 한글 문구 정리
- [x] `.gitignore`에 업로드 파일, 로컬 환경 파일, 로그 등 불필요한 로컬 산출물 정리
- [x] challenge/attempt/video/profile 조회 응답을 프론트에서 쓰기 좋게 조금 더 정리

## 다음
- [ ] mock 분석 결과 요약 문구를 데모에 맞게 조금 더 읽기 쉽게 다듬기
- [ ] sample scoring stub과 실제 비디오 업로드 흐름의 역할 차이를 문서/화면에서 더 명확히 정리
- [ ] Docker Compose 기반 MySQL profile end-to-end 검증

## 이후
- [ ] Python/FastAPI + MediaPipe 기반 실제 모션 분석기로 교체
- [ ] 로컬 파일 저장을 S3 또는 외부 스토리지로 교체
- [ ] recording 단계와 motion session 상태 세분화
- [ ] 실제 결과 비교 화면과 자세 피드백 확장
- [ ] 랭킹/리더보드 캐시 고도화
