import { redirect } from 'next/navigation';

export default function Home() {
  // The (app) layout enforces auth and bounces to /login when needed.
  redirect('/dashboard');
}
