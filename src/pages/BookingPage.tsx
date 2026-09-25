import { useSearchParams } from 'react-router-dom'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import BookingForm from '../components/booking/BookingForm'

export default function BookingPage() {
  const [searchParams] = useSearchParams()
  const initialServiceId = searchParams.get('service')
  const initialBarberId = searchParams.get('barber')

  return (
    <PageTransition>
      <PageHero
        eyebrow="Book Appointment"
        crumb="Book Appointment"
        title="Reserve Your Chair in Seconds"
        description="Everything on one screen — service, barber and time are pre-selected. Just add your name and confirm."
        image="/images/hero.jpg"
      />

      <section id="booking-form" className="bg-night-950 py-16 md:py-20">
        <div className="container-app max-w-5xl">
          <BookingForm
            initialServiceId={initialServiceId}
            initialBarberId={initialBarberId}
          />
        </div>
      </section>
    </PageTransition>
  )
}