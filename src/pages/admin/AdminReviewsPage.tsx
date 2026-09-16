import { useEffect, useState } from 'react'
import { Check, Eye, Pencil, Search, Star, Trash2, X } from 'lucide-react'
import { api, buildQuery, type Paged, type ReviewItem, type ReviewStatus } from '../../api'
import {
  ConfirmDialog,
  EmptyRow,
  Field,
  PageHeader,
  Td,
  Th,
} from '../../components/admin/AdminUI'
import StarRating from '../../components/ui/StarRating'
import StarRatingInput from '../../components/ui/StarRatingInput'
import Modal from '../../components/ui/Modal'
import { Button, buttonClasses } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useToast } from '../../components/ui/ToastNotification'
import { cn } from '../../utils/cn'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const FILTERS: Array<{ key: Filter; label: string; status: ReviewStatus | 'all' }> = [
  { key: 'pending', label: 'Pending', status: 'PENDING' },
  { key: 'approved', label: 'Approved', status: 'APPROVED' },
  { key: 'rejected', label: 'Rejected', status: 'REJECTED' },
  { key: 'all', label: 'All', status: 'all' },
]

const STATUS_STYLES: Record<ReviewStatus, string> = {
  PENDING: 'border-gold-500/40 bg-gold-500/10 text-gold-300',
  APPROVED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  REJECTED: 'border-red-500/40 bg-red-500/10 text-red-300',
}

const REVIEW_STATUSES: ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

interface EditForm {
  customerName: string
  customerPhone: string
  customerEmail: string
  serviceName: string
  rating: number
  comment: string
  status: ReviewStatus
}

export default function AdminReviewsPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<ReviewItem | null>(null)
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null)
  const [viewing, setViewing] = useState<ReviewItem | null>(null)
  const [editing, setEditing] = useState<ReviewItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (targetFilter: Filter = filter, query = search) => {
    setLoading(true)
    try {
      const status = FILTERS.find((item) => item.key === targetFilter)?.status ?? 'all'
      const data = await api.get<Paged<ReviewItem>>(
        `/api/reviews${buildQuery({
          status,
          search: query.trim() || undefined,
          page: 1,
          perPage: 100,
        })}`,
      )
      setReviews(data.items)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(filter, search)
    }, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const setStatus = async (review: ReviewItem, status: ReviewStatus, message: string) => {
    try {
      await api.patch(`/api/reviews/${review.id}`, { status })
      showToast(message, 'success')
      await load()
    } catch (error) {
      notifyError(error)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.del(`/api/reviews/${deleting.id}`)
      showToast('Review deleted.', 'success')
      setDeleting(null)
      await load()
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const confirmReject = async () => {
    if (!rejecting) return
    setBusy(true)
    try {
      await api.patch(`/api/reviews/${rejecting.id}`, { status: 'REJECTED' })
      showToast('Review rejected.', 'success')
      setRejecting(null)
      await load()
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const openEdit = (review: ReviewItem) => {
    setEditing(review)
    setEditForm({
      customerName: review.customerName,
      customerPhone: review.customerPhone ?? '',
      customerEmail: review.customerEmail ?? '',
      serviceName: review.serviceName ?? '',
      rating: review.rating,
      comment: review.comment,
      status: review.status,
    })
  }

  const saveEdit = async () => {
    if (!editing || !editForm) return
    setBusy(true)
    try {
      await api.patch(`/api/reviews/${editing.id}`, {
        customerName: editForm.customerName.trim(),
        customerPhone: editForm.customerPhone.trim() || null,
        customerEmail: editForm.customerEmail.trim() || null,
        serviceName: editForm.serviceName.trim() || null,
        rating: editForm.rating,
        comment: editForm.comment.trim(),
        status: editForm.status,
      })
      showToast('Review updated.', 'success')
      setEditing(null)
      setEditForm(null)
      await load()
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Moderate customer reviews before they appear publicly." />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key)
                void load(key)
              }}
              className={cn(
                buttonClasses('outline', 'md'),
                filter === key && 'border-gold-500/60 text-gold-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-night-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, email, service or text…"
            className="field pl-10"
            aria-label="Search reviews"
          />
        </div>
      </div>

      <div className="card-lux overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading reviews" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Customer</Th>
                  <Th>Service</Th>
                  <Th>Rating</Th>
                  <Th>Comment</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {reviews.length === 0 ? (
                  <EmptyRow colSpan={7} message="No reviews match this view." />
                ) : (
                  reviews.map((review) => (
                    <tr key={review.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <div className="flex items-center gap-3">
                          {review.customerImage ? (
                            <img
                              src={review.customerImage}
                              alt=""
                              className="h-9 w-9 rounded-full border border-night-700 object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-night-700 bg-night-900 text-xs font-bold text-gold-400">
                              {review.customerName.charAt(0)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-night-100">
                              {review.customerName}
                            </p>
                            {review.customerPhone && (
                              <p className="truncate text-[11px] text-night-500">
                                {review.customerPhone}
                              </p>
                            )}
                            {review.customerEmail && (
                              <p className="truncate text-[11px] text-night-500">
                                {review.customerEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-xs text-night-400">
                        {review.serviceName ?? '—'}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <StarRating rating={review.rating} />
                          <span className="ml-1 text-xs text-night-500">{review.rating}.0</span>
                        </div>
                      </Td>
                      <Td>
                        <p className="max-w-xs truncate text-night-300">{review.comment}</p>
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-night-500">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                            STATUS_STYLES[review.status],
                          )}
                        >
                          {review.status === 'APPROVED' ? (
                            <Check className="h-3 w-3" />
                          ) : review.status === 'REJECTED' ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <Star className="h-3 w-3" />
                          )}
                          {review.status.toLowerCase()}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewing(review)}
                            aria-label="View review"
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-sky-500/40 hover:text-sky-300"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {review.status !== 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => void setStatus(review, 'APPROVED', 'Review approved.')}
                              aria-label="Approve review"
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-300 transition-colors hover:bg-emerald-500/20"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {review.status !== 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() => setRejecting(review)}
                              aria-label="Reject review"
                              className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(review)}
                            aria-label="Edit review"
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(review)}
                            aria-label="Delete review"
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
      </div>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Review Details"
        size="md"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg text-night-50">{viewing.customerName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <StarRating rating={viewing.rating} />
                  <span className="text-xs text-night-500">{viewing.rating}.0</span>
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                  STATUS_STYLES[viewing.status],
                )}
              >
                {viewing.status.toLowerCase()}
              </span>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="text-night-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-night-500">
                  Service
                </span>
                <span className="mt-0.5 block text-night-100">{viewing.serviceName ?? '—'}</span>
              </p>
              <p className="text-night-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-night-500">
                  Submitted
                </span>
                <span className="mt-0.5 block text-night-100">
                  {new Date(viewing.createdAt).toLocaleString()}
                </span>
              </p>
              <p className="text-night-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-night-500">
                  Phone
                </span>
                <span className="mt-0.5 block text-night-100">{viewing.customerPhone ?? '—'}</span>
              </p>
              <p className="text-night-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-night-500">
                  Email
                </span>
                <span className="mt-0.5 block text-night-100">{viewing.customerEmail ?? '—'}</span>
              </p>
            </div>

            <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-night-500">
                Review
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-night-200">
                &ldquo;{viewing.comment}&rdquo;
              </p>
            </div>

            <div className="flex justify-end gap-3">
              {viewing.status !== 'APPROVED' && (
                <Button
                  variant="gold"
                  size="md"
                  disabled={busy}
                  onClick={() => {
                    setViewing(null)
                    void setStatus(viewing, 'APPROVED', 'Review approved.')
                  }}
                >
                  Approve Review
                </Button>
              )}
              <Button variant="outline" size="md" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Review" size="md">
        {editForm && (
          <div className="space-y-4">
            <Field label="Customer Name">
              <input
                type="text"
                value={editForm.customerName}
                onChange={(event) =>
                  setEditForm({ ...editForm, customerName: event.target.value })
                }
                className="field"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input
                  type="text"
                  value={editForm.customerPhone}
                  onChange={(event) =>
                    setEditForm({ ...editForm, customerPhone: event.target.value })
                  }
                  className="field"
                />
              </Field>
              <Field label="Email">
                <input
                  type="text"
                  value={editForm.customerEmail}
                  onChange={(event) =>
                    setEditForm({ ...editForm, customerEmail: event.target.value })
                  }
                  className="field"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service">
                <input
                  type="text"
                  value={editForm.serviceName}
                  onChange={(event) =>
                    setEditForm({ ...editForm, serviceName: event.target.value })
                  }
                  className="field"
                />
              </Field>
              <Field label="Rating">
                <div className="flex items-center gap-2">
                  <StarRatingInput value={editForm.rating} onChange={(rating) => setEditForm({ ...editForm, rating })} />
                </div>
              </Field>
            </div>
            <Field label="Status">
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm({ ...editForm, status: event.target.value as ReviewStatus })
                }
                className="field"
              >
                {REVIEW_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Comment" hint={`${editForm.comment.trim().length} characters`}>
              <textarea
                rows={4}
                value={editForm.comment}
                onChange={(event) => setEditForm({ ...editForm, comment: event.target.value })}
                className="field resize-none"
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="md" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="gold" size="md" loading={busy} onClick={() => void saveEdit()}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete review"
        description={`Delete the review by ${deleting?.customerName ?? ''}? This cannot be undone.`}
      />

      <ConfirmDialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        onConfirm={() => void confirmReject()}
        busy={busy}
        title="Reject review"
        confirmLabel="Reject"
        description={`Reject the review by ${rejecting?.customerName ?? ''}? It will not appear publicly.`}
      />
    </div>
  )
}