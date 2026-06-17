import React from 'react';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import AiAnswerSection from './AiAnswerSection';
import PlatformBento from './PlatformBento';
import ProductSuiteTabs from './ProductSuiteTabs';
import HowItWorks from './HowItWorks';
import ComparisonSection from './ComparisonSection';
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
          <AiAnswerSection />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <PlatformBento />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <ProductSuiteTabs />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <HowItWorks />
        </RevealSection>
        <SectionTransition />
        <RevealSection as="div">
          <ComparisonSection />
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
