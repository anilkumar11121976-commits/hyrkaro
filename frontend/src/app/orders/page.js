import OrderList from '@/components/order/OrderList';
import { RequireAuth } from '@/components/common';

export const metadata = { title: 'Orders', robots: { index: false } };

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrderList />
    </RequireAuth>
  );
}
