import { useEffect, useState } from 'react'
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hourglass,
  PlusCircle,
  Star,
  Users,
  XCircle,
} from 'lucide-react'
import { api, type DashboardData } from '../../api'
import { PageHeader, StatCard, StatusBadge, Th, Td, EmptyRow } from '../../components/admin/AdminUI'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { notifyError } = useAuthErrorToast()

  useEffect(() => {
    let cancelled = false
    api
      .get<DashboardData>('/api/admin/dashboard')
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((error) => {
        if (!cancelled) notifyError(error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [notifyError])

  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Loading dashboard" />
      </div>
    )
  }

  const { totals, payments, recentAppointments } = data

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="An overview of your salon's activity." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Appointments"
          value={totals.appointments}
          icon={<CalendarDays className="h-5 w-5" />}
          accent
        />
        <StatCard label="Pending" value={totals.pending} icon={<Clock className="h-5 w-5" />} />
        <StatCard
          label="Confirmed"
          value={totals.confirmed}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard label="Completed" value={totals.completed} icon={<Star className="h-5 w-5" />} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cancelled" value={totals.cancelled} icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Customers" value={totals.customers} icon={<Users className="h-5 w-5" />} />
        <StatCard
          label="Barbers"
          value={totals.barbers}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Services"
          value={totals.services}
          icon={<PlusCircle className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue (Verified)"
          value={`₦${payments.revenue.toLocaleString()}`}
          icon={<Banknote className="h-5 w-5" />}
          accent
        />
        <StatCard
          label="Awaiting Verification"
          value={payments.pendingVerification}
          icon={<Hourglass className="h-5 w-5" />}
        />
        <StatCard label="Verified Payments" value={payments.paid} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Rejected Payments" value={payments.rejected} icon={<XCircle className="h-5 w-5" />} />
      </div>

      <div className="card-lux mt-10 overflow-hidden">
        <div className="flex items-center justify-between border-b border-night-800 px-6 py-4">
          <h2 className="font-display text-lg text-night-50">Recent Appointments</h2>
          <span className="text-xs text-night-500">Latest {recentAppointments.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-night-800 bg-night-900/60">
              <tr>
                <Th>Customer</Th>
                <Th>Service</Th>
                <Th>Barber</Th>
                <Th>When</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-night-800">
              {recentAppointments.length === 0 ? (
                <EmptyRow colSpan={5} message="No appointments yet." />
              ) : (
                recentAppointments.map((appointment) => (
                  <tr key={appointment.id} className="transition-colors hover:bg-night-900/60">
                    <Td>
                      <span className="font-semibold text-night-100">{appointment.customerName}</span>
                      <span className="block text-xs text-night-500">
                        #{appointment.referenceCode ?? appointment.id}
                      </span>
                    </Td>
                    <Td>{appointment.service?.name ?? '—'}</Td>
                    <Td>{appointment.barber?.name ?? '—'}</Td>
                    <Td>
                      {appointment.appointmentDate}
                      <span className="text-night-500"> · {appointment.appointmentTime}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={appointment.status} />
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}