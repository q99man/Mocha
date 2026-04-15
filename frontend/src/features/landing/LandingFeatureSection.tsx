const FEATURE_ITEMS = [
  {
    eyebrow: 'Feature 01',
    title: '챌린지를 바로 고른다',
  },
  {
    eyebrow: 'Feature 02',
    title: '기준 동작과 비교한다',
  },
  {
    eyebrow: 'Feature 03',
    title: '덜 막히게 다시 시도한다',
  },
];

export function LandingFeatureSection() {
  return (
    <section className="lp-section" id="feature">
      <div className="lp-section__header">
        <span className="lp-kicker">Feature</span>
        <h3>짧고 선명한 모션 연습 흐름.</h3>
      </div>

      <div className="lp-feature-grid">
        {FEATURE_ITEMS.map((item) => (
          <article className="lp-feature-grid__card" key={item.eyebrow}>
            <span>{item.eyebrow}</span>
            <strong>{item.title}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
