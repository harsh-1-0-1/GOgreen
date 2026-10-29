import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorDetail } from '@/lib/apiError';

const INPUT_CLASS = 'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light/40';

export default function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const changePassword = useAuthStore((s) => s.changePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500">
        <p className="mb-3">Please log in to change your password.</p>
        <button onClick={openAuthModal} className="text-primary font-medium hover:underline">Log in</button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setIsSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Could not change password'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-8 flex items-center gap-2">
        <KeyRound size={22} className="text-primary" /> Change Password
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl sm:rounded-2xl border p-4 sm:p-6 space-y-3">
        <p className="text-sm text-gray-500">
          Signed in as <span className="font-medium text-gray-700">{user.email}</span>
        </p>
        <input type="password" placeholder="Current password" required autoComplete="current-password"
          value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={INPUT_CLASS} />
        <input type="password" placeholder="New password (min 8 chars)" required minLength={8} maxLength={128}
          autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT_CLASS} />
        <input type="password" placeholder="Confirm new password" required minLength={8} maxLength={128}
          autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={INPUT_CLASS} />
        <button type="submit" disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-60 touch-target">
          {isSaving ? 'Updating…' : 'Update Password'}
        </button>
        <p className="text-xs text-gray-400">
          Changing your password signs out your other devices. <Link to="/orders" className="text-primary hover:underline">Back to My Orders</Link>
        </p>
      </form>
    </div>
  );
}
