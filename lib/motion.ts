// Shared framer-motion constants. Before this existed, every page picked
// its own duration/easing/spring/stagger values for what were visually the
// same interactions (page-enter fades, list stagger-ins, spring pops) —
// three different enter durations, two hand-typed easing curves used
// nowhere else, and spring configs that varied stiffness without ever
// specifying damping. Import from here instead of inventing another one-off.

export const DURATION = {
  fast: 0.1,
  base: 0.15,
  slow: 0.25,
} as const;

export const EASE_STANDARD = [0.16, 1, 0.3, 1] as const;

export const SPRING_POP = {
  type: "spring" as const,
  stiffness: 260,
  damping: 20,
};

export const STAGGER_CHILDREN = 0.05;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DURATION.base },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.base, ease: EASE_STANDARD },
};

export const staggerContainer = {
  animate: {
    transition: { staggerChildren: STAGGER_CHILDREN },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.base },
};
