import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/standalone-client');
  return null;
}
