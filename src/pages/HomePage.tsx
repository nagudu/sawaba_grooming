import PageTransition from '../components/ui/PageTransition'
import HeroSection from '../components/home/HeroSection'
import StoriesRail from '../components/stories/StoriesRail'
import AboutPreview from '../components/home/AboutPreview'
import FeaturedServices from '../components/home/FeaturedServices'
import WhyChooseUs from '../components/home/WhyChooseUs'
import FeaturedBarbers from '../components/home/FeaturedBarbers'
import GalleryPreview from '../components/home/GalleryPreview'
import TestimonialsSection from '../components/home/TestimonialsSection'
import CTASection from '../components/home/CTASection'

export default function HomePage() {
  return (
    <PageTransition>
      <HeroSection />
      <StoriesRail />
      <AboutPreview />
      <FeaturedServices />
      <WhyChooseUs />
      <FeaturedBarbers />
      <GalleryPreview />
      <TestimonialsSection />
      <CTASection />
    </PageTransition>
  )
}