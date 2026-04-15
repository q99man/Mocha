import { useEffect, useMemo, useState } from 'react';
import { getChallenges } from '../shared/api/challengeApi';
import { useAuth } from '../shared/auth/AuthProvider';
import type { Challenge } from '../shared/types/challenge';
import { LandingFeatureSection } from '../features/landing/LandingFeatureSection';
import { LandingFooter } from '../features/landing/LandingFooter';
import { LandingHero } from '../features/landing/LandingHero';
import { LandingShowcaseSection } from '../features/landing/LandingShowcaseSection';
import { LandingUseCaseSection } from '../features/landing/LandingUseCaseSection';
import {
  pickFeaturedChallenge,
  pickLatestScoredChallenge,
  pickShowcaseChallenges,
} from '../features/landing/landingPresentation';

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadChallenges() {
      setLoading(true);
      try {
        const response = await getChallenges().catch(() => []);
        if (active) {
          setChallenges(response);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadChallenges();
    return () => {
      active = false;
    };
  }, []);

  const readyChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady),
    [challenges],
  );
  const featuredChallenge = useMemo(() => pickFeaturedChallenge(challenges), [challenges]);
  const showcaseChallenges = useMemo(() => pickShowcaseChallenges(challenges), [challenges]);
  const latestScoredChallenge = useMemo(() => pickLatestScoredChallenge(challenges), [challenges]);

  return (
    <div className="lp-page">
      <LandingHero
        featuredChallenge={featuredChallenge}
        showcaseChallenges={showcaseChallenges}
        latestScoredChallenge={latestScoredChallenge}
        totalCount={challenges.length}
        readyCount={readyChallenges.length}
        isAuthenticated={isAuthenticated}
        loading={loading}
      />

      <main className="lp-main">
        <LandingFeatureSection />
        <LandingShowcaseSection challenges={showcaseChallenges} />
        <LandingUseCaseSection readyCount={readyChallenges.length} latestScoredChallenge={latestScoredChallenge} />
      </main>

      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}
