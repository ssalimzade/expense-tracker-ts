import type { KeyboardEvent } from "react";

type Editable = HTMLInputElement | HTMLTextAreaElement;

/**
 * Keyboard handler for inline-editable cells:
 *  - Enter blurs the field, which fires the existing onBlur commit.
 *  - Escape restores the original value and blurs without committing.
 *
 * `original` is the value to restore on Escape (usually the persisted value).
 */
export function commitOnEnter(original: string | number) {
  return (e: KeyboardEvent<Editable>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.currentTarget.value = String(original ?? "");
      e.currentTarget.blur();
    }
  };
}
