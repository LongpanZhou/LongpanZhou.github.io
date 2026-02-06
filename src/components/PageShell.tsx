import { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
}

function PageShell({ children }: PageShellProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A1428',
      paddingTop: '76px',
      paddingBottom: '40px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px',
      }}>
        {children}
      </div>
    </div>
  );
}

export default PageShell;
