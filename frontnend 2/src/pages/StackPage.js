import React from 'react';
import PageHeader from '../components/PageHeader';
import TechStack from '../components/TechStack';
import RevealSection from '../components/RevealSection';

export default function StackPage() {
  return (
    <div>
      <PageHeader
        badge="Stack"
        badgeColor="blue"
        title="The Stack"
        subtitle="Every choice made for a specific reason."
      />
      <RevealSection>
        <TechStack embedded />
      </RevealSection>
    </div>
  );
}
