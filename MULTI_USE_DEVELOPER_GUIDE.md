# Multi-Use Print Links - Developer Guide

## Quick Reference

### Core Concept
**Print links are MULTI-USE within their time window, NOT single-use.**

```
Submit Job → Generate Link → Valid for N minutes
             ↓
   Use 1x, 2x, 3x... → All succeed within time window
                       ↓
                   Expiration → Link dies
```

---

## Key Design Decisions

### 1. Why Multi-Use?
**Problem:** Users need to print the same document multiple times (drafts, copies, etc.)

**Original Design (Broken):**
- Link → Print once → Dead ❌
- User needs to re-submit same document for each print

**New Design (Fixed):**
- Link → Print N times → Expires after time limit ✅
- User can print repeatedly without re-submitting

---

### 2. Why In-Memory Storage?
**Security Requirement:** No persistent storage

**Implementation:**
```javascript
// Server (in-memory, lost on restart by design)
const expirationMetadata = new Map(); // jobId -> { expiresAt, token, releaseCount }

// Client (React state, lost on page close)
const [expirationMetadata, setExpirationMetadata] = useState(new Map());
const [cachedDocument, setCachedDocument] = useState(null);
```

**Trade-off:**
- ✅ Security: Metadata and files disappear on restart
- ❌ Availability: Server restart kills all active links

---

### 3. Why Track Release Count?
**Audit Requirement:** Know how many times each link was used

**Implementation:**
```javascript
// Backend
metadata.releaseCount = (metadata.releaseCount || 0) + 1;
console.log(`[Release] Job ${id} released ${metadata.releaseCount} time(s)`);

// Response
res.json({ success: true, releaseCount: metadata.releaseCount });
```

**Use Cases:**
- Detect suspicious activity (100+ releases in 1 minute)
- Billing/quota enforcement
- Analytics

---

## Code Patterns

### Pattern 1: Multi-Use Validation (Backend)

```javascript
// ❌ WRONG (Single-use)
if (usedTokens.has(token)) {
  return res.status(403).json({ error: 'Token has already been used' });
}
if (job.status !== 'pending') {
  return res.status(400).json({ error: 'Job already completed' });
}

// ✅ CORRECT (Multi-use)
// Only check: token correctness + expiration
if (metadata.token !== token) {
  return res.status(403).json({ error: 'Invalid token' });
}
if (currentServerTime >= metadata.expiresAt) {
  return res.status(403).json({ error: 'Print link has expired' });
}
// No status checks - allow re-release
```

**Why This Works:**
- Token validation ensures authentication
- Expiration enforces time limit
- No artificial "already used" restriction

---

### Pattern 2: Session-Level Deduplication (Frontend)

```javascript
// ❌ WRONG (Global state blocks re-use)
const [released, setReleased] = useState(false);
if (released) return; // Blocks page refresh re-validation

// ✅ CORRECT (Session-level state)
const releasingRef = React.useRef(false); // Prevents concurrent calls
const releasedInSession = React.useRef(false); // Prevents redundant calls

useEffect(() => {
  if (releasingRef.current || releasedInSession.current) return;
  
  releasingRef.current = true;
  releasePrintJob(...)
    .then(() => {
      releasedInSession.current = true; // Mark session as released
    });
}, [...]);
```

**Why This Works:**
- `useRef` survives re-renders but NOT page refresh
- Page refresh resets refs → allows re-validation
- Prevents React StrictMode double execution

---

### Pattern 3: Document Caching (Frontend)

```javascript
// ❌ WRONG (Re-fetch every time)
const job = printJobs.find(j => j.id === jobId);
const documentData = job?.document; // Lost on page refresh

// ✅ CORRECT (Cache in React state)
const [cachedDocument, setCachedDocument] = useState(null);

// On successful release:
if (job?.document && !cachedDocument) {
  setCachedDocument(job.document); // Cache for future prints
}

// When printing:
const documentData = cachedDocument || serverJob?.document || printJobs.find(...)?.document;
```

**Why This Works:**
- First print fetches from server/API
- Subsequent prints use cache (instant)
- Survives re-renders within same session

---

### Pattern 4: Error Classification (Frontend)

```javascript
// ❌ WRONG (All errors are "errors")
.catch(err => {
  toast.error(err.message); // Red toast for everything
});

// ✅ CORRECT (Classify by severity)
.catch(err => {
  if (err.message.includes('expired')) {
    toast.info('This print link has expired', { autoClose: 5000 }); // ℹ️ Info
  } else if (err.message.includes('already been used')) {
    toast.info('Link was used in another session. Still valid until expiration.');
    releasedInSession.current = true; // Treat as success
  } else {
    toast.error('Failed to release: ' + err.message); // ❌ Error
  }
});
```

**Why This Works:**
- Expired links = expected behavior → info toast
- Invalid tokens = security issue → error toast
- Users aren't alarmed by expected states

---

## State Management

### Backend State (In-Memory)
```javascript
expirationMetadata: Map<JobId, {
  expiresAt: number,        // Timestamp when link expires
  createdAt: number,        // Timestamp when link created
  token: string,            // Secure token for validation
  releaseCount: number,     // How many times released (audit)
  filePath: string | null,  // Path to uploaded file
  mimetype: string,         // File MIME type
  originalname: string      // Original filename
}>
```

**Lifecycle:**
1. **Create**: Job submitted → metadata stored
2. **Validate**: Each release checks metadata
3. **Update**: Release count incremented
4. **Expire**: Cleanup loop deletes expired entries
5. **Delete**: Server restart clears all

---

### Frontend State (React)

```javascript
// Global state (Context)
const [printJobs, setPrintJobs] = useState([]);
const [expirationMetadata, setExpirationMetadata] = useState(new Map());

// Component state (PrintRelease.js)
const [cachedDocument, setCachedDocument] = useState(null); // Document cache
const releasingRef = React.useRef(false);                   // Concurrent lock
const releasedInSession = React.useRef(false);              // Session flag
```

**Lifecycle:**
1. **Load**: Page loads → validate token
2. **Release**: Auto-release (if valid)
3. **Cache**: Store document in state
4. **Print**: Use cached document
5. **Refresh**: Reset session state → re-validate

---

## API Contract

### POST /api/jobs/:id/release

**Request:**
```json
{
  "token": "abc123...",
  "printerId": 1,
  "releasedBy": 2
}
```

**Response (Success):**
```json
{
  "success": true,
  "releaseCount": 3
}
```

**Response (Expired):**
```json
{
  "error": "Print link has expired"
}
```

**Response (Invalid Token):**
```json
{
  "error": "Invalid token"
}
```

**Key Points:**
- ✅ Same request can be made multiple times (multi-use)
- ✅ Each release increments `releaseCount`
- ✅ Status 200 even if already released before
- ❌ Status 403 only for invalid token or expiration

---

### GET /api/jobs/:id?token=xyz

**Request:**
```
GET /api/jobs/job123?token=abc123...
```

**Response:**
```json
{
  "job": {
    "id": "job123",
    "documentName": "report.pdf",
    "status": "pending",
    "expiresAt": "2026-01-18T15:30:00Z",
    "document": {
      "dataUrl": "data:application/pdf;base64,...",
      "mimeType": "application/pdf",
      "name": "report.pdf"
    }
  }
}
```

**Key Points:**
- ✅ Returns document data for caching
- ✅ Status is NOT changed to "completed" after release
- ✅ Can be called multiple times

---

## Security Considerations

### ✅ What's Secure

1. **Token Validation**: Every release validates token
2. **Expiration Enforcement**: Server time used (not client)
3. **Audit Trail**: Release count tracked
4. **Automatic Cleanup**: Expired files deleted
5. **Authentication**: User auth required for release

### ⚠️ What to Monitor

1. **Abuse Detection**: Watch for excessive release counts
   ```javascript
   if (metadata.releaseCount > 100) {
     console.warn(`Suspicious activity: Job ${id} released 100+ times`);
     // Optionally block or alert
   }
   ```

2. **Storage Growth**: Monitor uploads directory size
   ```bash
   du -sh server/uploads/
   ```

3. **Memory Usage**: Large Map sizes can consume RAM
   ```javascript
   console.log(`Active jobs: ${expirationMetadata.size}`);
   ```

### ❌ What NOT to Do

1. **Don't persist used tokens** → defeats multi-use design
2. **Don't delete files immediately after release** → breaks multi-use
3. **Don't check job status before release** → blocks re-release
4. **Don't use client time for expiration** → security hole

---

## Common Pitfalls

### Pitfall 1: Re-introducing Single-Use Logic

```javascript
// ❌ BAD
if (job.status === 'completed') {
  return res.status(400).json({ error: 'Already completed' });
}

// ✅ GOOD
// Allow release regardless of status
```

---

### Pitfall 2: Premature File Deletion

```javascript
// ❌ BAD
setTimeout(() => {
  fs.unlinkSync(metadata.filePath); // Deleted after first print
}, 3000);

// ✅ GOOD
// Files deleted ONLY by cleanup loop (on expiration)
```

---

### Pitfall 3: Using Component State for Global Flags

```javascript
// ❌ BAD
const [released, setReleased] = useState(false); // Blocks page refresh

// ✅ GOOD
const releasedInSession = React.useRef(false); // Session-level only
```

---

### Pitfall 4: Not Caching Documents

```javascript
// ❌ BAD
const job = printJobs.find(j => j.id === jobId);
// Re-fetch every time

// ✅ GOOD
const documentData = cachedDocument || serverJob?.document || ...;
```

---

## Debugging Tips

### 1. Check Server Logs
```bash
# Look for release tracking
[Release] Job abc123 released 1 time(s)
[Release] Job abc123 released 2 time(s)

# Look for cleanup
[Cleanup] Removing 5 expired print job(s)
[Cleanup] Deleted expired file: /path/to/file
```

### 2. Check Browser Console
```javascript
// Should see ONE release attempt (not duplicates)
console.log('Attempting to release...');

// Should see fallback message if API unavailable
console.warn('Server API not available, using client-side fallback');
```

### 3. Check Network Tab
```
POST /api/jobs/:id/release → 200 OK
Response: { "success": true, "releaseCount": 1 }

POST /api/jobs/:id/release (again) → 200 OK
Response: { "success": true, "releaseCount": 2 }
```

### 4. Check React DevTools
```
PrintRelease component
  ↳ releasingRef.current: false
  ↳ releasedInSession.current: true
  ↳ cachedDocument: { dataUrl: "data:...", ... }
```

---

## Maintenance

### Daily Tasks
- [ ] Monitor server logs for errors
- [ ] Check uploads directory size
- [ ] Review release count spikes

### Weekly Tasks
- [ ] Analyze release patterns (abuse detection)
- [ ] Verify cleanup is running
- [ ] Check for orphaned files

### Monthly Tasks
- [ ] Review and adjust default expiration time
- [ ] Optimize cleanup interval if needed
- [ ] Update documentation

---

## FAQ

### Q: Why not use a database for persistence?
**A:** Security requirement - in-memory only. Server restart should clear all active links.

### Q: What if user needs permanent link?
**A:** Not supported by design. Links are intentionally temporary (expiration enforced).

### Q: Can we increase the release count limit?
**A:** Yes, but monitor for abuse. Consider alerting on counts > 100.

### Q: What happens if cleanup fails?
**A:** Files orphaned on server. Manual cleanup may be needed:
```bash
find server/uploads -type f -mtime +1 -delete
```

### Q: How to handle server restart gracefully?
**A:** Inform users that active links will be lost. Consider pre-restart notification.

---

## Version History

- **v2.0** (2026-01-18): Multi-use support added
- **v1.0** (Previous): Single-use design (deprecated)

---

## Related Files

- `server/src/web/jobs.routes.js` - Backend API
- `src/pages/PrintRelease.js` - Frontend release UI
- `src/context/PrintJobContext.js` - State management
- `MULTI_USE_FIX_SUMMARY.md` - Implementation details
- `TEST_MULTI_USE.md` - Test suite

---

**Last Updated**: 2026-01-18  
**Maintainer**: Development Team
