import OrderDetail from '@/components/order/OrderDetail';
import { RequireAuth } from '@/components/common';

export const metadata = { title: 'Order', robots: { index: false } };

export default async function OrderPage({ params }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <OrderDetail id={id} />
    </RequireAuth>
  );
}
