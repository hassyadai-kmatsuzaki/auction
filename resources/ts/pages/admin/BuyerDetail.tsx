import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserDetail from './UserDetail';

/**
 * 買受者詳細画面
 * UserDetail コンポーネントをラップして、買受者専用の詳細画面として機能させる
 */
export default function BuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return <UserDetail />;
}
