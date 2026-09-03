import './globals.css';

export const metadata = {
  title: {
    default: 'Tournament Manager — Modern Bracket & Round-Robin Orchestration',
    template: '%s | Tournament Manager',
  },
  description: 'Streamlined athletic tournament management. Create, track, and score round-robin, group stages, and knockout brackets with automated tiebreaking.',
  keywords: ['tournament manager', 'round robin generator', 'knockout bracket', 'group stage standings', 'match scheduler'],
  authors: [{ name: 'Tournament Manager' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

