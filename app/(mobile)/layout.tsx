export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {children}
    </div>
  );
}
