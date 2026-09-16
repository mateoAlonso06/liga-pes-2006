import { useState, useEffect } from "react";
import { useAuth } from "../context/useAuth";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setMode("login");
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
    setError(null);

    if (!username.trim() || !password) {
      setError("Completá usuario y contraseña");
      return;
    }

    if (username.trim().length < 3) {
      setError("El usuario debe tener al menos 3 caracteres");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login({ username: username.trim(), password });
      } else {
        await register({ username: username.trim(), password });
      }
      handleClose();
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message === "Invalid credentials"
            ? "Usuario o contraseña incorrectos."
            : err.message
          : "Error al autenticar";
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
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <h2 id="login-modal-title">
              {mode === "login" ? "Iniciar Sesión" : "Crear Nueva Cuenta"}
            </h2>
            <p className="modal-sub">
              {mode === "login"
                ? "Accedé para gestionar la liga o interactuar como participante"
                : "Registrate para enviar propuestas con tu usuario"}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`btn ${mode === "login" ? "btn-gold" : "btn-secondary"}`}
            style={{ flex: 1 }}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`btn ${mode === "register" ? "btn-gold" : "btn-secondary"}`}
            style={{ flex: 1 }}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Crear Cuenta
          </button>
        </div>

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
              placeholder="tu_usuario"
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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {mode === "register" && (
            <div className="form-field">
              <label htmlFor="login-confirm-password">Confirmar Contraseña</label>
              <input
                id="login-confirm-password"
                type="password"
                className="form-input"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: "16px" }}>
            <button
              type="submit"
              className="btn btn-gold btn-lg"
              style={{ width: "100%" }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? mode === "login"
                  ? "Verificando..."
                  : "Registrando..."
                : mode === "login"
                ? "Ingresar"
                : "Crear Cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
