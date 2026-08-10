import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageMeta } from './components/PageMeta';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import PlaygroundPage from './pages/PlaygroundPage';
import TrainingPage from './pages/TrainingPage';
import BenchmarksPage from './pages/BenchmarksPage';
import InferencePage from './pages/InferencePage';
import FailuresPage from './pages/FailuresPage';
import MCPPage from './pages/MCPPage';
import StackPage from './pages/StackPage';
import ResumePage from './pages/ResumePage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="cs-noise" style={{ minHeight: '100vh', background: 'var(--cs-bg)' }}>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <PageMeta />
          <Nav />
          <ScrollToTop />
          <main id="main-content" role="main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/training" element={<TrainingPage />} />
              <Route path="/benchmarks" element={<BenchmarksPage />} />
              <Route path="/inference" element={<InferencePage />} />
              <Route path="/failures" element={<FailuresPage />} />
              <Route path="/mcp" element={<MCPPage />} />
              <Route path="/stack" element={<StackPage />} />
              <Route path="/resume" element={<ResumePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
