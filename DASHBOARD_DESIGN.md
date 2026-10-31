# Golden GYM application design

This guide records the dashboard screenshot and design requirements supplied in
the redesign request. No earlier `DASHBOARD_DESIGN.md` was present in the checkout
or in the fetched main branch.

- Use `src/components/app-layout.tsx` for all authenticated surfaces. Tenant and
  Admin branch routes share `TenantShell`; platform pages use `PlatformShell`.
- Follow the reference proportions: a roughly 252px brown sidebar, 80px white
  top bar, warm off-white canvas, 24–28px desktop content spacing, white panels,
  subtle borders/elevation, and restrained rounded corners.
- The primary colour is `#6b4f3b`. Define theme colours, tints, chart colours,
  shadows and radii centrally in `src/app/global.css`. Use semantic tokens in
  components; do not introduce hardcoded Tailwind hex colours.
- Keep typography consistent with the shared font. Use clear sentence-case page
  titles, muted supporting descriptions, readable tables, and tabular amounts.
- Desktop has a full sidebar with a collapse control. Tablet starts with compact
  navigation and can expand it. Mobile uses a focus-trapped drawer with overlay,
  Escape support, and navigation that closes after selecting a destination.
- Standalone interactive controls must be at least 44×44px. Keep action spacing
  sufficient for touch. Do not shrink touch targets to make a table fit.
- Tables scroll within their own containers; the document must not overflow
  horizontally. Stack panels/forms on narrow viewports and reduce outside
  spacing to 16px on mobile.
- Reuse PageHeader, ActionToolbar, FilterToolbar, StatCard, DataTable, FormField,
  StatusBadge, FeedbackState, PageSkeleton and the shared dialog primitives.
  Keep modal modules separate from pages, and receipts/print components separate
  from interactive editor components.
- Use actual business data for charts, summaries, recent members and alerts.
  Do not invent percentage changes or notification counts. Preserve tenant and
  branch scope in navigation, exports and Server Actions.
- Provide focus states, accessible labels, semantic table headers, reduced-motion
  support, loading/empty/error states and responsive print styles.
- Settings show current account/workspace information and persist display
  preferences locally. Do not present unsaved configuration fields as working
  administrative settings.
