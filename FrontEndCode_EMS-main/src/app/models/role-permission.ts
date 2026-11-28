/**
 * Models and interfaces for centralized dynamic Role-Based Screen Access Control.
 */

export interface ScreenDefinition {
  id: string;
  name: string;
  route: string;
  category: string;
  icon: string;
  description: string;
  order: number;
}

export interface ScreenPermissionItem {
  screenId: string;
  screenName?: string;
  name?: string;
  route: string;
  category: string;
  icon: string;
  description: string;
  allowed: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface RolePermissionConfig {
  id?: string;
  role: string;
  roleName: string;
  permissions: ScreenPermissionItem[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface RoleOption {
  code: string;
  label: string;
  description: string;
  icon: string;
  badgeClass: string;
}
