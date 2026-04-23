import { useEffect, useMemo, useState } from 'react';
import { getChallenges } from '../shared/api/challengeApi';
import { getRecentReviews } from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import type { Challenge } from '../shared/types/challenge';
import type { Review } from '../shared/types/review';
import { LandingFooter } from '../features/landing/LandingFooter';
import { LandingHero } from '../features/landing/LandingHero';
import { LandingShowcaseSection } from '../features/landing/LandingShowcaseSection';
import { LandingUseCaseSection } from '../features/landing/LandingUseCaseSection';
import { pickShowcaseChallenges } from '../features/landing/landingPresentation';

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let active = true;

    async function loadLandingData() {
      const [challengeResponse, reviewResponse] = await Promise.all([
        getChallenges().catch(() => []),
        getRecentReviews(6).catch(() => []),
      ]);

      if (active) {
        setChallenges(challengeResponse);
        setReviews(reviewResponse);
      }
    }

    void loadLandingData();
    return () => {
      active = false;
    };
  }, []);

  const showcaseChallenges = useMemo(() => pickShowcaseChallenges(challenges), [challenges]);
  return (
    <div className="lp-page">
      <LandingHero isAuthenticated={isAuthenticated} />

      <main className="lp-main">
        <LandingShowcaseSection challenges={showcaseChallenges} />
        <LandingUseCaseSection reviews={reviews} />
      </main>

      <LandingFooter />
    </div>
  );
}
