
import { useState } from "react";
import { supabase } from "./supabaseClient";

type AdminLoginProps = {
  onLogin: () => void;
};

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage("فشل تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.");
      return;
    }

    onLogin();
  }

  return (
    <section className="form-panel" dir="rtl">
      <h1>تسجيل دخول الإدارة</h1>
      <p className="muted">سجّل الدخول لإدارة محلات كرمالك.</p>

      <form className="shop-form" onSubmit={handleLogin}>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="أدخل بريدك الإلكتروني"
          />
        </label>

        <label>
          كلمة المرور
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="أدخل كلمة المرور"
          />
        </label>

        {message && <p role="alert">{message}</p>}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
        </button>
      </form>
    </section>
  );
}
