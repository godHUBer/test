'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="band"><div className="wrap">
    <h1>We could not load this page.</h1><p>Please try again, or call the showroom on +91 98311 89375.</p>
    <button className="btn btn--solid" onClick={reset}>Try again</button>
  </div></main>;
}
