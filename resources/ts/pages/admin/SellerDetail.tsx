import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserDetail from './UserDetail';

/**
 * 出品者詳細画面
 * UserDetail コンポーネントをラップして、出品者専用の詳細画面として機能させる
 */
export default function SellerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return <UserDetail />;
}
