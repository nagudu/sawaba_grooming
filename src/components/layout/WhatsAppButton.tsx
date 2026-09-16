import { motion } from 'framer-motion'
import { WhatsAppIcon } from '../icons/SocialIcons'
import { site } from '../../data/services'

export default function WhatsAppButton() {
  const href = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
    'Hello SAWABA, I would like to book an appointment.',
  )}`

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.3, delay: 1.2 }}
      className="group fixed right-5 bottom-5 z-[70] flex items-center gap-3 rounded-full bg-[#25d366] px-4 py-3.5 text-white shadow-[0_12px_30px_-6px_rgba(37,211,102,0.55)]"
    >
      <WhatsAppIcon className="h-6 w-6" />
      <span className="hidden max-w-0 overflow-hidden text-sm font-semibold opacity-0 transition-all duration-300 group-hover:max-w-[180px] group-hover:opacity-100 sm:block">
        Chat with us
      </span>
    </motion.a>
  )
}