import React from 'react';
import PageHeader from '../components/PageHeader';
import MCPIntegration from '../components/MCPIntegration';
import RevealSection from '../components/RevealSection';

export default function MCPPage() {
  return (
    <div>
      <PageHeader
        badge="MCP Integration"
        badgeColor="purple"
        title="CodeSage as a Universal Tool"
        subtitle="Model Context Protocol (MCP) — introduced by Anthropic Nov 2024, 97M monthly SDK downloads. CodeSage exposes 4 tools any agent or IDE can call."
      />
      <RevealSection>
        <MCPIntegration embedded />
      </RevealSection>
    </div>
  );
}
