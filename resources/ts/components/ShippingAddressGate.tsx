import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBlockingGate } from '../contexts/BlockingGateContext';
import ShippingAddressRegisterModal from './ShippingAddressRegisterModal';

interface Props {
  children: React.ReactNode;
}

const isMissing = (v?: string | null) => !v || !v.trim();

/**
 * 参加者ログイン中で配送先住所が未登録なら登録モーダルを強制表示する。
 * - 登録完了まで閉じられない（背景はブラー）
 */
export default function ShippingAddressGate({ children }: Props) {
  const { user, hasRole, refreshUser } = useAuth();
  const { setBlocking } = useBlockingGate();
  const [open, setOpen] = useState(false);

  const requiresRegistration = useMemo(() => {
    if (!user) return false;
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

  // 配送先住所モーダル（閉じられない必須ゲート）の表示状態を共有する。
  useEffect(() => {
    setBlocking('shipping', open);
    return () => setBlocking('shipping', false);
  }, [open, setBlocking]);

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
