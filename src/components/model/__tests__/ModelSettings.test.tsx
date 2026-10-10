import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/state/AppProvider';
import { ModelSettings } from '../ModelSettings';

describe('ModelSettings Component (T-032)', () => {
  it('renders initial starting revenue and starting cash formatted', () => {
    render(
      <AppProvider>
        <ModelSettings />
      </AppProvider>
    );

    expect(screen.getByText('Starting Revenue (USD)')).toBeInTheDocument();
    expect(screen.getByText('Starting Cash (USD)')).toBeInTheDocument();
    expect(screen.getByText('$750,000')).toBeInTheDocument();
    expect(screen.getByText('$3,000,000')).toBeInTheDocument();
  });

  it('allows editing starting revenue and commits update successfully', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelSettings />
      </AppProvider>
    );

    const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
    // First edit button is for starting revenue
    await user.click(editButtons[0]!);

    const input = screen.getByLabelText('Starting Revenue (USD)');
    expect(input).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '850000');

    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    expect(screen.getByText('$850,000')).toBeInTheDocument();
  });

  it('rejects invalid negative starting revenue and preserves current setting', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelSettings />
      </AppProvider>
    );

    const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
    await user.click(editButtons[0]!);

    const input = screen.getByLabelText('Starting Revenue (USD)');
    await user.clear(input);
    await user.type(input, '-500');

    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    // Error alert displayed
    expect(screen.getByRole('alert')).toHaveTextContent(/must be between 0 and 1,000,000,000/);

    // Cancel edit
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(screen.getByText('$750,000')).toBeInTheDocument();
  });
});
