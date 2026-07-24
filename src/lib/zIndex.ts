/**
 * Global z-index scale — single source of truth for stacking order.
 * Prefer these constants over hardcoded numbers or ad-hoc `z-[...]` values.
 */
export const Z_INDEX = {
  base: 1,
  dropdown: 100,
  sticky: 150,
  sidebar: 200,
  drawerBackdrop: 299,
  drawer: 300,
  modalBackdrop: 399,
  modal: 400,
  confirmationBackdrop: 9997,
  confirmation: 9998,
  toast: 99999,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
