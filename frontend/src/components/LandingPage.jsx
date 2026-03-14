import React from 'react';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import ProblemSection from './ProblemSection';
import HowItWorks from './HowItWorks';
import FeaturesSection from './FeaturesSection';
import ProductPreview from './ProductPreview';
import CTASection from './CTASection';
import Footer from './Footer';

function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorks />
        <FeaturesSection />
        <ProductPreview />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}

export default LandingPage;
