import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App Smoke Test (T-003, T-083)', () => {
  it('renders application heading', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Model Change Review Lab');
  });

  it('navigates to Performance Lab tab and renders empty benchmark placeholder', () => {
    render(<App />);
    const perfTab = screen.getByRole('button', { name: /^Performance Lab$/ });
    expect(perfTab).not.toBeDisabled();
    fireEvent.click(perfTab);

    expect(screen.getByTestId('no-measurements-placeholder')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Performance Lab: Virtualization & Benchmarks/
      })
    ).toBeInTheDocument();
  });
});
