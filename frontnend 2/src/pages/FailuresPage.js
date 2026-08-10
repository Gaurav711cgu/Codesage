import React from 'react';
import PageHeader from '../components/PageHeader';
import WhatBreaks from '../components/WhatBreaks';
import RevealSection from '../components/RevealSection';

export default function FailuresPage() {
  return (
    <div>
      <PageHeader
        badge="Failure Analysis"
        badgeColor="red"
        title="What Breaks in Production"
        subtitle="The section most ML portfolio projects never write. These are real failure modes discovered during training and serving."
      />
      <RevealSection>
        <WhatBreaks embedded />
      </RevealSection>
    </div>
  );
}
