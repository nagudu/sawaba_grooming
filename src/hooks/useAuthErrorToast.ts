import { useCallback } from 'react'
import { useToast } from '../components/ui/ToastNotification'
import { ApiError } from '../api'

export function useAuthErrorToast() {
  const { showToast } = useToast()

  const notifyError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          showToast('Session expired, please sign in again.', 'error')
        } else {
          showToast(error.message, 'error')
        }
      } else {
        showToast('Something went wrong.', 'error')
      }
    },
    [showToast],
  )

  return { notifyError }
}
