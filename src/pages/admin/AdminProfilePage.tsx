import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react'
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Save,
  Shield,
  Trash2,
  UploadCloud,
  UserCheck,
} from 'lucide-react'
import { PageHeader } from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { useAdminAuth } from '../../store/adminAuth'
import { authApi } from '../../api'
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal'

export default function AdminProfilePage() {
  const { admin, refreshProfile } = useAdminAuth()
  const { showToast } = useToast()

  // Profile fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Avatar upload
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Forgot password modal
  const [forgotModalOpen, setForgotModalOpen] = useState(false)

  useEffect(() => {
    if (admin) {
      setName(admin.name || '')
      setEmail(admin.email || '')
      setAvatarPreview(admin.avatarUrl || null)
    }
  }, [admin])

  // Handle avatar file selection
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP).', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit.', 'error')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Upload or update profile
  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      showToast('Name and email are required.', 'error')
      return
    }

    setSavingProfile(true)
    try {
      if (selectedFile) {
        // Upload with multipart FormData
        const formData = new FormData()
        formData.append('name', name.trim())
        formData.append('email', email.trim().toLowerCase())
        formData.append('avatar', selectedFile)

        await authApi.updateProfile(formData)
        setSelectedFile(null)
      } else {
        // Standard JSON update
        await authApi.updateProfile({
          name: name.trim(),
          email: email.trim().toLowerCase(),
        })
      }

      await refreshProfile()
      showToast('Profile updated successfully.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile.', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  // Remove avatar
  async function handleRemoveAvatar() {
    setUploadingAvatar(true)
    try {
      await authApi.updateProfile({ avatarUrl: null })
      await refreshProfile()
      setSelectedFile(null)
      setAvatarPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      showToast('Profile photo removed.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove photo.', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // Save / change password
  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (!currentPassword) {
      showToast('Please enter your current password.', 'error')
      return
    }

    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'error')
      return
    }

    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      showToast('New password must contain at least one letter and one number.', 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'error')
      return
    }

    setSavingPassword(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      showToast('Password changed successfully!', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to change password.', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  // Real-time password validation helpers
  const hasMinLength = newPassword.length >= 8
  const hasLetter = /[A-Za-z]/.test(newPassword)
  const hasNumber = /\d/.test(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        icon={<UserCheck className="h-5 w-5" />}
        title="Admin Profile & Security"
        subtitle="Manage your administrator details, profile photo, and password credentials."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Profile Photo & Account Details */}
        <div className="space-y-6 lg:col-span-7">
          <section className="card-lux p-6 sm:p-7">
            <h2 className="mb-1 font-display text-lg text-night-50">Profile Information</h2>
            <p className="mb-6 text-xs text-night-400">
              Update your administrative identity and profile photo displayed in the dashboard.
            </p>

            {/* Avatar Section */}
            <div className="mb-8 rounded-2xl border border-night-800 bg-night-950/60 p-5">
              <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                Profile Photo
              </span>
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                {/* Avatar Preview */}
                <div className="relative group shrink-0">
                  <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-gold-500/50 bg-gradient-to-br from-gold-500/20 to-night-900 shadow-xl shadow-gold-500/5">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt={name || 'Admin'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-display text-3xl font-bold text-gold-400">
                        {name ? name.charAt(0).toUpperCase() : 'A'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-night-950/70 text-gold-400 opacity-0 transition-opacity group-hover:opacity-100"
                    title="Change photo"
                  >
                    <Camera className="h-6 w-6" />
                  </button>
                </div>

                {/* Upload Actions */}
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="gold"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-4 w-4" />
                      {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                    </Button>

                    {(avatarPreview || selectedFile) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={uploadingAvatar}
                        onClick={handleRemoveAvatar}
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-night-500">
                    PNG, JPG, or WEBP up to 5MB. Click &quot;Save Changes&quot; below after choosing a photo.
                  </p>
                  {selectedFile && (
                    <p className="text-xs font-medium text-gold-400">
                      New image selected: {selectedFile.name} (ready to save)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  placeholder="e.g. Master Admin"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field pl-10"
                    placeholder="admin@sawabagrooming.com"
                    required
                  />
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
                </div>
              </div>

              {/* Role & Status (Read-only metadata) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-night-800 bg-night-950/40 p-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-night-500">
                    Assigned Role
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-xs text-gold-400">
                    <Shield className="h-3.5 w-3.5" />
                    <span>{admin?.role || 'ADMIN'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-night-800 bg-night-950/40 p-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-night-500">
                    Account Status
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-xs text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active</span>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  variant="gold"
                  size="md"
                  loading={savingProfile}
                  className="w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Password & Security */}
        <div className="space-y-6 lg:col-span-5">
          <section className="card-lux p-6 sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/30 bg-gold-500/10 text-gold-400">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg text-night-50">Change Password</h2>
                <p className="text-xs text-night-400">Keep your administrator account secure</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="field pr-10"
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="field pr-10"
                    placeholder="8+ characters with letter & number"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="field pr-10"
                    placeholder="Repeat new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="space-y-1.5 rounded-xl border border-night-800 bg-night-950/40 p-3 text-xs">
                <span className="block font-semibold uppercase tracking-[0.12em] text-night-400">
                  Password Requirements:
                </span>
                <div className="space-y-1 pt-1 text-night-400">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        hasMinLength ? 'bg-emerald-500/20 text-emerald-400' : 'bg-night-800 text-night-500'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <span className={hasMinLength ? 'text-night-200' : ''}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        hasLetter ? 'bg-emerald-500/20 text-emerald-400' : 'bg-night-800 text-night-500'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <span className={hasLetter ? 'text-night-200' : ''}>At least one letter (a-z)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        hasNumber ? 'bg-emerald-500/20 text-emerald-400' : 'bg-night-800 text-night-500'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <span className={hasNumber ? 'text-night-200' : ''}>At least one number (0-9)</span>
                  </div>
                  {newPassword.length > 0 && confirmPassword.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                          passwordsMatch ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      <span className={passwordsMatch ? 'text-emerald-400' : 'text-red-400'}>
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="gold"
                  size="md"
                  loading={savingPassword}
                  className="w-full"
                >
                  <Lock className="h-4 w-4" />
                  Update Password
                </Button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className="text-xs text-gold-400 hover:text-gold-300"
                >
                  Forgot your current password? Reset via email code
                </button>
              </div>
            </form>
          </section>

          {/* Quick Security Tip Card */}
          <div className="rounded-2xl border border-night-800 bg-night-900/30 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400">
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-night-200">
                  Security Recommendations
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-night-400">
                  As an administrator with full studio permissions, use a unique password and avoid reusing credentials from other services.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Reset Modal */}
      <ForgotPasswordModal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        target="ADMIN"
      />
    </div>
  )
}
