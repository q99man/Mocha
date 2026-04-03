export function MotionSessionPlaceholder() {
  return (
    <section className="panel">
      <h2>카메라 세션 안내</h2>
      <p>
        이 영역은 이후 MVP 카메라 도전 흐름을 위한 자리입니다. 아직 포즈 추출, 점수 계산, 카메라 권한 처리는 추가되지
        않았습니다.
      </p>
      <div className="stat-row">
        <div className="stat-card">
          <strong>추가 예정 입력</strong>
          <p>카메라 권한 상태와 카운트다운 제어가 이곳에 들어올 예정입니다.</p>
        </div>
        <div className="stat-card">
          <strong>추가 예정 결과</strong>
          <p>프레임 샘플링, 유사도 점수, 결과 요약이 이 영역에 표시될 예정입니다.</p>
        </div>
      </div>
    </section>
  );
}
