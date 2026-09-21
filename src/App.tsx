import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/ui/ToastNotification'
import { AdminAuthProvider } from './store/adminAuth'
import { CustomerAuthProvider } from './store/customerAuth'
import OfflineIndicator from './components/ui/OfflineIndicator'
import { getCustomerToken } from './api/account'
import { getAdminToken } from './api'

// ── Public pages ───────────────────────────────────────────────────────────────
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import ServicesPage from './pages/ServicesPage'
import ServiceDetailsPage from './pages/ServiceDetailsPage'
import BarbersPage from './pages/BarbersPage'
import BarberProfilePage from './pages/BarberProfilePage'
import GalleryPage from './pages/GalleryPage'
import ReviewsPage from './pages/ReviewsPage'
import PricingPage from './pages/PricingPage'
import BookingPage from './pages/BookingPage'
import PaymentPage from './pages/PaymentPage'
import ReceiptPage from './pages/ReceiptPage'
import PaymentHistoryPage from './pages/PaymentHistoryPage'
import PaystackCallbackPage from './pages/PaystackCallbackPage'
import ContactPage from './pages/ContactPage'
import NotFoundPage from './pages/NotFoundPage'

// ── Customer account ───────────────────────────────────────────────────────────
import AccountLayout from './components/account/AccountLayout'
import CustomerLoginPage from './pages/account/CustomerLoginPage'
import CustomerDashboardPage from './pages/account/CustomerDashboardPage'
import CustomerAppointmentsPage from './pages/account/CustomerAppointmentsPage'
import CustomerBookingDetailPage from './pages/account/CustomerBookingDetailPage'
import CustomerPaymentsPage from './pages/account/CustomerPaymentsPage'
import CustomerProfilePage from './pages/account/CustomerProfilePage'

// ── Admin ──────────────────────────────────────────────────────────────────────
import AdminLayout from './pages/admin/AdminLayout'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage'
import AdminServicesPage from './pages/admin/AdminServicesPage'
import AdminBarbersPage from './pages/admin/AdminBarbersPage'
import AdminBarberEarningsPage from './pages/admin/AdminBarberEarningsPage'
import AdminGalleryPage from './pages/admin/AdminGalleryPage'
import AdminReviewsPage from './pages/admin/AdminReviewsPage'
import AdminContactsPage from './pages/admin/AdminContactsPage'
import AdminCustomersPage from './pages/admin/AdminCustomersPage'
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage'
import AdminPaymentSettingsPage from './pages/admin/AdminPaymentSettingsPage'
import AdminAppearancePage from './pages/admin/AdminAppearancePage'

// ─── Guards ───────────────────────────────────────────────────────────────────

function RequireCustomer({ children }: { children: React.ReactNode }) {
  if (!getCustomerToken()) {
    return (
      <Navigate
        to="/account/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}

// ─── Public / marketing routes (wrapped in the site Layout) ──────────────────

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:id" element={<ServiceDetailsPage />} />
        <Route path="/barbers" element={<BarbersPage />} />
        <Route path="/barbers/:id" element={<BarberProfilePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/pay/:token" element={<PaymentPage />} />
        <Route path="/receipt/:token" element={<ReceiptPage />} />
        <Route path="/payments" element={<PaymentHistoryPage />} />
        <Route path="/payments/callback" element={<PaystackCallbackPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  )
}

// ─── Customer account routes (AccountLayout provides sidebar + chrome) ────────

function CustomerAccountRoutes() {
  return (
    <Routes>
      {/* Login — no sidebar */}
      <Route path="/account/login" element={<CustomerLoginPage />} />

      {/* Protected account section — AccountLayout renders the sidebar + Outlet */}
      <Route
        path="/account"
        element={
          <RequireCustomer>
            <AccountLayout />
          </RequireCustomer>
        }
      >
        <Route index element={<CustomerDashboardPage />} />
        <Route path="bookings" element={<CustomerAppointmentsPage />} />
        <Route path="bookings/:id" element={<CustomerBookingDetailPage />} />
        <Route path="payments" element={<CustomerPaymentsPage />} />
        <Route path="profile" element={<CustomerProfilePage />} />

        {/* Keep old /account/appointments URL working */}
        <Route path="appointments" element={<Navigate to="/account/bookings" replace />} />
      </Route>
    </Routes>
  )
}

// ─── Admin routes (AdminLayout provides its own sidebar + chrome) ─────────────

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="appointments" element={<AdminAppointmentsPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="payment-settings" element={<AdminPaymentSettingsPage />} />
        <Route path="appearance" element={<AdminAppearancePage />} />
        <Route path="services" element={<AdminServicesPage />} />
        <Route path="barbers" element={<AdminBarbersPage />} />
        <Route path="barber-earnings" element={<AdminBarberEarningsPage />} />
        <Route path="gallery" element={<AdminGalleryPage />} />
        <Route path="reviews" element={<AdminReviewsPage />} />
        <Route path="contacts" element={<AdminContactsPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// ─── Top-level router — dispatch by path prefix ───────────────────────────────

function AppRoutes() {
  const location = useLocation()

  if (location.pathname.startsWith('/admin')) {
    return <AdminRoutes />
  }

  if (location.pathname.startsWith('/account')) {
    return <CustomerAccountRoutes />
  }

  return (
    <Layout>
      <AnimatedRoutes />
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AdminAuthProvider>
          <CustomerAuthProvider>
            <AppRoutes />
            <OfflineIndicator />
          </CustomerAuthProvider>
        </AdminAuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
