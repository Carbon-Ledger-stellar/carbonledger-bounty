import React from 'react';
import type { Metadata } from 'next';
import { colors, fonts } from '../styles/design-system';

export const metadata: Metadata = {
  title: 'CarbonLedger — Tokenized Carbon Credits on Stellar',
  description: 'Tokenize, trade, and retire carbon credits with absolute provenance on Stellar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: fonts.body,
          backgroundColor: colors.neutral[50],
          color: colors.neutral[900],
        }}
      >
        <header
          style={{
            backgroundColor: colors.neutral[900],
            color: 'white',
            padding: '1rem 2rem',
            borderBottom: `2px solid ${colors.primary[500]}`,
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 800 }}>🌍 CarbonLedger</h1>
            <nav style={{ display: 'flex', gap: '2rem', listStyle: 'none', margin: 0, padding: 0 }}>
              <a href="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                Home
              </a>
              <a href="/projects" style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                Projects
              </a>
              <a href="/marketplace" style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                Marketplace
              </a>
              <a href="/audit" style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                Audit
              </a>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer
          style={{
            backgroundColor: colors.neutral[900],
            color: colors.neutral[400],
            padding: '2rem',
            textAlign: 'center',
            marginTop: '4rem',
          }}
        >
          <p>&copy; 2024 CarbonLedger. Built on Stellar. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
