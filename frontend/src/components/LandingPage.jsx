import React from 'react';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import ProblemSection from './ProblemSection';
import HowItWorks from './HowItWorks';
import FeaturesSection from './FeaturesSection';
import ProductPreview from './ProductPreview';
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
        <SectionTransition />
        <RevealSection as="div">
          <ProblemSection />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <HowItWorks />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <FeaturesSection />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <ProductPreview />
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
