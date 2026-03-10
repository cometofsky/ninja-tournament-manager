import './globals.css';

export const metadata = {
  title: 'Tournament Manager',
  description: 'Manage and run tournaments with ease',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
