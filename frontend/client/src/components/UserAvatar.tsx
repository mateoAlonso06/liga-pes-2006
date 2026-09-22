import React, { useState } from "react";

export interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  isRegistered?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  showTooltip?: boolean;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: { box: 28, font: 12, border: 1.5 },
  sm: { box: 36, font: 14, border: 2 },
  md: { box: 48, font: 18, border: 2 },
  lg: { box: 64, font: 24, border: 2.5 },
  xl: { box: 88, font: 32, border: 3 },
  "2xl": { box: 112, font: 40, border: 3.5 },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  isRegistered = false,
  size = "sm",
  className = "",
  showTooltip = true,
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);
  const dims = SIZE_MAP[size] || SIZE_MAP.sm;

  const initial = name && name.trim().length > 0 ? name.trim()[0].toUpperCase() : "?";

  const tooltipText = showTooltip
    ? isRegistered
      ? `${name} (Usuario registrado)`
      : `${name} (Jugador sin cuenta vinculada)`
    : undefined;

  const isClickable = Boolean(onClick);

  const baseContainerStyle: React.CSSProperties = {
    width: `${dims.box}px`,
    height: `${dims.box}px`,
    minWidth: `${dims.box}px`,
    minHeight: `${dims.box}px`,
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    verticalAlign: "middle",
    transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
    cursor: isClickable ? "pointer" : "default",
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick?.();
    }
  };

  if (avatarUrl && !hasError) {
    return (
      <div
        className={`user-avatar ${isClickable ? "avatar-clickable" : ""} ${className}`}
        title={tooltipText}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        onKeyDown={handleKeyDown}
        style={{
          ...baseContainerStyle,
          border: isRegistered
            ? `${dims.border}px solid var(--gold-bright, #f2cf5c)`
            : `${dims.border}px solid rgba(255, 255, 255, 0.25)`,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
        }}
      >
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setHasError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  // Fallback: avatar con iniciales según si es usuario registrado o jugador manual
  const fallbackStyle: React.CSSProperties = isRegistered
    ? {
        ...baseContainerStyle,
        backgroundColor: "rgba(234, 179, 8, 0.15)",
        border: `${dims.border}px solid var(--gold-bright, #f2cf5c)`,
        color: "var(--gold-bright, #f2cf5c)",
        fontWeight: 700,
        fontSize: `${dims.font}px`,
      }
    : {
        ...baseContainerStyle,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        border: `${dims.border}px dashed rgba(255, 255, 255, 0.3)`,
        color: "var(--text-dim, #8fae9c)",
        fontWeight: 600,
        fontSize: `${dims.font}px`,
      };

  return (
    <div
      className={`user-avatar user-avatar-initial ${isRegistered ? "registered" : "unlinked"} ${isClickable ? "avatar-clickable" : ""} ${className}`}
      title={tooltipText}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onKeyDown={handleKeyDown}
      style={fallbackStyle}
    >
      <span>{initial}</span>
    </div>
  );
};
