import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  children,
  titleId,
  onClose,
  busy = false,
  large = false,
}: {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  large?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${large ? "large-modal" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
