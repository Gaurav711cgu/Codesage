import React from 'react';
import PageHeader from '../components/PageHeader';
import ResumeBullet from '../components/ResumeBullet';
import RevealSection from '../components/RevealSection';

export default function ResumePage() {
  return (
    <div>
      <PageHeader
        badge="Resume"
        badgeColor="blue"
        title="How To Present This"
        subtitle="Written for three different interview contexts."
      />
      <RevealSection>
        <ResumeBullet embedded />
      </RevealSection>
    </div>
  );
}
