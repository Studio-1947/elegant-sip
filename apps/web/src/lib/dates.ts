/** Renders an ISO date as the storefront's long form: "12 March 2026". */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
