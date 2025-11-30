/**
 * Audit log service for tracking user actions and access
 */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'add' | 'edit' | 'delete' | 'view' | 'export' | 'login' | 'logout' | 'share' | 'backup' | 'restore';
  resource: 'medication' | 'symptom' | 'settings' | 'data' | 'report' | 'caregiver';
  resourceId?: string;
  details?: string;
  userId?: string;
  ipAddress?: string;
}

/**
 * Log an action
 */
export const logAction = (
  action: AuditLogEntry['action'],
  resource: AuditLogEntry['resource'],
  resourceId?: string,
  details?: string
): void => {
  try {
    const logs = getAuditLogs();
    const newLog: AuditLogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action,
      resource,
      resourceId,
      details,
    };

    logs.push(newLog);

    // Keep only last 1000 entries
    if (logs.length > 1000) {
      logs.shift();
    }

    localStorage.setItem('auditLogs', JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to log action:', error);
  }
};

/**
 * Get audit logs
 */
export const getAuditLogs = (): AuditLogEntry[] => {
  try {
    const logs = localStorage.getItem('auditLogs');
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
};

/**
 * Get audit logs filtered by criteria
 */
export const getFilteredAuditLogs = (
  filters: {
    action?: AuditLogEntry['action'];
    resource?: AuditLogEntry['resource'];
    startDate?: string;
    endDate?: string;
  }
): AuditLogEntry[] => {
  const logs = getAuditLogs();

  return logs.filter(log => {
    if (filters.action && log.action !== filters.action) return false;
    if (filters.resource && log.resource !== filters.resource) return false;
    if (filters.startDate && log.timestamp < filters.startDate) return false;
    if (filters.endDate && log.timestamp > filters.endDate) return false;
    return true;
  });
};

/**
 * Clear audit logs
 */
export const clearAuditLogs = (): void => {
  localStorage.removeItem('auditLogs');
};

/**
 * Export audit logs
 */
export const exportAuditLogs = (): string => {
  const logs = getAuditLogs();
  return JSON.stringify(logs, null, 2);
};

