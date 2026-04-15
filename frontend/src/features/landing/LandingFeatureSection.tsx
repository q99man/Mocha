const FEATURE_ITEMS = [
  {
    eyebrow: 'Feature 01',
    title: 'Pick a challenge quickly',
    body: '준비된 챌린지부터 우선 보여주고 시작 화면으로 연결합니다.',
  },
  {
    eyebrow: 'Feature 02',
    title: 'Compare with a reference',
    body: '업로드한 시도를 기준 동작과 비교해 점수와 흐름으로 정리합니다.',
  },
  {
    eyebrow: 'Feature 03',
    title: 'Retry with less friction',
    body: '다음 시도에 필요한 정보만 남기고 불필요한 설명은 줄였습니다.',
  },
];

export function LandingFeatureSection() {
  return (
    <section className="lp-section" id="feature">
      <div className="lp-section__header">
        <span className="lp-kicker">Feature</span>
        <h3>핵심 기능만 남긴 랜딩 구조.</h3>
        <p>설명보다 행동이 먼저 보이도록 기능을 다시 배열했습니다.</p>
      </div>

      <div className="lp-feature-grid">
        {FEATURE_ITEMS.map((item) => (
          <article className="lp-feature-grid__card" key={item.eyebrow}>
            <span>{item.eyebrow}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
