import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../ui/Button'
import { useToast } from '../ui/ToastNotification'
import { api } from '../../api'
import { validateField } from '../../utils/validation'
import { cn } from '../../utils/cn'

interface FormState {
  fullName: string
  phone: string
  email: string
  subject: string
  message: string
}

const initialForm: FormState = {
  fullName: '',
  phone: '',
  email: '',
  subject: '',
  message: '',
}

export default function ContactForm() {
  const { showToast } = useToast()
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (
    field: keyof FormState,
    value: string,
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {
      fullName: validateField('fullName', form.fullName, { required: true, min: 2 }),
      phone: validateField('phone', form.phone, { required: true, phone: true }),
      email: validateField('email', form.email, { required: true, email: true }),
      subject: validateField('subject', form.subject, { required: true, min: 3 }),
      message: validateField('message', form.message, { required: true, min: 10 }),
    }
    setErrors(nextErrors)
    return Object.values(nextErrors).every((error) => !error)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/contact', {
        name: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      })
      setSubmitted(true)
      showToast('Message sent successfully. We will reply shortly.')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to send message. Please try again.',
        'error',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card-lux flex flex-col items-center justify-center px-8 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-500/15">
          <Send className="h-7 w-7 text-gold-400" />
        </span>
        <h3 className="mt-6 font-display text-2xl text-night-50">
          Message Sent
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-night-400">
          Thank you for reaching out. Our team will get back to you shortly —
          usually within a few hours during opening times.
        </p>
        <Button
          variant="outline"
          size="md"
          className="mt-8"
          onClick={() => {
            setSubmitted(false)
            setForm(initialForm)
          }}
        >
          Send Another Message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card-lux p-8">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-gold-500" />
        <h3 className="font-display text-2xl text-night-50">
          Send Us a Message
        </h3>
      </div>

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <Field
          label="Full Name"
          name="fullName"
          value={form.fullName}
          error={errors.fullName}
          onChange={(value) => handleChange('fullName', value)}
        />
        <Field
          label="Phone Number"
          name="phone"
          type="tel"
          value={form.phone}
          error={errors.phone}
          onChange={(value) => handleChange('phone', value)}
        />
        <div className="sm:col-span-2">
          <Field
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(value) => handleChange('email', value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Subject"
            name="subject"
            value={form.subject}
            error={errors.subject}
            onChange={(value) => handleChange('subject', value)}
          />
        </div>
        <div className="sm:col-span-2">
          <TextareaField
            label="Message"
            name="message"
            value={form.message}
            error={errors.message}
            onChange={(value) => handleChange('message', value)}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="hidden text-xs text-night-500 sm:block">
          We reply within hours during opening time.
        </p>
        <Button type="submit" variant="gold" size="md" loading={submitting}>
          Send Message
          {!submitting && <Send className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  )
}

interface FieldProps {
  label: string
  name: string
  type?: string
  value: string
  error?: string
  onChange: (value: string) => void
}

function Field({ label, name, type = 'text', value, error, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
        {label}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn('field', error && 'border-red-400/70')}
        aria-invalid={Boolean(error)}
      />
      {error && (
        <span className="mt-1.5 block text-xs text-red-400">{error}</span>
      )}
    </label>
  )
}

function TextareaField({
  label,
  name,
  value,
  error,
  onChange,
}: Omit<FieldProps, 'type'>) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
        {label}
      </span>
      <textarea
        name={name}
        value={value}
        rows={5}
        onChange={(event) => onChange(event.target.value)}
        className={cn('field resize-none', error && 'border-red-400/70')}
        aria-invalid={Boolean(error)}
      />
      {error && (
        <span className="mt-1.5 block text-xs text-red-400">{error}</span>
      )}
    </label>
  )
}