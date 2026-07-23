import { motion, useReducedMotion, type Variants } from 'framer-motion'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
}

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number]

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease },
  },
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
          {eyebrow}
        </p>
        <div className="space-y-1">
          <h1 className="section-title text-3xl font-bold sm:text-4xl">{title}</h1>
          <p className="max-w-3xl text-sm text-[color:var(--muted)] sm:text-base">{description}</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.p
        variants={itemVariants}
        className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]"
      >
        {eyebrow}
      </motion.p>
      <div className="space-y-1">
        <motion.h1
          variants={itemVariants}
          className="section-title text-3xl font-bold sm:text-4xl"
        >
          {title}
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="max-w-3xl text-sm text-[color:var(--muted)] sm:text-base"
        >
          {description}
        </motion.p>
      </div>
    </motion.div>
  )
}
