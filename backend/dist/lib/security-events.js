import prisma from './prisma.js';
const safeMetadataKeys = new Set([
    'route',
    'method',
    'reason',
    'isActive',
    'challengeSlug',
    'status',
    'environment',
    'authLabEnabled',
    'accessLabEnabled',
    'outcome',
    'pointsAwarded',
    'fields',
]);
export function sanitizeSecurityEventMetadata(metadata) {
    if (!metadata) {
        return undefined;
    }
    const safeEntries = Object.entries(metadata)
        .filter(([key, value]) => safeMetadataKeys.has(key) && value !== undefined)
        .map(([key, value]) => [
        key,
        typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160) : value,
    ]);
    return Object.fromEntries(safeEntries);
}
export async function recordSecurityEvent(event) {
    try {
        await prisma.securityEvent.create({
            data: {
                eventType: event.eventType,
                severity: event.severity,
                requestId: event.requestId.slice(0, 64),
                actorUserId: event.actorUserId,
                targetUserId: event.targetUserId,
                metadata: sanitizeSecurityEventMetadata(event.metadata),
            },
        });
    }
    catch (error) {
        console.error(JSON.stringify({
            type: 'security_event_persistence_failure',
            requestId: event.requestId,
            eventType: event.eventType,
            error: error instanceof Error ? error.message : 'Unknown persistence error',
        }));
    }
}
export async function purgeExpiredSecurityEvents() {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await prisma.securityEvent.deleteMany({
        where: { occurredAt: { lt: cutoff } },
    });
    return result.count;
}
