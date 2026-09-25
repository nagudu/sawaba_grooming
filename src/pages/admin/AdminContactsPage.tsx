import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Mail,
  MailOpen,
  MessageSquare,
  Reply,
  Search,
  Send,
  Trash2,
  User,
} from 'lucide-react'
import {
  api,
  buildQuery,
  type ContactItem,
  type ContactStatus,
  type ContactThread,
  type Paged,
} from '../../api'
import { ConfirmDialog, Field, PageHeader } from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useToast } from '../../components/ui/ToastNotification'
import { cn } from '../../utils/cn'

type FilterKey = 'all' | 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'READ', label: 'Read' },
  { key: 'REPLIED', label: 'Replied' },
  { key: 'ARCHIVED', label: 'Archived' },
]

const STATUS_BADGE: Record<ContactStatus, string> = {
  NEW: 'border-gold-500/50 bg-gold-500/10 text-gold-300',
  READ: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  REPLIED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  ARCHIVED: 'border-night-600 bg-night-800 text-night-400',
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusOf(item: ContactItem): ContactStatus {
  return item.status ?? (item.isRead ? 'READ' : 'NEW')
}

export default function AdminContactsPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [items, setItems] = useState<ContactItem[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [thread, setThread] = useState<ContactThread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const [deleting, setDeleting] = useState<ContactItem | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (targetFilter: FilterKey, targetSearch: string) => {
      setLoading(true)
      setListError(null)
      try {
        const data = await api.get<Paged<ContactItem>>(
          `/api/contact${buildQuery({
            status: targetFilter,
            search: targetSearch || undefined,
            page: 1,
            perPage: 100,
          })}`,
        )
        setItems(data.items)
      } catch (error) {
        setListError(error instanceof Error ? error.message : 'Failed to load messages.')
        notifyError(error)
      } finally {
        setLoading(false)
      }
    },
    [notifyError],
  )

  useEffect(() => {
    void load(filter, appliedSearch)
  }, [load, filter, appliedSearch])

  const openThread = async (item: ContactItem) => {
    setSelectedId(item.id)
    setMobileDetailOpen(true)
    setThreadLoading(true)
    setThread(null)
    try {
      const data = await api.get<ContactThread>(`/api/contact/${item.id}`)
      setThread(data)
      if (statusOf(item) === 'NEW') {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, isRead: true, status: 'READ' as ContactStatus } : entry,
          ),
        )
        try {
          await api.patch(`/api/contact/${item.id}/read`, { isRead: true })
        } catch {
          /* best-effort auto mark-read */
        }
      }
    } catch (error) {
      notifyError(error)
      setSelectedId(null)
      setMobileDetailOpen(false)
    } finally {
      setThreadLoading(false)
    }
  }

  const backToList = () => {
    setMobileDetailOpen(false)
    setSelectedId(null)
    setThread(null)
  }

  const toggleRead = async (item: ContactItem) => {
    const nextRead = !item.isRead
    try {
      await api.patch(`/api/contact/${item.id}/read`, { isRead: nextRead })
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isRead: nextRead,
                status:
                  statusOf(entry) === 'REPLIED' || statusOf(entry) === 'ARCHIVED'
                    ? entry.status
                    : nextRead
                      ? ('READ' as ContactStatus)
                      : ('NEW' as ContactStatus),
              }
            : entry,
        ),
      )
      if (thread?.id === item.id) setThread({ ...thread, isRead: nextRead })
    } catch (error) {
      notifyError(error)
    }
  }

  const setStatus = async (item: ContactItem, status: ContactStatus) => {
    try {
      await api.patch(`/api/contact/${item.id}/status`, { status })
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status,
                isRead: status === 'NEW' ? false : true,
                archivedAt: status === 'ARCHIVED' ? new Date().toISOString() : null,
              }
            : entry,
        ),
      )
      if (thread?.id === item.id) setThread({ ...thread, status })
      showToast(status === 'ARCHIVED' ? 'Message archived.' : 'Message restored.', 'info')
    } catch (error) {
      notifyError(error)
    }
  }

  const openReply = () => {
    if (!thread) return
    setReplyText('')
    setReplyError(null)
    setReplyOpen(true)
  }

  const sendReply = async () => {
    if (!thread) return
    const text = replyText.trim()
    if (text.length < 2) {
      setReplyError('Reply message must be at least 2 characters.')
      return
    }
    if (text.length > 5000) {
      setReplyError('Reply message must be 5000 characters or fewer.')
      return
    }
    setSending(true)
    setReplyError(null)
    try {
      await api.post(`/api/contact/${thread.id}/reply`, { message: text })
      showToast('Reply sent successfully.', 'success')
      setReplyOpen(false)
      setReplyText('')
      const refreshed = await api.get<ContactThread>(`/api/contact/${thread.id}`)
      setThread(refreshed)
      setItems((current) =>
        current.map((entry) =>
          entry.id === thread.id
            ? {
                ...entry,
                status: 'REPLIED' as ContactStatus,
                isRead: true,
                repliedAt: new Date().toISOString(),
                replyCount: refreshed.replyCount,
              }
            : entry,
        ),
      )
    } catch (error) {
      // Failure: keep the modal open and the drafted text intact so the admin can retry.
      setReplyError(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to send reply. Please try again.',
      )
      notifyError(error)
    } finally {
      setSending(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.del(`/api/contact/${deleting.id}`)
      setItems((current) => current.filter((entry) => entry.id !== deleting.id))
      if (selectedId === deleting.id) backToList()
      showToast('Message deleted.')
      setDeleting(null)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const counts = useMemo(() => {
    return {
      all: items.length,
      NEW: items.filter((item) => statusOf(item) === 'NEW').length,
      READ: items.filter((item) => statusOf(item) === 'READ').length,
      REPLIED: items.filter((item) => statusOf(item) === 'REPLIED').length,
      ARCHIVED: items.filter((item) => statusOf(item) === 'ARCHIVED').length,
    }
  }, [items])

  const selected = items.find((item) => item.id === selectedId) ?? null

  const searchInput = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') setAppliedSearch(search.trim())
        }}
        onBlur={() => setAppliedSearch(search.trim())}
        placeholder="Search name, email, subject or message…"
        className="field pl-10"
        aria-label="Search messages"
      />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Contact Messages"
        subtitle="View and manage messages received from the website contact form."
      />

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-lg border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                filter === key
                  ? 'border-gold-500/60 bg-gold-500/10 text-gold-300'
                  : 'border-night-700 text-night-400 hover:border-gold-500/40 hover:text-gold-300',
              )}
            >
              {label}
              <span className="ml-2 text-night-500">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="lg:w-96">{searchInput}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Message list */}
        <div
          className={cn(
            'card-lux overflow-hidden',
            mobileDetailOpen && 'hidden lg:block',
          )}
        >
          {loading ? (
            <LoadingSpinner label="Loading messages" />
          ) : listError ? (
            <p className="px-5 py-14 text-center text-sm text-red-400">{listError}</p>
          ) : items.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-night-500">
              {appliedSearch ? 'No messages match your search.' : 'No messages in this view.'}
            </p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-night-800 overflow-y-auto">
              {items.map((item) => {
                const status = statusOf(item)
                const isSelected = item.id === selectedId
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openThread(item)}
                      className={cn(
                        'w-full px-5 py-4 text-left transition-colors',
                        isSelected ? 'bg-gold-500/[0.08]' : 'hover:bg-night-900/60',
                        status === 'NEW' && !isSelected && 'bg-gold-500/[0.03]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={cn(
                            'truncate text-sm text-night-100',
                            status === 'NEW' && 'font-bold',
                          )}
                        >
                          {item.name}
                        </p>
                        <span className="shrink-0 text-[11px] text-night-500">
                          {new Date(item.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'mt-0.5 truncate text-sm text-night-300',
                          status === 'NEW' && 'font-semibold text-night-100',
                        )}
                      >
                        {item.subject || '(no subject)'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-night-500">{item.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            STATUS_BADGE[status],
                          )}
                        >
                          {status}
                        </span>
                        {item.replyCount > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-night-500">
                            <MessageSquare className="h-3 w-3" />
                            {item.replyCount}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Message detail */}
        <div className={cn('card-lux overflow-hidden', !mobileDetailOpen && 'hidden lg:block')}>
          {threadLoading ? (
            <LoadingSpinner label="Opening message" />
          ) : !thread && selected ? (
            <LoadingSpinner label="Opening message" />
          ) : !thread ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-night-700 bg-night-900 text-night-500">
                <Mail className="h-6 w-6" />
              </span>
              <p className="text-sm text-night-400">
                Select a message from the list to read the conversation.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Detail header */}
              <div className="border-b border-night-800 px-6 py-5">
                <button
                  type="button"
                  onClick={backToList}
                  className="mb-3 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-night-400 transition-colors hover:text-gold-300 lg:hidden"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Inbox
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl text-night-50">
                      {thread.subject || '(no subject)'}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-night-400">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-gold-500" />
                        <span className="font-semibold text-night-200">{thread.name}</span>
                      </span>
                      <a
                        href={`mailto:${thread.email}`}
                        className="text-gold-300 hover:underline"
                      >
                        {thread.email}
                      </a>
                      {thread.phone && <span>{thread.phone}</span>}
                    </div>
                    <p className="mt-1 text-xs text-night-500">
                      Received {formatDateTime(thread.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
                      STATUS_BADGE[statusOf(thread)],
                    )}
                  >
                    {statusOf(thread)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="gold" size="sm" onClick={openReply}>
                    <Reply className="h-4 w-4" />
                    Reply
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void toggleRead(thread)}>
                    {thread.isRead ? (
                      <>
                        <Mail className="h-4 w-4" />
                        Mark as Unread
                      </>
                    ) : (
                      <>
                        <MailOpen className="h-4 w-4" />
                        Mark as Read
                      </>
                    )}
                  </Button>
                  {statusOf(thread) === 'ARCHIVED' ? (
                    <Button variant="ghost" size="sm" onClick={() => void setStatus(thread, 'READ')}>
                      <ArchiveRestore className="h-4 w-4" />
                      Unarchive
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => void setStatus(thread, 'ARCHIVED')}>
                      <Archive className="h-4 w-4" />
                      Archive
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:bg-red-500/10"
                    onClick={() => setDeleting(thread)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Conversation thread */}
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6" style={{ maxHeight: '48vh' }}>
                {/* Original customer message */}
                <div className="rounded-xl border border-night-700 bg-night-900/60 p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-400">
                      Customer
                    </span>
                    <span className="text-xs text-night-500">{formatDateTime(thread.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-night-200">
                    {thread.message}
                  </p>
                </div>

                {/* Admin replies */}
                {thread.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="rounded-xl border border-gold-500/25 bg-gold-500/[0.04] p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">
                        Admin{reply.adminName ? ` · ${reply.adminName}` : ''}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-night-500">
                        {reply.status === 'SENT' ? (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            Sent
                          </span>
                        ) : (
                          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">
                            Failed
                          </span>
                        )}
                        {formatDateTime(reply.sentAt ?? reply.createdAt)}
                      </span>
                    </div>
                    <p className="mb-2 text-xs font-semibold text-night-400">{reply.subject}</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-night-200">
                      {reply.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reply modal */}
      <Modal open={replyOpen} onClose={() => !sending && setReplyOpen(false)} title="Reply to Message" size="lg">
        {thread && (
          <div className="space-y-5">
            <div className="rounded-xl border border-night-800 bg-night-900/60 p-4 text-sm">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-night-500">
                  To:
                </span>
                <span className="font-semibold text-gold-300">{thread.email}</span>
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-night-500">
                  Subject:
                </span>
                <span className="font-semibold text-night-100">
                  Re: {thread.subject || 'Your message'}
                </span>
              </p>
            </div>

            {!thread.emailConfigured && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-300">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                Email service is not configured on the server. Sending will fail until SMTP is set
                up (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in backend/.env) — the customer
                will NOT receive this reply.
              </p>
            )}

            <Field label="Message">
              <textarea
                rows={7}
                value={replyText}
                onChange={(event) => {
                  setReplyText(event.target.value)
                  if (replyError) setReplyError(null)
                }}
                placeholder={`Hello ${thread.name.split(' ')[0] || 'there'}, …`}
                className={cn('field resize-none', replyError && 'border-red-400/70')}
                aria-invalid={Boolean(replyError)}
              />
              {replyError && <span className="mt-1.5 block text-xs text-red-400">{replyError}</span>}
            </Field>

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" size="md" onClick={() => setReplyOpen(false)} disabled={sending}>
                Cancel
              </Button>
              <Button variant="gold" size="md" onClick={() => void sendReply()} loading={sending}>
                <Send className="h-4 w-4" />
                Send Reply
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
        title="Delete message"
        description="Permanently delete this contact message and its entire reply history? This cannot be undone."
      />
    </div>
  )
}
