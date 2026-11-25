import { href } from '@/lib/deploy';

export function StatusPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main id="main" className="band"><div className="wrap wrap--tight">
    <p className="kicker">Sohan Automobile</p><h1>{title}</h1>
    <div className="stack" style={{ marginTop: '24px' }}>{children}</div>
    {/* Deliberate document navigation: legacy enhancements boot once per document. */}
    { }
    <p style={{ marginTop: '24px' }}><a className="btn btn--solid" href={href("/")}>Return home</a></p>
  </div></main>;
}
