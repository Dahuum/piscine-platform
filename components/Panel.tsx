"use client";

import { forwardRef } from "react";

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  // Standardized hover-elevation treatment for interactive/clickable
  // panels. Before this existed, "card" divs across the app used
  // hover:border-primary/20, hover:border-primary/30, hover:shadow-sm, or
  // nothing at all for what was visually the same "this row is clickable"
  // signal — pick this instead of hand-rolling another variant.
  hover?: boolean;
};

// Shared class-string builder so motion.div usages (which can't cleanly
// wrap Panel itself — motion.create() on a custom forwardRef component
// produced a real SSR/hydration mismatch, confirmed via a render diff) can
// still get Panel's exact border/radius/hover treatment: `<motion.div
// className={panelClasses({ hover: true, className: "p-4" })} ...>`.
export function panelClasses({
  hover = false,
  className = "",
}: { hover?: boolean; className?: string } = {}) {
  return `rounded-xl border ${
    hover ? "transition-colors duration-200 hover:border-primary/30" : ""
  } ${className}`;
}

// The shared "bordered panel" primitive every page was hand-rolling a
// slightly different version of (rounded-lg vs rounded-xl, inconsistent
// hover states). Deliberately not HeroUI's own Card — its corner radius is
// far rounder than what's used everywhere else in the app and adopting it
// would mean changing the whole app's radius scale, not just this one
// component. Background/padding are left to the caller via className since
// panels serve different roles (stat tile, list row, prototype box) that
// reasonably want different fills/spacing — only border, radius, and the
// hover treatment are standardized here. For a framer-motion-animated
// panel, use motion.div with panelClasses() instead of wrapping this.
const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className = "", hover = false, children, ...props }, ref) => (
    <div ref={ref} className={panelClasses({ hover, className })} {...props}>
      {children}
    </div>
  ),
);
Panel.displayName = "Panel";

export default Panel;
