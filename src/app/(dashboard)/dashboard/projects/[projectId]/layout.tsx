export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Project layout just passes children through
  // The Sidebar auto-detects projectId from URL and shows project navigation
  return <>{children}</>
}
