export type UserRole = 'admin' | 'leader';

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}
