import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api, buildQuery, toForm, type BarberItem, type Paged, type ServiceItem } from '../../api'
import {
  ConfirmDialog,
  EmptyRow,
  Field,
  PageHeader,
  Td,
  Th,
} from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useToast } from '../../components/ui/ToastNotification'
import { useDebounced } from '../../hooks/useDebounced'
import { cn } from '../../utils/cn'

interface BarberForm {
  name: string
  imageUrl: string
  specialty: string
  biography: string
  experience: string
  isActive: boolean
  serviceIds: string[]
}

const EMPTY_FORM: BarberForm = {
  name: '',
  imageUrl: '',
  specialty: '',
  biography: '',
  experience: '0',
  isActive: true,
  serviceIds: [],
}

export default function AdminBarbersPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [barbers, setBarbers] = useState<BarberItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<BarberItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<BarberForm>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<BarberItem | null>(null)
  const [busy, setBusy] = useState(false)

  const perPage = 12
  const debouncedSearch = useDebounced(search.trim(), 300)

  const load = async (targetPage = page, query = search) => {
    setLoading(true)
    try {
      const data = await api.get<Paged<BarberItem>>(
        `/api/barbers${buildQuery({ page: targetPage, perPage, search: query || undefined, includeInactive: 'true' })}`,
      )
      setBarbers(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  const loadServices = async () => {
    try {
      const data = await api.get<Paged<ServiceItem>>('/api/services?page=1&perPage=100')
      setServices(data.items)
    } catch {
      setServices([])
    }
  }

  useEffect(() => {
    void load(1, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    void loadServices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setFormOpen(true)
  }

  const openEdit = (barber: BarberItem) => {
    setEditing(barber)
    setForm({
      name: barber.name,
      imageUrl: barber.image ?? '',
      specialty: barber.specialty ?? '',
      biography: barber.biography ?? '',
      experience: String(barber.experience),
      isActive: barber.isActive,
      serviceIds: (barber.services ?? []).map((service) => String(service.id)),
    })
    setImageFile(null)
    setFormOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        image: imageFile ? undefined : form.imageUrl.trim() || undefined,
        specialty: form.specialty.trim() || undefined,
        biography: form.biography.trim() || undefined,
        experience: Number(form.experience),
        isActive: form.isActive,
        serviceIds: form.serviceIds.map(Number),
      }

      const useMultipart = imageFile !== null
      if (imageFile) payload.image = imageFile

      if (editing) {
        await api.put(`/api/barbers/${editing.id}`, useMultipart ? toForm(payload) : payload, useMultipart)
        showToast('Barber updated.')
      } else {
        await api.post('/api/barbers', useMultipart ? toForm(payload) : payload, useMultipart)
        showToast('Barber created.')
      }
      setFormOpen(false)
      await load(editing ? page : 1)
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      const result = await api.del<{ deactivated: boolean; appointmentCount?: number }>(
        `/api/barbers/${deleting.id}`,
      )
      if (result.deactivated) {
        // Historic appointments pin the barber — they were deactivated instead.
        setBarbers((items) =>
          items.map((item) => (item.id === deleting.id ? { ...item, isActive: false } : item)),
        )
        showToast(
          `${deleting.name} has appointments on record and was deactivated instead of deleted — their history stays intact.`,
          'info',
        )
      } else {
        setBarbers((items) => items.filter((item) => item.id !== deleting.id))
        setTotal((count) => count - 1)
        showToast('Barber deleted.')
      }
      setDeleting(null)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (barber: BarberItem) => {
    try {
      const updated = await api.put<BarberItem>(`/api/barbers/${barber.id}`, {
        isActive: !barber.isActive,
      })
      setBarbers((items) => items.map((item) => (item.id === barber.id ? updated : item)))
      showToast(updated.isActive ? 'Barber is now active.' : 'Barber is now inactive.')
    } catch (error) {
      notifyError(error)
    }
  }

  const toggleService = (serviceId: string) => {
    setForm((current) => ({
      ...current,
      serviceIds: current.serviceIds.includes(serviceId)
        ? current.serviceIds.filter((id) => id !== serviceId)
        : [...current.serviceIds, serviceId],
    }))
  }

  return (
    <div>
      <PageHeader
        title="Barbers"
        subtitle="Manage your team and the services each barber provides."
        action={
          <Button variant="gold" size="md" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Barber
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="field-icon h-4 w-4" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void load(1, event.currentTarget.value)
            }}
            placeholder="Search barbers..."
            className="field pl-11"
          />
        </div>
      </div>

      <div className="card-lux overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading barbers" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Barber</Th>
                  <Th>Specialty</Th>
                  <Th>Experience</Th>
                  <Th>Services</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {barbers.length === 0 ? (
                  <EmptyRow colSpan={6} message="No barbers found." />
                ) : (
                  barbers.map((barber) => (
                    <tr key={barber.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <div className="flex items-center gap-3">
                          {barber.image ? (
                            <img
                              src={barber.image}
                              alt=""
                              className="h-11 w-11 rounded-full border border-night-700 object-cover"
                            />
                          ) : (
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-night-700 bg-night-900 text-sm font-bold text-gold-400">
                              {barber.name.charAt(0)}
                            </span>
                          )}
                          <div>
                            <p className="font-semibold text-night-100">{barber.name}</p>
                            <p className="text-xs text-night-500">{barber.slug}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>{barber.specialty ?? '—'}</Td>
                      <Td>{barber.experience} yrs</Td>
                      <Td>
                        <span className="max-w-[200px] truncate text-xs text-night-400">
                          {(barber.services ?? []).map((service) => service.name).join(', ') || '—'}
                        </span>
                      </Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => void toggleActive(barber)}
                          className={cn(
                            'inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors',
                            barber.isActive
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-night-600 bg-night-800 text-night-400 hover:border-gold-500/40 hover:text-gold-300',
                          )}
                        >
                          {barber.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(barber)}
                            aria-label="Edit barber"
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(barber)}
                            aria-label="Delete barber"
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-night-800 bg-night-900/40 px-6 py-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
              Previous
            </Button>
            <span className="px-2 text-sm text-night-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => void load(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Barber' : 'New Barber'}
        size="lg"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name">
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="field"
                placeholder="Ibrahim Musa"
              />
            </Field>
            <Field label="Specialty" hint="Displayed under the barber's name.">
              <input
                value={form.specialty}
                onChange={(event) => setForm({ ...form, specialty: event.target.value })}
                className="field"
                placeholder="Master Barber"
              />
            </Field>
            <Field label="Experience (years)">
              <input
                type="number"
                min="0"
                value={form.experience}
                onChange={(event) => setForm({ ...form, experience: event.target.value })}
                className="field"
              />
            </Field>
          </div>

          <Field label="Biography">
            <textarea
              rows={3}
              value={form.biography}
              onChange={(event) => setForm({ ...form, biography: event.target.value })}
              className="field resize-none"
              placeholder="About this barber..."
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
              Portrait
            </span>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-night-600 bg-night-900 p-4 transition-colors hover:border-gold-500/50',
                imageFile && 'border-gold-500/60',
              )}
            >
              <ImagePlus className="h-5 w-5 shrink-0 text-gold-400" />
              <span className="truncate text-sm text-night-300">
                {imageFile
                  ? imageFile.name
                  : form.imageUrl
                    ? form.imageUrl
                    : 'Choose a file or paste an image URL below'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <input
              value={form.imageUrl}
              onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              className="field mt-3"
              placeholder="https://.../portrait.jpg (optional when a file is chosen)"
            />
          </div>

          {services.length > 0 && (
            <div>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                Services this barber offers
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((service) => (
                  <label
                    key={service.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors',
                      form.serviceIds.includes(String(service.id))
                        ? 'border-gold-500/50 bg-gold-500/10'
                        : 'border-night-700 bg-night-900 hover:border-night-500',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.serviceIds.includes(String(service.id))}
                      onChange={() => toggleService(String(service.id))}
                      className="h-4 w-4 accent-gold-500"
                    />
                    <span className="truncate text-sm text-night-200">
                      {service.name}
                      <span className="text-night-500"> · ₦{service.price.toLocaleString()}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              className="h-4 w-4 accent-gold-500"
            />
            <span className="text-sm text-night-300">Active (visible on the website)</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="md" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="gold" size="md" type="submit" loading={saving}>
              {editing ? 'Save Changes' : 'Create Barber'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete barber"
        description={`Remove "${deleting?.name ?? ''}" from your team? Barbers with past appointments are deactivated instead, so booking history stays intact. This cannot be undone.`}
      />
    </div>
  )
}