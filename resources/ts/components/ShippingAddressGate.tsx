import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ShippingAddressRegisterModal from './ShippingAddressRegisterModal';

interface Props {
  children: React.ReactNode;
}

const isMissing = (v?: string | null) => !v || !v.trim();

/**
 * 参加者ログイン中で配送先住所が未登録なら登録モーダルを強制表示する。
 * - 登録完了まで閉じられない（背景はブラー）
 * - admin ロールは対象外（自分で落札しないため）
 */
export default function ShippingAddressGate({ children }: Props) {
  const { user, hasRole, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);

  const requiresRegistration = useMemo(() => {
    if (!user) return false;
    if (hasRole('admin')) return false;
    if (!hasRole('participant')) return false;
    return (
      isMissing(user.name) ||
      isMissing(user.phone) ||
      isMissing(user.postal_code) ||
      isMissing(user.prefecture) ||
      isMissing(user.city) ||
      isMissing(user.address_line1)
    );
  }, [user, hasRole]);

  useEffect(() => {
    setOpen(requiresRegistration);
  }, [requiresRegistration]);

  return (
    <>
      {children}
      <ShippingAddressRegisterModal
        open={open}
        onCompleted={async () => {
          await refreshUser();
          setOpen(false);
        }}
      />
    </>
  );
}
