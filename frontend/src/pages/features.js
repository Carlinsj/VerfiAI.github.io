import React from 'react';
import '../styles/features.css';
import NavigationHeader from '../components/NavigationHeader';
import logo from '../assets/logo.png';

const Features = () => {
  return (
    <>
      <NavigationHeader />
      <div className="features-container">
        <div className="about-header">
          <h1>About <span className="v-logo">V</span><span className="ai-logo">.ai</span></h1>
          <img src={logo} alt="VerifAI Logo" className="about-logo" />
        </div>

        <div className="mission-section">
          <h2>Our Mission</h2>
          <p>An open-source effort to preserve truth and integrity in academic writing through AI-powered verification.</p>
          <div className="divider-dot"></div>
        </div>

        <div className="values-section">
          <h2>How It Works</h2>
          <p>VerifAI analyzes academic references using multiple trusted databases to verify authenticity, check for retractions, and detect AI-generated content.</p>
        </div>

        <div className="features-section">
          <h2>Key Features</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Reference Verification</h3>
              <p>Cross-references citations across multiple academic databases including CrossRef, ArXiv, and Semantic Scholar to verify their existence.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🚫</div>
              <h3>Retraction Detection</h3>
              <p>Automatically flags papers that have been formally retracted, helping researchers avoid citing discredited work.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI Citation Detection</h3>
              <p>Identifies potentially fabricated references that may have been hallucinated by AI models, preserving academic integrity.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Verification Statistics</h3>
              <p>Provides comprehensive reports showing verified, unverified, and unverifiable references in your academic work.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💾</div>
              <h3>Reference Management</h3>
              <p>Save verified references to your personal library for future use in research papers and publications.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>DOI Lookup</h3>
              <p>Easily verify papers using their Digital Object Identifier (DOI) for quick and accurate reference checking.</p>
            </div>
          </div>
        </div>

        <div className="help-section">
          <h2>Who Benefits</h2>
          
          <div className="help-cards">
            <div className="help-card">
              <h3>Graduate Students</h3>
              <p>Verify your thesis citations with confidence and avoid unintentionally citing retracted or AI-generated sources.</p>
            </div>

            <div className="help-card">
              <h3>Academic Researchers</h3>
              <p>Ensure all your references are accurate and legitimate before submitting to journals, maintaining your academic credibility.</p>
            </div>

            <div className="help-card">
              <h3>Professors & Instructors</h3>
              <p>Quickly validate student work for citation accuracy and detect AI-generated content with comprehensive verification reports.</p>
            </div>
          </div>
        </div>

        <div className="technology-section">
          <h2>Our Technology</h2>
          <p>VerifAI integrates with leading academic databases and uses advanced natural language processing to deliver accurate verification results:</p>
          
          <div className="tech-list">
            <div className="tech-item">
              <span className="tech-badge">CrossRef</span>
              <p>Access to over 120 million scholarly articles and citations</p>
            </div>
            
            <div className="tech-item">
              <span className="tech-badge">ArXiv</span>
              <p>Coverage of preprint papers from physics, mathematics, computer science, and more</p>
            </div>
            
            <div className="tech-item">
              <span className="tech-badge">Semantic Scholar</span>
              <p>AI-powered semantic analysis of academic literature</p>
            </div>
            
            <div className="tech-item">
              <span className="tech-badge">Retraction Watch</span>
              <p>Database of retracted research papers across scientific disciplines</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Features;