# GitHub Issues Batch - CarbonLedger Bounty

50 issues covering Smart Contracts, Backend, Frontend, UI/UX, and Documentation

---

## SMART CONTRACT ISSUES (15 issues)

### Issue 1: Add Reentrancy Guard to Carbon Credit Contract
**Labels:** `smart-contract` `security` `soroban`
**Priority:** High

**Overview:**
Although Soroban's execution model makes classic reentrancy hard, cross-contract calls to the token SAC could theoretically re-enter. Add a guard for defence-in-depth.

**Proposed Change:**
Use a temporary storage flag LOCK set before and cleared after token transfers. Return Reentrancy error if flag is set on entry.

**Acceptance Criteria:**
- [ ] Lock set/cleared correctly in create, claim, and cancel
- [ ] Test simulates reentrant call and expects Reentrancy error
- [ ] Flag uses temporary (non-persistent) storage

---

### Issue 2: Implement Serial Number Uniqueness Validation
**Labels:** `smart-contract` `carbon-registry` `validation`
**Priority:** Critical

**Overview:**
Serial numbers must be globally unique across all minted credits to prevent double-counting in the carbon registry.

**Proposed Change:**
Add a persistent Set data structure in carbon_registry contract to track all issued serial numbers. Validate uniqueness before minting and reject duplicates with error.

**Acceptance Criteria:**
- [ ] Serial number Set initialized in contract init
- [ ] mint_credits() checks Set before creating new credits
- [ ] Duplicate serial number attempt throws DuplicateSerial error
- [ ] Test covers duplicate detection across multiple batches

---

### Issue 3: Add Batch Retirement with Burn Verification
**Labels:** `smart-contract` `carbon-credit`
**Priority:** High

**Overview:**
Enable batch retirement of multiple credit serial numbers in a single transaction to reduce gas costs and improve UX.

**Proposed Change:**
Add retire_batch() function accepting Vec<String> of serial numbers. Verify ownership, burn tokens, and emit RetirementEvent for each.

**Acceptance Criteria:**
- [ ] retire_batch() processes multiple serials atomically
- [ ] Ownership verified for all credits before burning
- [ ] Individual RetirementEvent emitted per credit
- [ ] Partial failure rolled back entirely
- [ ] Gas optimization measured vs. individual retirements

---

### Issue 4: Implement Price Oracle Integration
**Labels:** `smart-contract` `carbon-oracle` `pricing`
**Priority:** High

**Overview:**
Carbon credits should have dynamic pricing based on methodology, vintage year, and market conditions via oracle feed.

**Proposed Change:**
Add get_credit_price(methodology, vintage) function that queries oracle contract for current price. Support fallback to last known price if oracle unavailable.

**Acceptance Criteria:**
- [ ] get_credit_price() retrieves from oracle_contract
- [ ] Price includes methodology + vintage components
- [ ] Fallback mechanism tested when oracle offline
- [ ] Price updates timestamped for audit trail

---

### Issue 5: Add Marketplace Escrow Contract
**Labels:** `smart-contract` `carbon-marketplace` `escrow`
**Priority:** High

**Overview:**
Secondary marketplace trades need atomic escrow to prevent buyer/seller disputes.

**Proposed Change:**
Create new carbon_escrow contract storing locked credits and USDC until both parties confirm. Release on mutual agreement or timeout refund.

**Acceptance Criteria:**
- [ ] escrow_deposit() locks credits + USDC
- [ ] release_escrow() requires both signatures OR timeout
- [ ] Timeout refunds both parties after 7 days
- [ ] Test covers happy path, single signature, and timeout scenarios

---

### Issue 6: Implement Role-Based Access Control (RBAC)
**Labels:** `smart-contract` `security` `access-control`
**Priority:** Critical

**Overview:**
Smart contracts need granular role support: Developer (mint only), Verifier (approve projects), Admin (configure).

**Proposed Change:**
Add roles storage map (address -> Role enum). Guard functions with require_role() macro. Define roles: DEVELOPER, VERIFIER, ADMIN.

**Acceptance Criteria:**
- [ ] Role enum defined with three variants
- [ ] require_role(addr, role) macro implemented
- [ ] All sensitive functions guarded (e.g., verify_project, set_price)
- [ ] Role assignment function admin-only with event emission
- [ ] Test unauthorized access attempts rejected

---

### Issue 7: Add Event Emission for Audit Trail
**Labels:** `smart-contract` `audit` `logging`
**Priority:** High

**Overview:**
All state transitions must emit events for transparent on-chain audit trail.

**Proposed Change:**
Define event types: CreditMinted, CreditRetired, ProjectVerified, PriceUpdated, RoleAssigned. Emit in all mutation functions.

**Acceptance Criteria:**
- [ ] Event enum with 10+ variants defined
- [ ] Every state change emits corresponding event
- [ ] Events include timestamp, actor, and affected data
- [ ] Backend can subscribe and index events
- [ ] Test verifies event emission for all paths

---

### Issue 8: Implement Credit Transfer with Restrictions
**Labels:** `smart-contract` `carbon-credit` `transfer`
**Priority:** High

**Overview:**
Credits should be transferable on marketplace but immutable once retired.

**Proposed Change:**
Add transfer_credits(to, serial_numbers) function. Check retirement status before allowing transfer. Prevent transfer of retired credits.

**Acceptance Criteria:**
- [ ] transfer_credits() validates all serials active
- [ ] Retired credits reject transfer with error
- [ ] Ownership updated in contract state
- [ ] TransferEvent emitted with from/to/serials
- [ ] Test covers active transfer, retired rejection

---

### Issue 9: Add Monitoring Data Validation
**Labels:** `smart-contract` `carbon-oracle` `validation`
**Priority:** Medium

**Overview:**
Oracle monitoring data (satellite imagery links, CO2 reduction data) needs validation before acceptance.

**Proposed Change:**
Add validate_monitoring_data() checking: URL format, data freshness (< 1 year old), and signature from authorized verifier.

**Acceptance Criteria:**
- [ ] URL validation regex for HTTPS links
- [ ] Timestamp check ensures < 365 days old
- [ ] Verifier signature verification using ed25519
- [ ] Invalid data rejected with ValidationError
- [ ] Test covers all validation paths

---

### Issue 10: Implement Batch Minting with Serial Number Generation
**Labels:** `smart-contract` `carbon-credit` `batch-operations`
**Priority:** High

**Overview:**
mint_credits() should generate deterministic serial numbers (hash of batch_id + credit_index).

**Proposed Change:**
Add internal generate_serial(batch_id, index) function using SHA-256 hash. Use in mint_credits() to auto-generate and store serials.

**Acceptance Criteria:**
- [ ] generate_serial() produces deterministic hashes
- [ ] Serials start with methodology prefix (e.g., "VCS-")
- [ ] No collisions in generated serials (test with 10k+ batch)
- [ ] Serial format consistent across all batches

---

### Issue 11: Add Contract Upgrade Pattern Support
**Labels:** `smart-contract` `deployment` `upgradability`
**Priority:** Medium

**Overview:**
Smart contracts need versioning for future upgrades without data loss.

**Proposed Change:**
Store contract_version in persistent storage. Add version check in init() to support migration scripts for future updates.

**Acceptance Criteria:**
- [ ] contract_version initialized in init()
- [ ] Version check prevents initialization twice
- [ ] Migration function template created for v2
- [ ] Mainnet readiness verified

---

### Issue 12: Implement Project Verification Workflow
**Labels:** `smart-contract` `carbon-registry` `workflow`
**Priority:** High

**Overview:**
Projects move through states: PENDING → VERIFIED → ACTIVE/INACTIVE.

**Proposed Change:**
Add ProjectStatus enum and status field to project storage. Implement state transition guards in verify_project(), activate(), deactivate().

**Acceptance Criteria:**
- [ ] ProjectStatus enum: PENDING, VERIFIED, ACTIVE, INACTIVE, REJECTED
- [ ] Only VERIFIED projects can mint credits
- [ ] Verifier-only state transitions
- [ ] Status change emits ProjectStatusChanged event
- [ ] Test covers all valid transitions and rejections

---

### Issue 13: Add Marketplace Listing Expiration
**Labels:** `smart-contract` `carbon-marketplace` `expiration`
**Priority:** Medium

**Overview:**
Marketplace listings should expire after 90 days to keep market fresh.

**Proposed Change:**
Add expires_at timestamp to listing. Check in purchase_credits(). Remove expired listings via cleanup_expired_listings() admin function.

**Acceptance Criteria:**
- [ ] Listing timestamp recorded on creation
- [ ] 90-day TTL enforced in purchase checks
- [ ] cleanup_expired_listings() removes expired entries
- [ ] Expired listing purchase attempt rejected
- [ ] Test covers expiration scenarios

---

### Issue 14: Implement Credit Fractional Ownership
**Labels:** `smart-contract` `carbon-credit` `fractional`
**Priority:** Low

**Overview:**
Allow splitting of credits for partial ownership (e.g., 0.5 credit per investor).

**Proposed Change:**
Add fractional_mint() supporting decimal amounts. Store fractional_balance map alongside serial registry.

**Acceptance Criteria:**
- [ ] Fractional amounts stored with 2 decimal precision
- [ ] Retirement requires full credit balance (no partial retire)
- [ ] Transfer works with fractional amounts
- [ ] Test covers split, combine, and retirement scenarios

---

### Issue 15: Add Contract Pause/Emergency Stop
**Labels:** `smart-contract` `security` `emergency`
**Priority:** High

**Overview:**
Admin should be able to pause contract in case of security vulnerability or emergency.

**Proposed Change:**
Add is_paused boolean flag. Check in all state-mutating functions. Implement pause()/unpause() admin functions.

**Acceptance Criteria:**
- [ ] is_paused flag initialized to false
- [ ] State-mutating calls rejected when paused (return Paused error)
- [ ] Query functions work when paused
- [ ] pause() and unpause() admin-only
- [ ] PausedEvent emitted on toggle

---

## BACKEND ISSUES (12 issues)

### Issue 16: Implement JWT Token Refresh Mechanism
**Labels:** `backend` `auth` `security`
**Priority:** High

**Overview:**
JWT tokens should have short expiry (15 min) with refresh token rotation for security.

**Proposed Change:**
Generate refresh_token on login; store in Redis. Exchange refresh_token for new access_token + new refresh_token. Invalidate old refresh_token.

**Acceptance Criteria:**
- [ ] access_token TTL: 15 minutes
- [ ] refresh_token TTL: 7 days
- [ ] /auth/refresh endpoint validates and rotates tokens
- [ ] Old refresh_token invalidated after use
- [ ] Test covers happy path and token reuse rejection

---

### Issue 17: Add Project Registration with Document Upload
**Labels:** `backend` `projects` `file-upload`
**Priority:** High

**Overview:**
Project registration requires uploading verification documents (Verra cert, methodology, etc.).

**Proposed Change:**
Add file upload endpoint POST /projects/register accepting multipart with verification_documents. Store in S3/GCS, link in Prisma.

**Acceptance Criteria:**
- [ ] Multipart form parsing implemented
- [ ] File type validation (PDF, PNG only)
- [ ] File size limit 10 MB
- [ ] Cloud storage link returned and saved in DB
- [ ] Test covers valid/invalid file types and sizes

---

### Issue 18: Implement Pagination for Marketplace Listings
**Labels:** `backend` `marketplace` `pagination`
**Priority:** Medium

**Overview:**
Marketplace listings endpoint needs pagination to avoid N+1 queries and support large datasets.

**Proposed Change:**
Add page, limit query params (default: page=1, limit=20). Return total_count, page, has_next in response. Use take/skip in Prisma.

**Acceptance Criteria:**
- [ ] GET /marketplace/listings supports page & limit
- [ ] Response includes total_count, page, has_next, has_prev
- [ ] Limit capped at 100 to prevent abuse
- [ ] Sorting by price, date, rating supported
- [ ] Test covers edge cases (page=0, limit=0, out of range)

---

### Issue 19: Add Credit Retirement Certificate Generation
**Labels:** `backend` `credits` `certificates`
**Priority:** High

**Overview:**
Generate downloadable retirement certificates with QR code linking to on-chain record.

**Proposed Change:**
Create /credits/:id/certificate endpoint. Generate PDF with credit details, company name, date, QR code. Return file or URL.

**Acceptance Criteria:**
- [ ] POST /credits/retire returns certificate_url
- [ ] QR code encodes serial + blockchain proof link
- [ ] PDF includes: credit serial, project name, company, retirement date
- [ ] Certificate accessible via certificate_url for 30 days
- [ ] Test covers PDF generation and QR code encoding

---

### Issue 20: Implement Rate Limiting per User Role
**Labels:** `backend` `security` `rate-limiting`
**Priority:** High

**Overview:**
Rate limits should be stricter for public endpoints, relaxed for premium users.

**Proposed Change:**
Use Redis with role-based buckets: PUBLIC (10 req/min), USER (100 req/min), PREMIUM (1000 req/min). Implement middleware.

**Acceptance Criteria:**
- [ ] Rate limit middleware checks role and enforces limits
- [ ] 429 response with Retry-After header when exceeded
- [ ] Redis key format: `rate_limit:{userId}:{endpoint}`
- [ ] Test simulates multiple requests and confirms 429

---

### Issue 21: Add Monitoring Data Ingestion Pipeline
**Labels:** `backend` `oracle` `data-pipeline`
**Priority:** High

**Overview:**
Backend should ingest monitoring data from satellite providers and validate before storing.

**Proposed Change:**
Create POST /oracle/monitoring endpoint accepting JSON: project_id, satellite_provider, url, co2_reduction_mmt, timestamp. Validate and store in DB.

**Acceptance Criteria:**
- [ ] Endpoint validates data schema and timestamp freshness
- [ ] Verifier-only access (guarded by roles)
- [ ] Duplicate check prevents re-submitting same data
- [ ] MonitoringData stored with created_at and verified_by
- [ ] Test covers valid data, missing fields, and duplicates

---

### Issue 22: Implement Search Index for Serial Numbers
**Labels:** `backend` `search` `performance`
**Priority:** Medium

**Overview:**
Searching serial numbers in database is slow; add full-text search index.

**Proposed Change:**
Add DB index on credits.serial_number. Implement GET /credits/search?serial=VCS-123 endpoint using indexed query.

**Acceptance Criteria:**
- [ ] Serial number field indexed in Prisma schema
- [ ] Search returns credit details + project + retired status
- [ ] Partial match supported (e.g., "VCS" returns all VCS credits)
- [ ] Query time < 100ms for dataset of 100k+ records
- [ ] Test covers exact and partial matches

---

### Issue 23: Add API Request Logging and Monitoring
**Labels:** `backend` `logging` `monitoring`
**Priority:** Medium

**Overview:**
All API requests should be logged with timestamp, endpoint, status, response time, and user ID for debugging.

**Proposed Change:**
Implement NestJS middleware logging to structured JSON. Include: timestamp, method, path, status, duration_ms, user_id, error message.

**Acceptance Criteria:**
- [ ] Middleware logs all requests before response
- [ ] Logs include method, path, status code, duration
- [ ] User ID included when authenticated
- [ ] Logs written to stdout in JSON format
- [ ] Test verifies log output format

---

### Issue 24: Implement CORS Configuration
**Labels:** `backend` `security` `cors`
**Priority:** High

**Overview:**
Frontend on different domain needs CORS headers for cross-origin requests.

**Proposed Change:**
Configure CORS in main.ts: allow frontend URL, methods (GET, POST, PUT, DELETE), credentials=true.

**Acceptance Criteria:**
- [ ] CORS enabled for frontend domain
- [ ] Credentials allowed (cookies/auth headers)
- [ ] Preflight requests handled
- [ ] Test frontend can make cross-origin requests

---

### Issue 25: Add Database Migration for Audit Log Table
**Labels:** `backend` `database` `migrations`
**Priority:** Medium

**Overview:**
Create audit_logs table to track all sensitive operations (delete, role change, etc.).

**Proposed Change:**
Add Prisma migration: CREATE TABLE audit_logs with: id, actor_id, action, resource_type, resource_id, timestamp, details JSON.

**Acceptance Criteria:**
- [ ] Migration created and tested
- [ ] audit_logs table has correct schema
- [ ] Backwards compatible (no data loss)
- [ ] Test migration up and down

---

### Issue 26: Implement Wallet Connection Endpoint
**Labels:** `backend` `auth` `wallet`
**Priority:** High

**Overview:**
Backend should validate Freighter wallet signatures for authentication.

**Proposed Change:**
Add POST /auth/wallet-login accepting signature and public_key. Verify signature against server nonce. Return JWT.

**Acceptance Criteria:**
- [ ] Server nonce generation and storage in Redis
- [ ] Signature verification using Stellar SDK
- [ ] JWT issued on successful verification
- [ ] Nonce invalidated after use
- [ ] Test covers valid/invalid signatures

---

### Issue 27: Add Database Connection Pooling
**Labels:** `backend` `database` `performance`
**Priority:** Medium

**Overview:**
Configure Prisma connection pooling to handle concurrent requests efficiently.

**Proposed Change:**
Set datasource.url with connection_limit and idle_timeout in .env. Configure PrismaService singleton.

**Acceptance Criteria:**
- [ ] connection_limit set to 20
- [ ] idle_timeout set to 900 (15 min)
- [ ] PrismaService managed as singleton
- [ ] Load test verifies connection stability

---

## FRONTEND ISSUES (12 issues)

### Issue 28: Implement Project Browser with Filters
**Labels:** `frontend` `projects` `filtering`
**Priority:** High

**Overview:**
Users need to browse projects with filters: country, methodology, vintage year, status.

**Proposed Change:**
Create /projects page with SideFilter component. Implement client-side filtering with query params: ?country=India&methodology=VCS. Use SWR for data fetching.

**Acceptance Criteria:**
- [ ] Filter component displays country, methodology, vintage filters
- [ ] URL params sync with filter state
- [ ] Project cards show: name, location, methodology, vintage, mint year
- [ ] Search by project name supported
- [ ] Test filter interactions and URL params

---

### Issue 29: Build Marketplace Trading Interface
**Labels:** `frontend` `marketplace` `trading`
**Priority:** Critical

**Overview:**
Create interactive marketplace where users can browse, filter, and purchase credits.

**Proposed Change:**
Add /marketplace page with ListingsGrid component. Show: credit details, price, vintage, carbon reduction. Add to cart, purchase flow with Freighter confirmation.

**Acceptance Criteria:**
- [ ] Listings grid displays 10+ credits with images
- [ ] Sort by: price, date listed, popularity
- [ ] Add to cart functionality
- [ ] Purchase flow with Freighter wallet connection
- [ ] Transaction confirmation and status tracking
- [ ] Mobile responsive layout

---

### Issue 30: Create Retirement Certificate Download
**Labels:** `frontend` `certificates` `pdf-export`
**Priority:** High

**Overview:**
After retirement, users should download a shareable certificate with QR code.

**Proposed Change:**
Add modal/page for retired credits with: company name input, beneficiary (optional), download PDF button. Use html2canvas + jspdf for client-side rendering.

**Acceptance Criteria:**
- [ ] Input fields for company name and beneficiary
- [ ] Certificate preview with glassmorphism design
- [ ] PDF download button with file naming: `retirement_cert_{serial}_{date}.pdf`
- [ ] QR code embedded in PDF linking to blockchain proof
- [ ] Mobile friendly certificate layout

---

### Issue 31: Build Public Audit Trail Explorer
**Labels:** `frontend` `audit` `explorer`
**Priority:** High

**Overview:**
Public page showing transaction history for transparency: mints, transfers, retirements.

**Proposed Change:**
Create /audit page with search by serial number. Results show timeline: mint → transfers → retirement with dates and parties involved.

**Acceptance Criteria:**
- [ ] Serial number search input with autocomplete
- [ ] Timeline visualization with cards for each event
- [ ] Event details: type, date, parties, transaction ID
- [ ] External link to Stellar testnet/mainnet explorer
- [ ] Filter by event type (mint, transfer, retire)
- [ ] Mobile responsive timeline

---

### Issue 32: Implement User Dashboard
**Labels:** `frontend` `dashboard` `user-profile`
**Priority:** High

**Overview:**
Users need personalized dashboard showing: owned credits, retired credits, portfolio stats, transaction history.

**Proposed Change:**
Create /dashboard page with panels: Credits Owned (count, total value), Credits Retired (count, carbon offset), Recent Transactions (table), Portfolio Breakdown (pie chart).

**Acceptance Criteria:**
- [ ] Fetch user credits via /api/v1/credits/my-credits
- [ ] Display owned, pending, retired credit counts
- [ ] Portfolio value calculated from market prices
- [ ] Recent transactions table with pagination
- [ ] Carbon offset calculator showing total CO2 prevented
- [ ] Mobile responsive cards

---

### Issue 33: Add Freighter Wallet Integration
**Labels:** `frontend` `wallet` `auth`
**Priority:** Critical

**Overview:**
Users must connect Freighter wallet to authenticate and perform transactions.

**Proposed Change:**
Create useFreighter() hook detecting wallet, requesting permissions, returning account and signTransaction function. Add connect button in header.

**Acceptance Criteria:**
- [ ] Freighter detection and permission request
- [ ] Account display (public key abbreviated)
- [ ] Disconnect button
- [ ] signTransaction() for contract calls
- [ ] Error handling for rejected/unavailable wallet
- [ ] Test wallet connection flow

---

### Issue 34: Build Advanced Filtering with Refinement
**Labels:** `frontend` `filtering` `search`
**Priority:** Medium

**Overview:**
Marketplace should support faceted search with refinements like price range, carbon reduction amount, verifier.

**Proposed Change:**
Add RefinementPanel component with sliders: Price (0-1000), Carbon Reduction (0-1M tCO2), Vintage (year range). Apply filters via query params.

**Acceptance Criteria:**
- [ ] Slider components for price and carbon reduction
- [ ] Date range picker for vintage years
- [ ] Multi-select for verifier (Verra, Gold Standard)
- [ ] Filter state persists in URL
- [ ] Results update dynamically
- [ ] "Clear all filters" button

---

### Issue 35: Create Project Verification Workflow UI
**Labels:** `frontend` `verifier-workspace` `workflow`
**Priority:** High

**Overview:**
Verifiers need interface to review and approve pending projects.

**Proposed Change:**
Add /verify page (verifier-only) showing pending projects in card format. Each card has: project details, verification docs, approve/reject buttons.

**Acceptance Criteria:**
- [ ] List of pending projects with status badges
- [ ] Project detail modal: name, location, methodology, documents
- [ ] Download verification documents (PDF links)
- [ ] Approve button → marks as VERIFIED in smart contract
- [ ] Reject button → reason input, marks as REJECTED
- [ ] Audit log showing verifier actions

---

### Issue 36: Implement Batch Credit Operations
**Labels:** `frontend` `batch-operations` `ux`
**Priority:** Medium

**Overview:**
Users with large portfolios need to retire/transfer multiple credits at once.

**Proposed Change:**
Add multi-select to credits table. Selection shows batch action bar: "Retire All Selected" button. Confirm dialog then submit to /api/v1/credits/retire-batch.

**Acceptance Criteria:**
- [ ] Checkbox column in credits table
- [ ] Batch action bar appears when items selected
- [ ] Select All/Deselect All functionality
- [ ] Confirmation modal before batch action
- [ ] Progress indicator during batch operation
- [ ] Success message with count of retired/transferred

---

### Issue 37: Add Real-Time Transaction Status Tracking
**Labels:** `frontend` `realtime` `transactions`
**Priority:** High

**Overview:**
Users should see real-time updates when transactions are pending, confirmed, or failed.

**Proposed Change:**
Use WebSocket or polling to fetch transaction status. Show toasts/modals: "Transaction pending...", "Confirmed!", "Failed - Try again".

**Acceptance Criteria:**
- [ ] WebSocket connection to /api/v1/transactions/stream
- [ ] TransactionStatus enum: PENDING, CONFIRMED, FAILED
- [ ] Toast notifications for status updates
- [ ] Fallback to polling if WebSocket unavailable
- [ ] Test transaction lifecycle notifications

---

### Issue 38: Build Responsive Mobile Layout
**Labels:** `frontend` `mobile` `responsive`
**Priority:** High

**Overview:**
Frontend must be fully responsive for mobile (iOS Safari, Android Chrome).

**Proposed Change:**
Test all pages on mobile viewports. Fix: stacked layouts, touch-friendly buttons (48px min), mobile-optimized navigation drawer.

**Acceptance Criteria:**
- [ ] All pages tested on iPhone 12 (390px) and iPad (768px)
- [ ] Touch targets minimum 48x48px
- [ ] Mobile navigation drawer or bottom nav
- [ ] Forms optimized for mobile input
- [ ] Images lazy-loaded on mobile
- [ ] Lighthouse mobile score > 85

---

## UI/UX ISSUES (8 issues)

### Issue 39: Design Glassmorphism Component Library
**Labels:** `design` `ui` `components`
**Priority:** High

**Overview:**
Create reusable glassmorphism design components: cards, panels, modals using frosted glass effect.

**Proposed Change:**
Build Storybook library with: GlassCard, GlassPanel, GlassModal using CSS backdrop-filter. Document usage, color palette (emerald/green accents on charcoal).

**Acceptance Criteria:**
- [ ] Storybook project created with 10+ components
- [ ] Components use emerald accent (#10b981) and charcoal background (#1f2937)
- [ ] Backdrop blur (10px) and opacity consistent
- [ ] Design system doc with usage guidelines
- [ ] Dark mode support
- [ ] Accessibility (contrast ratio 4.5:1)

---

### Issue 40: Create Carbon Market Education Tooltips
**Labels:** `ui/ux` `education` `onboarding`
**Priority:** Medium

**Overview:**
Users need in-app education on carbon credits, methodologies, and retirement process.

**Proposed Change:**
Add Tooltip components with explanations: "What is VCS?", "Vintage Year explains: credits from this harvest year", "Retirement is permanent...".

**Acceptance Criteria:**
- [ ] Tooltips on all key terms (methodology, vintage, serial, retired)
- [ ] Educational modals on first-time actions
- [ ] Glossary page with all carbon credit terms
- [ ] Info icons clickable with help content
- [ ] Onboarding carousel for new users

---

### Issue 41: Implement Dark Mode Toggle
**Labels:** `design` `theme` `accessibility`
**Priority:** Medium

**Overview:**
Dark mode support for reduced eye strain and battery savings.

**Proposed Change:**
Use next-themes library. Add theme toggle in header. Store preference in localStorage. Update Tailwind config with dark: variant.

**Acceptance Criteria:**
- [ ] Theme toggle button in navigation
- [ ] Preference persists across sessions
- [ ] All pages tested in both modes
- [ ] Contrast ratios maintained (4.5:1)
- [ ] Glassmorphism effect works in dark mode

---

### Issue 42: Create Interactive Carbon Offset Calculator
**Labels:** `ui/ux` `calculator` `education`
**Priority:** Medium

**Overview:**
Visual calculator showing CO2 equivalent: "Your retired credits = X trees planted = Y cars off road for 1 year".

**Proposed Change:**
Add standalone calculator component. Input: number of credits, return: equivalent trees, cars, flights avoided. Add to dashboard and public page.

**Acceptance Criteria:**
- [ ] Input field for credit count
- [ ] Visual representations: trees, cars, flights
- [ ] Formula documented and sourced
- [ ] Shareable results (copy to clipboard)
- [ ] Mobile responsive design

---

### Issue 43: Design Onboarding Flow for New Users
**Labels:** `ui/ux` `onboarding` `flow`
**Priority:** High

**Overview:**
New users need step-by-step guidance: wallet connect → profile setup → first credit purchase.

**Proposed Change:**
Create OnboardingFlow component with 5 steps: Connect Wallet, Create Profile, Browse Projects, Buy Credit, Retire & Get Certificate. Use Framer Motion for animations.

**Acceptance Criteria:**
- [ ] 5-step flow with progress bar
- [ ] Smooth animations between steps
- [ ] Back/Next buttons with validation
- [ ] Skip option for experienced users
- [ ] Completion celebration animation
- [ ] Test on desktop and mobile

---

### Issue 44: Implement Loading States and Skeletons
**Labels:** `ui/ux` `loading` `ux-improvement`
**Priority:** Medium

**Overview:**
Pages should show skeleton loaders during data fetching to reduce perceived wait time.

**Proposed Change:**
Create Skeleton component mimicking target layout. Use in: ProjectsList, MarketplaceListings, Dashboard. Show skeletons until data loaded.

**Acceptance Criteria:**
- [ ] Skeleton components for cards, tables, grids
- [ ] Shimmer animation for visual feedback
- [ ] Skeleton matches target layout dimensions
- [ ] Fallback for failed requests
- [ ] Test loading states with network throttling

---

### Issue 45: Create Error Boundary with User-Friendly Messages
**Labels:** `frontend` `error-handling` `ux`
**Priority:** Medium

**Overview:**
App errors should display friendly messages instead of crashes.

**Proposed Change:**
Implement React ErrorBoundary component. Catch errors, log to Sentry, display: error message, "Try Again" button, contact support link.

**Acceptance Criteria:**
- [ ] ErrorBoundary wraps entire app
- [ ] Errors logged to Sentry with context
- [ ] User sees friendly message (not stack trace)
- [ ] Try Again button resets state
- [ ] Support contact info displayed
- [ ] Test boundary catches child errors

---

### Issue 46: Design Accessibility Audit Checklist
**Labels:** `design` `accessibility` `audit`
**Priority:** High

**Overview:**
Ensure app meets WCAG 2.1 AA standards.

**Proposed Change:**
Create checklist: keyboard navigation, screen reader testing, color contrast, form labels, ARIA attributes. Document findings and remediation.

**Acceptance Criteria:**
- [ ] Keyboard navigation tested (Tab, Enter, Esc)
- [ ] Screen reader testing with NVDA/JAWS
- [ ] Color contrast verified (4.5:1 normal, 3:1 large)
- [ ] All form inputs have labels
- [ ] ARIA attributes for complex components
- [ ] Audit report generated

---

## DOCUMENTATION ISSUES (3 issues)

### Issue 47: Write API Documentation with OpenAPI Spec
**Labels:** `documentation` `api` `openapi`
**Priority:** High

**Overview:**
API endpoints need comprehensive documentation with request/response examples.

**Proposed Change:**
Create docs/API.md with OpenAPI 3.0 spec. Include: endpoints, parameters, responses, error codes. Generate Swagger UI at /api-docs.

**Acceptance Criteria:**
- [ ] OpenAPI spec covers all endpoints
- [ ] Request/response examples for each endpoint
- [ ] Error responses documented (400, 401, 403, 500)
- [ ] Authentication (JWT) explained
- [ ] Pagination format documented
- [ ] Swagger UI accessible and functional

---

### Issue 48: Create Smart Contract Development Guide
**Labels:** `documentation` `smart-contracts` `guide`
**Priority:** High

**Overview:**
Developers need step-by-step guide to build and test Soroban contracts.

**Proposed Change:**
Write docs/SMART_CONTRACTS.md covering: setup, contract structure, testing, deployment. Include example: minting 100 credits.

**Acceptance Criteria:**
- [ ] Prerequisites listed (Rust, stellar-cli)
- [ ] Project structure explained
- [ ] Testing framework setup (cargo test)
- [ ] Testnet deployment steps
- [ ] Example mint() call with code
- [ ] Troubleshooting section

---

### Issue 49: Create Frontend Component Documentation
**Labels:** `documentation` `frontend` `components`
**Priority:** Medium

**Overview:**
Frontend developers need reference for available components, props, and usage patterns.

**Proposed Change:**
Document in Storybook: GlassCard, ProjectCard, MarketplaceListing, RetirementCertificate, etc. Include props, examples, dark mode.

**Acceptance Criteria:**
- [ ] 20+ components documented
- [ ] Props table for each component
- [ ] Live code examples in Storybook
- [ ] Dark mode variants shown
- [ ] Accessibility notes included
- [ ] Design system color palette documented

---

### Issue 50: Write Deployment and Runbook for Production
**Labels:** `documentation` `deployment` `runbook`
**Priority:** Critical

**Overview:**
Operations team needs clear steps for deploying to Stellar mainnet.

**Proposed Change:**
Create docs/MAINNET_DEPLOYMENT.md with: environment setup, contract deployment, database migrations, health checks, rollback procedure.

**Acceptance Criteria:**
- [ ] Mainnet environment variables documented
- [ ] Contract deployment sequence documented
- [ ] Database migration steps
- [ ] Health check endpoints listed
- [ ] Monitoring setup (e.g., error logs)
- [ ] Rollback procedures for each component
- [ ] Pre-deployment checklist

---

## END OF ISSUES BATCH

Total: 50 issues
- Smart Contracts: 15 issues
- Backend: 12 issues
- Frontend: 12 issues
- UI/UX: 8 issues
- Documentation: 3 issues
