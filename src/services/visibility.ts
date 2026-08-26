import { CurrentUser } from '../middleware/auth';

export function isAgent(user: CurrentUser): boolean {
  return user.role === 'agent';
}

export function canSeeAllLeads(user: CurrentUser): boolean {
  return user.role === 'owner' || user.role === 'admin' || user.role === 'manager';
}
