export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return <main id="main" className="band"><div className="wrap wrap--tight">
    <p className="kicker">Sohan Automobile · Staff access</p><h1>{title}</h1>
    <div className="stack" style={{ marginTop: 28 }}>{children}</div>
    <p style={{ marginTop: 28 }}>{/* Full navigation reinitialises the legacy public enhancement layer. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/">Return to public website</a></p>
  </div></main>;
}
