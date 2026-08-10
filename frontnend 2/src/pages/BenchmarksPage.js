import React from 'react';
import PageHeader from '../components/PageHeader';
import BenchmarkResults from '../components/BenchmarkResults';
import RevealSection from '../components/RevealSection';

export default function BenchmarksPage() {
  return (
    <div>
      <PageHeader
        badge="Benchmarks"
        badgeColor="green"
        title="Numbers You Can Cite"
        subtitle="All evaluations run with the same harness against held-out test sets. Base = meta-llama/Llama-3.3-8B-Instruct unmodified."
      />
      <RevealSection>
        <BenchmarkResults embedded />
      </RevealSection>
    </div>
  );
}
