// Redirect /auth/login → /login for clean URL
import { redirect } from 'next/navigation'

export default function AuthLoginRedirect() {
  redirect('/login')
}
