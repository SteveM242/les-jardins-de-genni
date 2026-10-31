import { reactive } from "vue";

const state = reactive({ items: [] });
let nextId = 1;

function dismiss(id) {
  const index = state.items.findIndex((toast) => toast.id === id);
  if (index !== -1) state.items.splice(index, 1);
}

function show(message, type = "info", duration = 3500) {
  const id = nextId++;
  state.items.push({ id, message, type });
  if (duration > 0) setTimeout(() => dismiss(id), duration);
  return id;
}

export function useToast() {
  return {
    state,
    show,
    success: (message) => show(message, "success"),
    error: (message) => show(message, "error", 6000),
    dismiss
  };
}
