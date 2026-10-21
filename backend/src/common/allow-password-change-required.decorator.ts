import { SetMetadata } from "@nestjs/common";

export const ALLOW_PASSWORD_CHANGE_REQUIRED = "allowPasswordChangeRequired";
/** Only for the minimum authenticated password recovery operations. */
export const AllowPasswordChangeRequired = () => SetMetadata(ALLOW_PASSWORD_CHANGE_REQUIRED, true);
