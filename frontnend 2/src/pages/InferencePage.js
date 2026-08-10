import React from 'react';
import PageHeader from '../components/PageHeader';
import InferenceArch from '../components/InferenceArch';
import RevealSection from '../components/RevealSection';

export default function InferencePage() {
  return (
    <div>
      <PageHeader
        badge="Inference"
        badgeColor="purple"
        title="vLLM + PagedAttention"
        subtitle="Not a demo. Real throughput numbers from third-party benchmarks on the same hardware and model size."
      />
      <RevealSection>
        <InferenceArch embedded />
      </RevealSection>
    </div>
  );
}
