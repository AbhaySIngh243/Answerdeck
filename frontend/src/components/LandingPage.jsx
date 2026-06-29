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
      <main>
        <HeroSection />
        <RevealSection as="div">
          <PlatformBento />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <HowItWorks />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <PhoneShowcaseSection />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <CTASection />
        </RevealSection>
      </main>
      <Footer />
    </>
  );
}

export default LandingPage;
