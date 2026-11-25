import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginModal } from './LoginModal';

const calls = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn(), close: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({
  signInWithEmail: calls.signIn, signUpWithEmail: calls.signUp, signInWithGoogle: vi.fn(),
}) }));
vi.mock('../../../infrastructure/state/store', () => ({ useAppStore: () => ({
  isLoginModalOpen: true, loginRequiredFeature: null, closeLoginModal: calls.close, themeMode: 'light',
}) }));
function passwordInput() { return screen.getByPlaceholderText('비밀번호') as HTMLInputElement; }
function enter(password: string) {
  fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'local-test@example.invalid' } });
  fireEvent.change(passwordInput(), { target: { value: password } });
}
function signupMode() { fireEvent.click(screen.getByRole('button', { name: '회원가입' })); }
function submit() { fireEvent.submit(passwordInput().closest('form')!); }
beforeEach(() => {
  vi.clearAllMocks(); calls.signIn.mockResolvedValue({ error: null }); calls.signUp.mockResolvedValue({ error: null });
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('signup-only password length', () => {
  it('rejects14characters before a programmatic signup submission reaches the API', async () => {
    render(<LoginModal />); signupMode(); enter('a'.repeat(14)); submit();
    await screen.findByText(/비밀번호는 15자 이상/);
    expect(calls.signUp).not.toHaveBeenCalled();
  });
  it('accepts15characters at the signup boundary', async () => {
    render(<LoginModal />); signupMode(); enter('a'.repeat(15)); submit();
    await waitFor(() => expect(calls.signUp).toHaveBeenCalledWith('local-test@example.invalid', 'a'.repeat(15)));
  });
  it('counts Unicode codepoints rather than UTF16units', async () => {
    render(<LoginModal />); signupMode(); enter('😀'.repeat(14)); submit();
    await screen.findByText(/비밀번호는 15자 이상/);
    expect(calls.signUp).not.toHaveBeenCalled();
    enter('😀'.repeat(15)); submit();
    await waitFor(() => expect(calls.signUp).toHaveBeenCalledWith('local-test@example.invalid', '😀'.repeat(15)));
  });
  it('keeps legacy6character passwords available for signin', async () => {
    render(<LoginModal />); enter('old123'); submit();
    await waitFor(() => expect(calls.signIn).toHaveBeenCalledWith('local-test@example.invalid', 'old123'));
    expect(calls.signUp).not.toHaveBeenCalled();
  });
  it('does not trim spaces from a signup passphrase', async () => {
    const password = '  a longer passphrase with spaces  ';
    render(<LoginModal />); signupMode(); enter(password); submit();
    await waitFor(() => expect(calls.signUp).toHaveBeenCalledWith('local-test@example.invalid', password));
  });
  it('clears the signup length error when switching back to legacy signin', async () => {
    render(<LoginModal />); signupMode(); enter('a'.repeat(14)); submit();
    await screen.findByText(/비밀번호는 15자 이상/);
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(screen.queryByText(/비밀번호는 15자 이상/)).toBeNull();
    enter('old123'); submit();
    await waitFor(() => expect(calls.signIn).toHaveBeenCalledWith('local-test@example.invalid', 'old123'));
  });
  it('adds signup guidance and native constraints, then removes them on signin', () => {
    render(<LoginModal />);
    expect(passwordInput().hasAttribute('minlength')).toBe(false);
    expect(passwordInput().autocomplete).toBe('current-password'); signupMode();
    expect(passwordInput().minLength).toBe(15); expect(passwordInput().autocomplete).toBe('new-password');
    expect(screen.getByText(/15자 이상.*문장/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(passwordInput().hasAttribute('minlength')).toBe(false);
    expect(passwordInput().autocomplete).toBe('current-password');
    expect(screen.queryByText(/15자 이상.*문장/)).toBeNull();
  });
});
