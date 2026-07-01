import React, { useEffect, useState } from 'react';
import axios from '../lib/axios';
import SubscriptionRegisterModal from './SubscriptionRegisterModal';
import BankTransferInfoModal from './BankTransferInfoModal';
import { useAuth } from '../contexts/AuthContext';
import { useBlockingGate } from '../contexts/BlockingGateContext';
import { Backdrop, CircularProgress } from '@mui/material';

/**
 * 参加者/出品者レイアウトで包んで使う。
 * 承認済みユーザーがまだ年会費に加入していなければ自動で登録モーダルを表示する。
 * 銀行振込で申し込んだが管理者の振込確認待ちのユーザーには、1日1回だけ振込情報モーダルを表示する。
 * admin ロールは対象外（admin は年会費なし）。
 */
interface Props {
  children: React.ReactNode;
}

const BANK_INFO_SHOWN_KEY = 'bankInfoShownDate';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const bankInfoShownToday = (userId: number | string): boolean => {
  try {
    return localStorage.getItem(`${BANK_INFO_SHOWN_KEY}:${userId}`) === todayKey();
  } catch {
    return false;
  }
};

const markBankInfoShownToday = (userId: number | string): void => {
  try {
    localStorage.setItem(`${BANK_INFO_SHOWN_KEY}:${userId}`, todayKey());
  } catch {
    // localStorage 不可（プライベートモード等）でも処理を続行
  }
};

export default function SubscriptionGate({ children }: Props) {
  const { user, hasRole } = useAuth();
  const { setBlocking } = useBlockingGate();
  const [checking, setChecking] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [bankInfoOpen, setBankInfoOpen] = useState(false);

  const isAdmin = hasRole('admin');

  // サブスク登録モーダル（閉じられない必須ゲート）の表示状態を共有する。
  useEffect(() => {
    setBlocking('subscription', modalOpen);
    return () => setBlocking('subscription', false);
  }, [modalOpen, setBlocking]);

  const check = async () => {
    if (!user || isAdmin) { setChecking(false); return; }
    try {
      const res = await axios.get('/api/me/subscription');
      const d = res.data.data;
      if (d.requires_registration) {
        setModalOpen(true);
        setBankInfoOpen(false);
      } else if (d.bank_transfer_pending) {
        if (!bankInfoShownToday(user.id)) {
          setBankInfoOpen(true);
          markBankInfoShownToday(user.id);
        }
        setModalOpen(false);
      }
    } catch (e) {
      // 失敗したら静かに無視（API ダウン時にアプリ全体を止めない）
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  if (checking) {
    return (
      <Backdrop open sx={{ color: '#fff', zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  }

  return (
    <>
      {children}
      <SubscriptionRegisterModal
        open={modalOpen}
        onClose={() => {
          // 登録完了まで閉じさせない（承認済みユーザーへの強制ゲート）
        }}
        onCompleted={() => {
          setModalOpen(false);
          check();
        }}
      />
      <BankTransferInfoModal
        open={bankInfoOpen}
        onClose={() => setBankInfoOpen(false)}
      />
    </>
  );
}
