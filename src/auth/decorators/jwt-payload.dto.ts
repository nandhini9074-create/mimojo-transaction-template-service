export interface JwtPayload {
  user: {
    id: string;
    preferredLanguage: string;
  };
  email: string;
}
