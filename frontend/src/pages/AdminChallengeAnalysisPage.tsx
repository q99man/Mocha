import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChallengeReferencePosePreview } from '../features/challenges/ChallengeReferencePosePreview';
import { getAdminChallengeById, getAdminChallengeReferencePreview } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

const TEXT = {
  loadError: '\uC6B4\uC601 \uBD84\uC11D \uC0C1\uC138\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
  loadingTitle: '\uBD84\uC11D \uC0C1\uC138\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4',
  loadingDescription: '\uB808\uD37C\uB7F0\uC2A4 \uBE44\uB514\uC624\uC640 \uD3EC\uC988 \uC624\uBC84\uB808\uC774 \uC815\uBCF4\uB97C \uC218\uC9D1\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.',
  errorTitle: '\uBD84\uC11D \uC0C1\uC138\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4',
  backToAdmin: '\uC6B4\uC601 \uD398\uC774\uC9C0\uB85C \uB3CC\uC544\uAC00\uAE30',
  emptyTitle: '\uCC4C\uB9B0\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4',
  emptyDescription: '\uC120\uD0DD\uD55C \uBD84\uC11D \uB300\uC0C1\uC774 \uC5C6\uAC70\uB098 \uB354 \uC774\uC0C1 \uD65C\uC131\uD654\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
  eyebrow: '운영 / 레퍼런스 분석',
  seconds: '\uCD08',
  statusLabel: '레퍼런스 상태',
  ready: '\uBD84\uC11D \uC900\uBE44 \uC644\uB8CC',
  pending: '\uBD84\uC11D \uB300\uAE30',
  readyDescription: '\uC6B4\uC601 \uAE30\uC900 \uD3EC\uC988 \uC624\uBC84\uB808\uC774\uC640 \uBD84\uC11D \uC0C1\uD0DC\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
  pendingDescription: '\uB808\uD37C\uB7F0\uC2A4 \uBD84\uC11D\uC774 \uC644\uB8CC\uB418\uBA74 \uC774 \uD654\uBA74\uC5D0\uC11C \uC624\uBC84\uB808\uC774\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
  openChallenge: '\uCC4C\uB9B0\uC9C0 \uC0C1\uC138 \uC5F4\uAE30',
};

export function AdminChallengeAnalysisPage() {
  const { id = '' } = useParams();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadChallenge() {
      setLoading(true);
      setError(null);

      try {
        const challengeResponse = await getAdminChallengeById(id);
        if (active) {
          setChallenge(challengeResponse);
        }
      } catch (loadError) {
        if (active) {
          setChallenge(null);
          setError(loadError instanceof Error ? loadError.message : TEXT.loadError);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadChallenge();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">운영</span>
          <div>
            <h2>{TEXT.loadingTitle}</h2>
            <p>{TEXT.loadingDescription}</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">오류</span>
          <div>
            <h2>{TEXT.errorTitle}</h2>
            <p>{error}</p>
          </div>
        </div>
        <Link className="button-link" to="/admin/model-assets">
          {TEXT.backToAdmin}
        </Link>
      </section>
    );
  }

  if (!challenge) {
    return (
      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">없음</span>
          <div>
            <h2>{TEXT.emptyTitle}</h2>
            <p>{TEXT.emptyDescription}</p>
          </div>
        </div>
        <Link className="button-link" to="/admin/model-assets">
          {TEXT.backToAdmin}
        </Link>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="hero hero--detail">
        <div className="hero__content">
          <span className="hero__eyebrow">{TEXT.eyebrow}</span>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>
          <div className="challenge-card__meta">
            <span className="pill">{challenge.category}</span>
            <span className="pill">{challenge.difficulty}</span>
            <span className="pill">{challenge.durationSec}{TEXT.seconds}</span>
          </div>
          <div className="signal-panel">
            <span className="signal-panel__label">{TEXT.statusLabel}</span>
            <strong>{challenge.referenceMotionProfileReady ? TEXT.ready : TEXT.pending}</strong>
            <p>
              {challenge.referenceMotionProfileReady ? TEXT.readyDescription : TEXT.pendingDescription}
            </p>
          </div>
          <div className="inline-actions">
            <Link className="button-link" to="/admin/model-assets">
              {TEXT.backToAdmin}
            </Link>
            <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
              {TEXT.openChallenge}
            </Link>
          </div>
        </div>
      </section>

      <ChallengeReferencePosePreview
        challengeId={challenge.id}
        challengeTitle={challenge.title}
        enabled={challenge.referenceMotionProfileReady}
        loadPreview={getAdminChallengeReferencePreview}
      />
    </div>
  );
}
