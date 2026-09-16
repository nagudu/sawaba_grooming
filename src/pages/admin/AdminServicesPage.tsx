import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api, buildQuery, toForm, type Paged, type ServiceItem } from '../../api'
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

const CATEGORIES: Array<{ label: string; value: string }> = [
  { label: 'Haircuts', value: 'HAIRCUTS' },
  { label: 'Beards', value: 'BEARDS' },
  { label: 'Hair & Beard', value: 'HAIR_AND_BEARD' },
  { label: 'Grooming', value: 'GROOMING' },
  { label: 'Kids', value: 'KIDS' },
  { label: 'Treatments', value: 'TREATMENTS' },
  { label: 'Styling', value: 'STYLING' },
]

interface ServiceForm {
  name: string
  description: string
  price: string
  duration: string
  category: string
  imageUrl: string
  isActive: boolean
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  price: '',
  duration: '30',
  category: 'HAIRCUTS',
  imageUrl: '',
  isActive: true,
}

export default function AdminServicesPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [services, setServices] = useState<ServiceItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ServiceItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<ServiceItem | null>(null)
  const [busy, setBusy] = useState(false)

  const perPage = 12
  const debouncedSearch = useDebounced(search.trim(), 300)

  const load = async (targetPage = page, query = search) => {
    setLoading(true)
    try {
      const data = await api.get<Paged<ServiceItem>>(
        `/api/services${buildQuery({ page: targetPage, perPage, search: query || undefined })}`,
      )
      setServices(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setFormOpen(true)
  }

  const openEdit = (service: ServiceItem) => {
    setEditing(service)
    setForm({
      name: service.name,
      description: service.description ?? '',
      price: String(service.price),
      duration: String(service.duration),
      category: service.category,
      imageUrl: service.image ?? '',
      isActive: service.isActive,
    })
    setImageFile(null)
    setFormOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        duration: Number(form.duration),
        category: form.category,
        isActive: form.isActive,
      }

      const useMultipart = imageFile !== null
      if (imageFile) {
        payload.image = imageFile
      } else if (form.imageUrl.trim()) {
        payload.image = form.imageUrl.trim()
      }

      if (editing) {
        await api.put(`/api/services/${editing.id}`, useMultipart ? toForm(payload) : payload, useMultipart)
        showToast('Service updated.')
      } else {
        await api.post('/api/services', useMultipart ? toForm(payload) : payload, useMultipart)
        showToast('Service created.')
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
      await api.del(`/api/services/${deleting.id}`)
      setServices((items) => items.filter((item) => item.id !== deleting.id))
      setTotal((count) => count - 1)
      showToast('Service deleted.')
      setDeleting(null)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (service: ServiceItem) => {
    try {
      const updated = await api.put<ServiceItem>(`/api/services/${service.id}`, {
        isActive: !service.isActive,
      })
      setServices((items) => items.map((item) => (item.id === service.id ? updated : item)))
      showToast(updated.isActive ? 'Service is now active.' : 'Service is now inactive.')
    } catch (error) {
      notifyError(error)
    }
  }

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Create and manage the services you offer."
        action={
          <Button variant="gold" size="md" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Service
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
            placeholder="Search services..."
            className="field pl-11"
          />
        </div>
      </div>

      <div className="card-lux overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading services" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Service</Th>
                  <Th>Category</Th>
                  <Th>Price</Th>
                  <Th>Duration</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {services.length === 0 ? (
                  <EmptyRow colSpan={6} message="No services found." />
                ) : (
                  services.map((service) => (
                    <tr key={service.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <div className="flex items-center gap-3">
                          {service.image ? (
                            <img
                              src={service.image}
                              alt=""
                              className="h-11 w-11 rounded-lg border border-night-700 object-cover"
                            />
                          ) : (
                            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-night-700 bg-night-900 text-[10px] font-bold uppercase text-night-500">
                              {service.name.slice(0, 2)}
                            </span>
                          )}
                          <div>
                            <p className="font-semibold text-night-100">{service.name}</p>
                            <p className="text-xs text-night-500">{service.slug}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>{service.category}</Td>
                      <Td className="font-semibold text-gold-300">₦{service.price.toLocaleString()}</Td>
                      <Td>{service.duration} min</Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => void toggleActive(service)}
                          className={cn(
                            'inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors',
                            service.isActive
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-night-600 bg-night-800 text-night-400 hover:border-gold-500/40 hover:text-gold-300',
                          )}
                        >
                          {service.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(service)}
                            aria-label="Edit service"
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(service)}
                            aria-label="Delete service"
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
        title={editing ? 'Edit Service' : 'New Service'}
        size="md"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" hint="Shown on the booking page.">
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="field"
                placeholder="Signature Fade"
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="field"
              >
                {CATEGORIES.map(({ label, value }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price (₦)">
              <input
                required
                type="number"
                min="0"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                className="field"
                placeholder="5000"
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                required
                type="number"
                min="1"
                value={form.duration}
                onChange={(event) => setForm({ ...form, duration: event.target.value })}
                className="field"
                placeholder="45"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="field resize-none"
              placeholder="Describe this service..."
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
              Image
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
              placeholder="https://.../image.jpg (optional when a file is chosen)"
            />
          </div>

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
              {editing ? 'Save Changes' : 'Create Service'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete service"
        description={`Delete "${deleting?.name ?? ''}"? This cannot be undone. Services with existing appointments cannot be deleted.`}
      />
    </div>
  )
}