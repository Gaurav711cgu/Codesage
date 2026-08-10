import React from 'react';
import PageHeader from '../components/PageHeader';
import TrainingPipeline from '../components/TrainingPipeline';
import RevealSection from '../components/RevealSection';

export default function TrainingPage() {
  return (
    <div>
      <PageHeader
        badge="The Training Pipeline"
        badgeColor="amber"
        title="How CodeSage Was Built"
        subtitle="Every decision is documented. Every number is real."
      />
      <RevealSection>
        <TrainingPipeline embedded />
      </RevealSection>
    </div>
  );
}
