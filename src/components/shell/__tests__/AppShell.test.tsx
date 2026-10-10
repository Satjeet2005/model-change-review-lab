import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@/state/AppProvider';
import { AppShell } from '../AppShell';

describe('AppShell Component (T-028)', () => {
  it('renders product title and visible disclosure badge', () => {
    render(
      <AppProvider>
        <AppShell>
          <div>Main Content</div>
        </AppShell>
      </AppProvider>
    );

    // Title
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Model Change Review Lab');

    // Visible status disclosure
    expect(screen.getByText('Independent prototype · Synthetic data')).toBeInTheDocument();

    // Main content
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('renders primary navigation with Model as active and others disabled for Phase 2', () => {
    render(
      <AppProvider>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </AppProvider>
    );

    const modelTab = screen.getByRole('button', { name: /^Model$/ });
    expect(modelTab).toHaveAttribute('aria-current', 'page');
    expect(modelTab).not.toBeDisabled();

    // Future tabs disabled
    const compareTab = screen.getByRole('button', { name: /Scenario Compare/ });
    expect(compareTab).toBeDisabled();

    const historyTab = screen.getByRole('button', { name: /History/ });
    expect(historyTab).toBeDisabled();

    const perfTab = screen.getByRole('button', { name: /Performance Lab/ });
    expect(perfTab).toBeDisabled();

    // Future action buttons disabled
    const undoBtn = screen.getByRole('button', { name: /Undo/ });
    expect(undoBtn).toBeDisabled();

    const resetBtn = screen.getByRole('button', { name: /Reset/ });
    expect(resetBtn).toBeDisabled();
  });

  it('provides responsive header container and scroll-contained navigation on mobile', () => {
    render(
      <AppProvider>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </AppProvider>
    );

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();

    const headerContainer = header.firstElementChild;
    expect(headerContainer).toHaveClass('flex-wrap');

    const nav = screen.getByRole('navigation', { name: 'Main Navigation' });
    expect(nav).toHaveClass('overflow-x-auto');
    expect(nav).toHaveClass('min-w-0');
  });
});
