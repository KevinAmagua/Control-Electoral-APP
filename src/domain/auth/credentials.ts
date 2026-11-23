export type LoginCredentials = {
  email: string;
  password: string;
};

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type PasswordRecoveryInput = {
  email: string;
};
