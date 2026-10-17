import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ColdBootToast } from '../ColdBootToast';

describe('ColdBootToast Component', () => {
  it('renders cold boot notice with ~50s / 30-60s explanation while initializing', () => {
    render(<ColdBootToast isInitializing={true} />);

    expect(screen.getByText('Free-Tier Backend Notice')).toBeInTheDocument();
    expect(screen.getByText('Cold Boot ~50s')).toBeInTheDocument();
    expect(screen.getByText(/30–60 seconds \(~50s\)/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('allows user to dismiss toast immediately with close button', () => {
    render(<ColdBootToast isInitializing={true} />);

    const dismissBtn = screen.getByRole('button', { name: /Dismiss notice/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Free-Tier Backend Notice')).not.toBeInTheDocument();
  });

  it('shows connected state and auto-dismisses after connection', () => {
    vi.useFakeTimers();

    const { rerender } = render(<ColdBootToast isInitializing={true} />);
    expect(screen.getByText('Free-Tier Backend Notice')).toBeInTheDocument();

    // Connection completes
    rerender(<ColdBootToast isInitializing={false} />);
    expect(screen.getByText('Connected to Workspace')).toBeInTheDocument();
    expect(screen.getByText(/Backend is active/)).toBeInTheDocument();

    // After 4 seconds timer
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Connected to Workspace')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
