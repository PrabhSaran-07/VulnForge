import { isLoopbackAddress } from './auth-lab.js';

export const accessControlScenarios = {
  objectAccess: ['learner-document', 'other-learner-document'],
  rolePermission: ['student-view-course', 'student-manage-users', 'admin-manage-users'],
  privilegeBoundary: ['student-self-assign-admin', 'student-run-admin-action', 'admin-run-admin-action'],
} as const;

export type ObjectAccessScenario = (typeof accessControlScenarios.objectAccess)[number];
export type RolePermissionScenario = (typeof accessControlScenarios.rolePermission)[number];
export type PrivilegeBoundaryScenario = (typeof accessControlScenarios.privilegeBoundary)[number];

export { isLoopbackAddress };

export class AccessControlLabSimulator {
  compareObjectAccess(learnerId: string, resourceId: ObjectAccessScenario) {
    const principalId = `synthetic-learner:${learnerId}`;
    const resource = {
      id: resourceId,
      ownerId: resourceId === 'learner-document' ? principalId : 'synthetic-learner:another-user',
      label: resourceId === 'learner-document' ? 'Your synthetic document' : 'Another learner’s synthetic document',
    };
    const securelyAuthorized = resource.ownerId === principalId;

    return {
      resource: resource.label,
      vulnerable: {
        authorized: true,
        message: 'The vulnerable check accepts a known resource identifier without checking its owner.',
      },
      secure: {
        authorized: securelyAuthorized,
        message: securelyAuthorized
          ? 'Access granted after the server verified the synthetic owner.'
          : 'Access denied because this synthetic document belongs to another learner.',
      },
    };
  }

  compareRolePermission(scenario: RolePermissionScenario) {
    const rolePermissions: Record<'STUDENT' | 'ADMIN', readonly string[]> = {
      STUDENT: ['view course'],
      ADMIN: ['view course', 'manage users'],
    };
    const cases = {
      'student-view-course': { role: 'STUDENT', action: 'view course' },
      'student-manage-users': { role: 'STUDENT', action: 'manage users' },
      'admin-manage-users': { role: 'ADMIN', action: 'manage users' },
    } as const;
    const selected = cases[scenario];
    const securelyAuthorized = rolePermissions[selected.role].includes(selected.action);

    return {
      syntheticRole: selected.role,
      action: selected.action,
      vulnerable: {
        authorized: true,
        message: 'The vulnerable check grants the operation to every authenticated synthetic actor.',
      },
      secure: {
        authorized: securelyAuthorized,
        message: securelyAuthorized
          ? 'Access granted by the server-side synthetic permission policy.'
          : 'Access denied by the server-side synthetic permission policy.',
      },
    };
  }

  comparePrivilegeBoundary(scenario: PrivilegeBoundaryScenario) {
    const cases = {
      'student-self-assign-admin': { role: 'STUDENT', action: 'assign ADMIN to self', allowed: false },
      'student-run-admin-action': { role: 'STUDENT', action: 'run an ADMIN-only action', allowed: false },
      'admin-run-admin-action': { role: 'ADMIN', action: 'run an ADMIN-only action', allowed: true },
    } as const;
    const selected = cases[scenario];

    return {
      syntheticRole: selected.role,
      action: selected.action,
      vulnerable: {
        authorized: true,
        message: 'The vulnerable check trusts the requested privileged action.',
      },
      secure: {
        authorized: selected.allowed,
        message: selected.allowed
          ? 'Access granted after server-side privilege validation.'
          : 'Access denied; the synthetic actor lacks permission for this privilege boundary.',
      },
      stateChanged: false,
    };
  }
}

export const accessControlLabSimulator = new AccessControlLabSimulator();
