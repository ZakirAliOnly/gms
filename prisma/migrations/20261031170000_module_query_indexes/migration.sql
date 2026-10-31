-- Scope, filter and order module reads without combining separate indexes.
CREATE INDEX "AuditLog_tenantId_createdAt_id_idx" ON "AuditLog"("tenantId", "createdAt", "id");
CREATE INDEX "AuditLog_tenantId_action_createdAt_idx" ON "AuditLog"("tenantId", "action", "createdAt");
CREATE INDEX "Membership_tenantId_status_nextRenewalDate_idx" ON "Membership"("tenantId", "status", "nextRenewalDate");
