export interface CredentialProvider {
  getPhone: () => Promise<string>;
  getOtp: () => Promise<string>;
  onStepChange?: (step: 'phone' | 'otp') => void;
}
