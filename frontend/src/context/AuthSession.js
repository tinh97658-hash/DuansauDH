import { createContext, useContext } from "react";

// Lives with the protected route, so pages share the verified session without
// persisting credentials or application data across logins.
export const AuthSessionContext = createContext(null);
export const useAuthSession = () => useContext(AuthSessionContext);
