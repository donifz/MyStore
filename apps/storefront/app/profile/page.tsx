import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// The buyer cabinet (login, registration, Telegram verification, debts and
// loyalty points) lives in the React application at /buyer.
export default function ProfilePage() {
  redirect('/buyer');
}
