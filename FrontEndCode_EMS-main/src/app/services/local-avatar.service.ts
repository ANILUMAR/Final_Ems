import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalAvatarService {
  /**
   * Resolves a local, offline-safe avatar URL for any user or employee.
   * If an image path or data URL is present, attempts to use it.
   * If missing, invalid, or pointing to external internet resources,
   * immediately falls back to local project SVGs:
   * /assets/avatars/avatar-admin.svg, avatar-pm.svg, avatar-dev.svg, avatar-qa.svg, avatar-lead.svg, etc.
   */
  getAvatarUrl(rawImage?: string | null, role?: string | null, name?: string | null): string {
    if (rawImage && typeof rawImage === 'string') {
      const clean = rawImage.trim();
      // Data URL (base64) - 100% offline
      if (clean.startsWith('data:image/')) {
        return clean;
      }
      // Local attachment in public/assets or relative path
      if (clean.startsWith('/assets/') || clean.startsWith('assets/')) {
        return clean.startsWith('/') ? clean : '/' + clean;
      }
      // If someone gave an external internet URL, replace with local offline avatar
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        if (!clean.includes('localhost') && !clean.includes('127.0.0.1')) {
          return this.getDefaultAvatarForRole(role);
        }
        return clean;
      }
      // If it's a backend attachment path (e.g. "1795...png")
      return `http://localhost:9001/attachments/${clean}`;
    }
    return this.getDefaultAvatarForRole(role);
  }

  /**
   * Returns a local, self-contained SVG avatar asset from the project folder.
   */
  getDefaultAvatarForRole(role?: string | null): string {
    const r = String(role || '').toUpperCase().trim();
    if (r.includes('ADMIN') || r === 'SUPER_ADMIN') {
      return '/assets/avatars/avatar-admin.svg';
    }
    if (r.includes('PROJECT_MANAGER') || r.includes('MANAGER')) {
      return '/assets/avatars/avatar-pm.svg';
    }
    if (r.includes('DEVELOPER_LEAD') || r.includes('TEAM_LEAD') || r.includes('LEAD')) {
      return '/assets/avatars/avatar-lead.svg';
    }
    if (r.includes('DEVELOPER') || r.includes('EMPLOYEE')) {
      return '/assets/avatars/avatar-dev.svg';
    }
    if (r.includes('TESTER')) {
      return '/assets/avatars/avatar-qa.svg';
    }
    return '/assets/avatars/avatar-default.svg';
  }

  /**
   * Generates clean 2-letter uppercase initials.
   */
  getInitials(name?: string | null): string {
    const clean = String(name || '').trim();
    if (!clean) return 'U';
    const parts = clean.split(/[\s.@_-]+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Returns the appropriate local Material Icon string for a given user role.
   */
  getRoleIcon(role?: string | null): string {
    const r = String(role || '').toUpperCase().trim();
    if (r.includes('ADMIN') || r === 'SUPER_ADMIN') return 'workspace_premium';
    if (r.includes('MANAGER')) return 'engineering';
    if (r.includes('LEAD')) return 'groups';
    if (r.includes('DEVELOPER') || r.includes('EMPLOYEE')) return 'code';
    if (r.includes('TESTER')) return 'bug_report';
    return 'person';
  }
}
