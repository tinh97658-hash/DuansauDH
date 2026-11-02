import { toast } from "react-toastify";

// Pass operation messages only, never response payloads or generated credentials.
export const notify = {
  success: message => toast.success(message, { autoClose: 3000 }),
  error: message => toast.error(Array.isArray(message) ? message.join(". ") : message, { autoClose: 8000 }),
  warning: message => toast.warning(message, { autoClose: 6000 }),
};
