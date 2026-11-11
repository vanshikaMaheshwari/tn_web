import { redirect } from 'next/navigation';

// Legacy route: mentee login now lives on the unified /login page.
export default function MenteePage() {
  redirect('/login?role=mentee');
}
