export default function ActionButton({
  children,
  onClick,
  disabled = false,
  busy = false,
  tone = "default",
  type = "button"
}) {
  return (
    <button
      type={type}
      className={`action-button action-button--${tone}`}
      onClick={onClick}
      disabled={disabled || busy}
    >
      {busy ? "Working..." : children}
    </button>
  );
}
