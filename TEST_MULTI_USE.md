# Multi-Use Print Link Testing Guide

## Prerequisites
1. Backend server running on port 4000
2. Frontend dev server running on port 3000
3. Browser with developer tools open (for debugging)

---

## Test Suite 1: Basic Multi-Use Functionality

### Test 1.1: Submit and Auto-Release
**Steps:**
1. Login as `admin` (password: `admin123`)
2. Navigate to "Submit Print Job"
3. Upload a PDF file
4. Set expiration to 15 minutes
5. Submit the job
6. Copy the secure release link from the success message
7. Open the link in a new browser tab

**Expected Results:**
- ✅ Link opens without errors
- ✅ Auto-authentication occurs
- ✅ Job releases successfully
- ✅ Toast message: "Print job released successfully! You can print multiple times until the link expires."
- ✅ PDF opens in browser or print dialog appears

**Pass Criteria:**
- No "job not found" errors
- No red error toasts
- PDF prints successfully

---

### Test 1.2: Multiple Prints (Same Session)
**Steps:**
1. Complete Test 1.1 (link is now "released")
2. Close the print dialog (don't print yet)
3. Click the "Print" button in the UI
4. Click "Print" button again
5. Click "View" button, then "Print" from browser

**Expected Results:**
- ✅ Each print attempt succeeds
- ✅ No "already used" errors
- ✅ Document loads from cache (fast)
- ✅ Print dialog opens each time

**Pass Criteria:**
- Can print at least 3 times
- No errors in console
- No failed API calls

---

### Test 1.3: Page Refresh Re-Validation
**Steps:**
1. Complete Test 1.1 (link is released)
2. Refresh the browser page (F5)
3. Wait for page to reload
4. Check if document is still accessible

**Expected Results:**
- ✅ Page reloads without errors
- ✅ Link re-validates successfully
- ✅ Job data loads (may re-authenticate)
- ✅ Can print again

**Pass Criteria:**
- No "job not found" errors
- Link still works after refresh
- Document accessible

---

## Test Suite 2: Expiration Handling

### Test 2.1: Within Time Window
**Steps:**
1. Submit a job with 2-minute expiration
2. Copy release link
3. Open link → print successfully
4. Wait 30 seconds
5. Refresh page → try to print again
6. Wait another 30 seconds
7. Try to print again

**Expected Results:**
- ✅ All prints succeed within 2 minutes
- ✅ No expiration errors while valid
- ✅ Release count increments

**Pass Criteria:**
- Multiple releases work within time window
- No false expiration errors

---

### Test 2.2: After Expiration
**Steps:**
1. Submit a job with 1-minute expiration
2. Copy release link
3. Wait 65 seconds (past expiration)
4. Open the link

**Expected Results:**
- ✅ Link validation fails gracefully
- ✅ Toast message (INFO, not error): "This print link has expired"
- ✅ No red error toast
- ✅ Blue/neutral info message

**Pass Criteria:**
- Expiration detected correctly
- User-friendly message shown
- No confusing error messages

---

### Test 2.3: Cleanup Verification
**Steps:**
1. Submit a job with 1-minute expiration
2. Release it successfully
3. Wait 2 minutes (cleanup runs every 60 seconds)
4. Check server logs

**Expected Results:**
- ✅ Server log: `[Cleanup] Removing 1 expired print job(s)`
- ✅ Server log: `[Cleanup] Deleted expired file: /path/to/file`
- ✅ File removed from `server/uploads/` directory

**Pass Criteria:**
- Cleanup runs automatically
- Expired files deleted
- No orphaned files in uploads folder

---

## Test Suite 3: React StrictMode Handling

### Test 3.1: Development Mode Double Execution
**Steps:**
1. Ensure `npm start` is running (development mode)
2. Open React DevTools → Profiler
3. Submit a new job and copy link
4. Open link in new tab
5. Check console for duplicate API calls
6. Check Network tab for `/api/jobs/:id/release` calls

**Expected Results:**
- ✅ Only ONE release API call made (despite React rendering twice)
- ✅ No duplicate "Print job released" toasts
- ✅ `releasingRef` prevents duplicate execution

**Pass Criteria:**
- Console shows: "Attempting to release..." only ONCE
- Network tab shows: POST /api/jobs/:id/release only ONCE
- No duplicate toasts

---

## Test Suite 4: Error Handling

### Test 4.1: Invalid Token
**Steps:**
1. Submit a job and copy release link
2. Manually edit the URL token parameter to an invalid value
   - Example: `?token=invalid123`
3. Open the modified link

**Expected Results:**
- ✅ Validation fails
- ✅ Error toast: "Invalid token"
- ✅ Job not released

**Pass Criteria:**
- Invalid tokens rejected
- Clear error message

---

### Test 4.2: Server Restart (In-Memory Loss)
**Steps:**
1. Submit a job and copy release link
2. Release it successfully
3. Stop the backend server (`Ctrl+C`)
4. Restart the backend server (`cd server && npm start`)
5. Try to use the same link again

**Expected Results:**
- ✅ Server memory cleared (by design)
- ✅ API returns 404 or "Not found"
- ✅ Frontend shows: "Print job not found or expired"
- ✅ Info toast (not error) displayed

**Pass Criteria:**
- System handles server restart gracefully
- User informed that job is lost
- No crashes or exceptions

---

### Test 4.3: Network Error Fallback
**Steps:**
1. Submit a job (creates client-side copy)
2. Stop the backend server
3. Copy release link
4. Open link (should use client-side fallback)

**Expected Results:**
- ✅ API call fails
- ✅ System falls back to client-side validation
- ✅ Job still accessible from localStorage
- ✅ Console shows: "Server API not available, using client-side fallback"

**Pass Criteria:**
- Graceful degradation to client-side mode
- Job data from localStorage used
- No hard failures

---

## Test Suite 5: Cross-Browser Compatibility

### Test 5.1: Chrome
**Steps:**
1. Submit PDF job
2. Release via link
3. Try to print multiple times

**Expected Results:**
- ✅ PDF opens in Chrome PDF viewer
- ✅ Print dialog appears
- ✅ Multiple prints work

---

### Test 5.2: Firefox
**Steps:**
1. Submit PDF job
2. Release via link
3. Try to print multiple times

**Expected Results:**
- ✅ PDF opens in Firefox PDF viewer
- ✅ Print dialog appears
- ✅ Multiple prints work

---

### Test 5.3: Edge
**Steps:**
1. Submit PDF job
2. Release via link
3. Try to print multiple times

**Expected Results:**
- ✅ PDF opens in Edge PDF viewer
- ✅ Print dialog appears
- ✅ Multiple prints work

---

## Test Suite 6: Different File Types

### Test 6.1: PDF File
**Steps:**
1. Upload a PDF
2. Release and print multiple times

**Expected Results:**
- ✅ Opens in browser PDF viewer
- ✅ Print dialog works
- ✅ Multiple prints succeed

---

### Test 6.2: Image File (JPG/PNG)
**Steps:**
1. Upload an image
2. Release and print multiple times

**Expected Results:**
- ✅ Image displays in browser
- ✅ Print dialog works
- ✅ Multiple prints succeed

---

### Test 6.3: Text File
**Steps:**
1. Upload a .txt file
2. Release and print multiple times

**Expected Results:**
- ✅ Text content displayed
- ✅ Formatted properly
- ✅ Multiple prints succeed

---

### Test 6.4: Office Document (DOCX)
**Steps:**
1. Upload a .docx file
2. Release and try to print

**Expected Results:**
- ✅ File downloads or opens
- ✅ User informed to use native app
- ✅ Info toast shows guidance

---

## Test Suite 7: Security & Audit

### Test 7.1: Release Count Tracking
**Steps:**
1. Submit a job
2. Release it 3 times
3. Check server logs

**Expected Results:**
- ✅ Log shows: `[Release] Job {id} released 1 time(s)`
- ✅ Log shows: `[Release] Job {id} released 2 time(s)`
- ✅ Log shows: `[Release] Job {id} released 3 time(s)`

**Pass Criteria:**
- Audit trail maintained
- Release count increments correctly

---

### Test 7.2: Token Validation on Every Release
**Steps:**
1. Submit a job
2. Release with correct token → success
3. Try to release with wrong token → fail
4. Release with correct token again → success

**Expected Results:**
- ✅ Each release validates token
- ✅ Invalid tokens rejected every time
- ✅ Valid tokens accepted every time

**Pass Criteria:**
- Security not weakened by multi-use
- Token checked on EVERY release

---

## Test Suite 8: UI/UX Verification

### Test 8.1: Toast Messages
**Steps:**
1. Test various scenarios and observe toasts

**Expected Messages:**
- ✅ Success: "Print job released successfully! You can print multiple times until the link expires."
- ✅ Expiration: "This print link has expired" (INFO/blue)
- ✅ Invalid: "Invalid token" (ERROR/red)
- ✅ Network: "Failed to release print job: [reason]" (ERROR/red)

**Pass Criteria:**
- Expired links → INFO toast (not error)
- Invalid tokens → ERROR toast
- Success → SUCCESS toast with multi-use hint

---

### Test 8.2: Document Caching Indicator
**Steps:**
1. Release a job
2. Print once
3. Print again (should be faster)
4. Check Network tab

**Expected Results:**
- ✅ First print: API call to fetch document
- ✅ Second print: No API call (cached)
- ✅ Print happens instantly

**Pass Criteria:**
- Document cached after first release
- Subsequent prints use cache

---

## Test Suite 9: Edge Cases

### Test 9.1: Very Long Expiration
**Steps:**
1. Submit job with 1440-minute expiration (24 hours)
2. Release and print
3. Wait 5 minutes
4. Release and print again

**Expected Results:**
- ✅ Link remains valid
- ✅ Multiple releases work
- ✅ No false expiration

---

### Test 9.2: Multiple Users, Same Link
**Steps:**
1. User A submits a job
2. User A shares link with User B
3. User B opens link
4. User B releases and prints
5. User A tries to print again

**Expected Results:**
- ✅ Both users can use the link
- ✅ Authentication required for each user
- ✅ Multi-use works across users

---

### Test 9.3: Rapid Consecutive Releases
**Steps:**
1. Release a job
2. Immediately click "Release" button 3 times rapidly

**Expected Results:**
- ✅ `releasingRef` prevents duplicate calls
- ✅ Only one API call made
- ✅ No race conditions

**Pass Criteria:**
- Ref lock works correctly
- No duplicate API calls

---

## Automated Test Checklist

### Manual Verification Points
- [ ] No "Print job not found or expired" errors for valid links
- [ ] Links work multiple times within time window
- [ ] Page refresh doesn't break functionality
- [ ] React StrictMode doesn't cause duplicates
- [ ] Expired links show info toast (not error)
- [ ] Document caching works (faster subsequent prints)
- [ ] Server cleanup deletes expired files
- [ ] Release count tracked in logs
- [ ] Token validated on every release
- [ ] No status changes (job stays accessible)

---

## Regression Tests

### Ensure Old Functionality Still Works
- [ ] Job submission works
- [ ] Printer management works
- [ ] User authentication works
- [ ] Job queue displays correctly
- [ ] Dashboard statistics accurate
- [ ] Reports generation works

---

## Performance Benchmarks

### Metrics to Track
- [ ] First release: < 500ms response time
- [ ] Subsequent releases: < 300ms response time
- [ ] Document cache hit rate: > 90%
- [ ] Cleanup cycle: < 1 second for 100 expired jobs

---

## Sign-Off Checklist

### Before Deployment
- [ ] All test suites passed
- [ ] No console errors in production build
- [ ] Server logs clean (no unexpected errors)
- [ ] File cleanup verified (no orphaned files)
- [ ] Multi-browser testing complete
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Backwards compatibility verified

---

## Known Limitations (By Design)

1. **Server Restart**: In-memory metadata lost (jobs become inaccessible)
   - **Mitigation**: Inform users this is expected behavior
   
2. **LocalStorage Limit**: Client-side fallback limited to ~5-10MB
   - **Mitigation**: Warn users about large files
   
3. **Browser Cache**: Cached documents cleared on page close
   - **Mitigation**: Documents persist on server until expiration

---

## Troubleshooting Guide

### Issue: "Print job not found"
**Possible Causes:**
1. Server restarted (in-memory loss)
2. Link expired
3. Invalid token

**Solution:**
- Check server uptime
- Verify expiration time
- Validate token in URL

---

### Issue: Duplicate toasts
**Possible Causes:**
1. React StrictMode not handling refs
2. Multiple effect triggers

**Solution:**
- Check `releasingRef` implementation
- Verify effect dependencies

---

### Issue: Document not caching
**Possible Causes:**
1. State not updating
2. API not returning document data

**Solution:**
- Check `cachedDocument` state
- Verify API response includes `document` field

---

**Test Date**: ___________  
**Tester**: ___________  
**Environment**: Dev / Staging / Production  
**Result**: Pass / Fail  
**Notes**: ___________
