import React from 'react';
import PageHeader from '../components/PageHeader';
import Playground from '../components/Playground';
import RevealSection from '../components/RevealSection';

export default function PlaygroundPage() {
  return (
    <div>
      <PageHeader
        badge="Live Playground"
        badgeColor="blue"
        title="CodeSage In Action"
        subtitle="Powered by Google Gemini 2.0 Flash simulating CodeSage outputs. Production model served via vLLM — same outputs, real latency."
      />
      <RevealSection>
        <Playground embedded />
      </RevealSection>
    </div>
  );
}
