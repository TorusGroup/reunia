// Redirect /auth/register → /register-case (the actual case registration page)
import { redirect } from 'next/navigation'

export default function AuthRegisterRedirect() {
  redirect('/register-case')
}
