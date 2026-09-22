import { Search, X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

/**
 * Premium search field used across admin consoles — glassy dark surface,
 * gold focus ring and a one-click clear button.
 */
export default function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  className,
  autoFocus,
}: SearchInputProps) {
  return (
    <div className={cn('group relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-night-500 transition-colors duration-200 group-focus-within:text-gold-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSearch?.()
        }}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-night-700 bg-night-900/80 pl-10 pr-9 text-sm text-night-100 shadow-sm backdrop-blur transition-all duration-200 placeholder:text-night-500 focus:border-gold-500/70 focus:bg-night-900 focus:shadow-[0_0_0_3px_rgba(201,162,75,0.12)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            onSearch?.()
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-night-500 transition-colors hover:bg-night-800 hover:text-gold-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}