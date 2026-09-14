import { useState, useEffect } from "react";
import { useAuth } from "../context/useAuth";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setUsername("");
    setPassword("");
    setError(null);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Completá usuario y contraseña");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login({ username: username.trim(), password });
      handleClose();
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message === "Invalid credentials"
            ? "Usuario o contraseña incorrectos."
            : err.message
          : "Error al iniciar sesión";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="modal-box">
        <button
          type="button"
          className="modal-close"
          onClick={handleClose}
          aria-label="Cerrar"
        >
          ✕
        </button>

        <h2 id="login-modal-title">Acceso Admin</h2>
        <p className="modal-sub">Ingresá tus credenciales para gestionar la liga</p>

        {error && (
          <div className="error-box" role="alert" style={{ width: "100%", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="login-form">
          <div className="form-field">
            <label htmlFor="login-username">Usuario</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              autoComplete="username"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="modal-actions" style={{ marginTop: "16px" }}>
            <button
              type="submit"
              className="btn btn-gold btn-lg"
              style={{ width: "100%" }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Verificando..." : "Ingresar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
