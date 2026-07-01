import React from 'react';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import PlatformBento from './PlatformBento';
import HowItWorks from './HowItWorks';
import PhoneShowcaseSection from './PhoneShowcaseSection';
import CTASection from './CTASection';
import Footer from './Footer';
import RevealSection from './RevealSection';
import SectionTransition from './SectionTransition';

function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="landing-flow">
        <HeroSection />
        <SectionTransition variant="hero-white" />
        <RevealSection as="div" delay={0}>
          <PlatformBento />
        </RevealSection>
        <SectionTransition variant="white-soft" />
        <RevealSection as="div" delay={80}>
          <HowItWorks />
        </RevealSection>
        <SectionTransition variant="soft-white" />
        <RevealSection as="div" delay={120}>
          <PhoneShowcaseSection />
        </RevealSection>
        <SectionTransition variant="glow-pricing" />
        <RevealSection as="div" delay={160}>
          <CTASection />
        </RevealSection>
      </main>
      <Footer />
    </>
  );
}

export default LandingPage;
