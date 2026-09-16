import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/useAuth";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { username, isAdmin, avatarUrl, uploadAvatar, removeAvatar } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setSelectedFile(null);
    if (previewUrl && previewUrl !== avatarUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setStatusMessage(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "La imagen no debe superar los 5MB" });
      return;
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      setStatusMessage({ type: "error", text: "Por favor seleccioná un archivo de imagen válido" });
      return;
    }

    if (previewUrl && previewUrl !== avatarUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setStatusMessage(null);

    try {
      await uploadAvatar(selectedFile);
      setStatusMessage({ type: "success", text: "¡Foto de perfil actualizada con éxito!" });
      setSelectedFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al subir la imagen";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!avatarUrl) return;
    if (!window.confirm("¿Seguro que deseás eliminar tu foto de perfil?")) return;

    setIsRemoving(true);
    setStatusMessage(null);

    try {
      await removeAvatar();
      setStatusMessage({ type: "success", text: "Foto de perfil eliminada" });
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar la foto";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsRemoving(false);
    }
  };

  const currentDisplayImage = previewUrl || avatarUrl;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="modal-box" style={{ maxWidth: "460px" }}>
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <h2 id="profile-modal-title">Mi Perfil</h2>
            <p className="modal-sub">Gestioná tu cuenta y foto de perfil</p>
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

        {statusMessage && (
          <div
            className={statusMessage.type === "error" ? "error-box" : "success-box"}
            role="alert"
            style={{
              width: "100%",
              marginBottom: "16px",
              padding: "10px 14px",
              borderRadius: "6px",
              backgroundColor: statusMessage.type === "error" ? "rgba(220, 38, 38, 0.15)" : "rgba(34, 197, 94, 0.15)",
              color: statusMessage.type === "error" ? "#fca5a5" : "#86efac",
              border: `1px solid ${statusMessage.type === "error" ? "rgba(220, 38, 38, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
            }}
          >
            {statusMessage.text}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", margin: "12px 0 24px" }}>
          <div
            style={{
              width: "110px",
              height: "110px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "3px solid var(--gold-bright, #eab308)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
            }}
          >
            {currentDisplayImage ? (
              <img
                src={currentDisplayImage}
                alt={`Avatar de ${username}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "36px", fontWeight: "bold", color: "var(--gold-bright, #eab308)" }}>
                {username ? username.substring(0, 2).toUpperCase() : "RT"}
              </span>
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>
              {username}
            </div>
            <span
              className="admin-pill"
              style={{ display: "inline-flex", marginTop: "6px" }}
            >
              <span className="dot" />
              {isAdmin ? "Administrador" : "Usuario"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/webp, image/gif"
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRemoving}
            >
              📷 {selectedFile ? "Cambiar Selección" : "Elegir Foto"}
            </button>

            {selectedFile && (
              <button
                type="button"
                className="btn btn-gold"
                style={{ flex: 1 }}
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? "Subiendo..." : "💾 Guardar"}
              </button>
            )}
          </div>

          {selectedFile && (
            <div style={{ fontSize: "0.85rem", color: "var(--gold-bright)", textAlign: "center" }}>
              Archivo seleccionado: <strong>{selectedFile.name}</strong>
            </div>
          )}

          {avatarUrl && !selectedFile && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)", marginTop: "4px" }}
              onClick={handleRemove}
              disabled={isRemoving || isUploading}
            >
              {isRemoving ? "Eliminando..." : "🗑 Eliminar Foto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
