You are working on my existing production website and admin panel.

IMPORTANT:
Do NOT create a fake/demo system.
Do NOT use dummy numbers.
Do NOT use hardcoded statistics.
Do NOT show simulated clicks, orders, WhatsApp clicks, sales, revenue, visitors, or analytics.

Your job is to inspect the ENTIRE existing project first, understand the current architecture, and then implement/fix the system without breaking existing functionality.

## 1. FULL PROJECT AUDIT FIRST

Before changing code:

* Inspect every relevant frontend file.
* Inspect every backend/API/serverless function.
* Inspect MongoDB connection and database structure.
* Inspect all existing admin panel pages.
* Inspect product/order/sales logic.
* Inspect WhatsApp order/message logic.
* Inspect authentication/authorization.
* Inspect analytics/tracking code.
* Inspect Vercel configuration/environment variables.
* Inspect all API routes.
* Inspect image/file upload logic.
* Inspect existing data relationships.

Do not assume how the project works.
Read the existing code and work with the existing architecture.

Find and fix:

* broken API calls
* incorrect database queries
* frontend/backend mismatches
* missing error handling
* incorrect calculations
* stale/hardcoded data
* broken buttons
* broken filters
* broken search
* broken admin actions
* duplicate records
* race conditions
* mobile layout issues
* authentication/security problems
* console errors
* network/API errors

Do not remove existing working functionality unnecessarily.

## 2. ADMIN PANEL MUST SHOW REAL DATA

Every important number displayed in the admin panel must come from the actual database or actual tracking system.

Examples:

Dashboard must calculate from real data:

* Total Orders
* Pending Orders
* Confirmed Orders
* Completed Orders
* Cancelled Orders
* Total Sales
* Today's Sales
* This Week's Sales
* This Month's Sales
* Number of Customers
* Product-wise Sales
* Product-wise Quantity
* Average Order Value
* Online Sales
* Offline Sales if the existing system supports it
* WhatsApp Clicks
* Website Visits if tracking exists
* Product Views if tracking exists

Never write:

const whatsappClicks = 124;

Never write:

const orders = 50;

Never use fake fallback values such as:

data?.orders || 100

Use real zero when real data is zero.

Example:

data?.orders ?? 0

but only when zero is genuinely the correct fallback.

## 3. REAL ORDER SYSTEM

Every order placed through the website must be stored correctly in MongoDB.

Each order should have, where applicable:

* unique order ID
* customer name
* phone number
* address
* products
* product IDs
* product names
* quantity
* product price at the time of purchase
* subtotal
* total amount
* order status
* payment method
* order source
* createdAt
* updatedAt

Do not calculate historical order prices from the current product price.

The order must retain the price that existed when the customer purchased the product.

## 4. REAL ADMIN ORDER ACTIONS

When admin clicks:

Confirm Order

the actual database order status must change.

When admin clicks:

Complete Order

the actual database must change.

When admin clicks:

Cancel Order

the actual database must change.

After every action:

1. update database
2. return success/error from backend
3. update admin UI from returned data
4. refresh/revalidate affected statistics
5. show a proper success/error message

Never make a button appear successful if the database update failed.

## 5. REAL WHATSAPP CLICK TRACKING

If the website has WhatsApp buttons, implement REAL tracking.

Do not count a WhatsApp click just because a page loaded.

When the user actually clicks the WhatsApp button:

1. record the click through a backend/API endpoint
2. store timestamp
3. store page/product/source where appropriate
4. optionally store device/session information if already supported and privacy-safe
5. then open WhatsApp

Example data:

{
type: "whatsapp_click",
productId: "...",
page: "...",
source: "...",
createdAt: new Date()
}

The admin dashboard must calculate WhatsApp clicks from these actual tracking records.

If tracking is impossible because of the current architecture, explain exactly why and implement the closest reliable production solution instead of faking the number.

## 6. REAL WEBSITE ANALYTICS

Do not invent website visitor numbers.

If website analytics already exists, connect the admin panel to the real analytics source.

If analytics does NOT currently exist, implement lightweight first-party tracking for events that the website can reliably measure, such as:

* page view
* product view
* WhatsApp click
* order started
* order completed
* important CTA click

Use a proper event collection API/database structure.

Do NOT claim that first-party tracking equals Google Analytics users if it does not.

Clearly distinguish:

* Page Views
* Unique Visitors/Sessions, if actually measurable
* Product Views
* WhatsApp Clicks
* Orders

## 7. MONTHLY ARCHIVE SYSTEM

Implement an automatic monthly archive system.

MongoDB should NOT be used as an unlimited historical storage dump if archival is required by this project.

Keep current operational data in MongoDB.

At the end of every month, archive that month's completed historical sales/order data into a monthly archive file.

Example:

archives/
2026/
01/
sales-2026-01.json
02/
sales-2026-02.json
03/
sales-2026-03.json
04/
sales-2026-04.json
05/
sales-2026-05.json
06/
sales-2026-06.json
07/
sales-2026-07.json
08/
sales-2026-08.json

Use a structured format that preserves all required historical information.

Prefer JSON for machine-readable archival.

CSV/Excel export can also be provided for human use.

## 8. DO NOT DEPEND ON A LAPTOP BEING ONLINE

The production website must continue working even when my laptop is turned off.

Therefore:

DO NOT design the production archive system so that the website requires my personal laptop to be online.

If the deployment platform does not provide persistent local filesystem storage, use proper persistent storage/object storage/database architecture.

If I specifically want a local laptop copy, create a separate backup/export mechanism that downloads or synchronizes monthly archive files to the laptop.

The website itself must not depend on that laptop.

## 9. ADMIN SALES HISTORY

Add a proper:

Sales History / Archive

section to the admin panel.

Show:

2026

* August
* July
* June
* May
  ...

When admin selects a month:

1. find the corresponding archive
2. open/read it
3. display the real historical information
4. calculate totals from that archive
5. allow filtering/searching
6. allow export/download

Do not load every historical record into MongoDB just to display history.

## 10. DATE SEARCH

Admin must be able to select:

From Date
To Date

Example:

01/05/2026 → 31/05/2026

The system should return the real records for that period from:

* current MongoDB data
* archived monthly data

depending on where the records currently live.

The admin should NOT need to know whether the data is in MongoDB or archive storage.

The UI should make this transparent.

## 11. MONTH-END ARCHIVE MUST BE SAFE

Never delete MongoDB data immediately after creating an archive.

Use this sequence:

1. identify eligible records
2. generate archive
3. validate archive
4. verify record count
5. verify totals
6. mark archive as successfully created
7. only then remove/move eligible records from active storage
8. keep an audit record

If archive creation fails:

DO NOT delete the MongoDB records.

This is extremely important.

## 12. DUPLICATE PROTECTION

The archive system must be idempotent.

Running the monthly archive process twice must NOT duplicate sales.

Use a unique archive identifier such as:

2026-08

and track archive status.

Example:

archivePeriod: "2026-08"
status: "completed"
recordCount: 1234
totalSales: 456789
createdAt: ...

## 13. AUTOMATIC MONTHLY PROCESS

If the deployment platform supports scheduled/cron jobs, use them.

For example:

Run shortly after the beginning of each new month.

The job should archive the previous month.

Example:

On September 1:

archive August 2026.

Do not rely on an admin remembering to press a button.

Also provide a manual:

"Archive Month"

button for administrators in case the scheduled job fails.

## 14. ARCHIVE VALIDATION

Before considering an archive successful, compare:

MongoDB eligible record count
vs
Archive record count

and:

MongoDB total sales
vs
Archive total sales

If they don't match:

* mark archive as failed
* keep original MongoDB records
* show the error in admin panel

Never silently lose data.

## 15. ADMIN DASHBOARD REAL-TIME REFRESH

When an order is:

* created
* confirmed
* completed
* cancelled

the dashboard statistics must update correctly.

Do not require the admin to manually edit numbers.

Use proper API revalidation/refetching.

If real-time WebSocket/SSE infrastructure already exists, use it.

Otherwise use reliable API refresh after mutations.

## 16. PRODUCT MANAGEMENT

Existing admin product management must work with the real database.

Admin should be able to:

* add product
* edit product
* delete/deactivate product
* change price
* change image
* update stock if stock exists
* update description
* update category if category exists

Changes made in admin must appear on the public website.

Do not maintain separate fake product data in frontend code.

The public website and admin panel must use the same source of truth.

## 17. HISTORICAL DATA SAFETY

Changing a product today must NOT change historical orders.

Example:

Product price:

August = ₹100

September = ₹120

August order must still show:

₹100

even after the product becomes ₹120.

Historical records must be immutable unless explicitly edited by an authorized admin.

## 18. SECURITY

Do not expose MongoDB credentials in frontend code.

Do not expose secret API keys.

Do not trust admin permissions from frontend JavaScript.

Every sensitive admin API must validate authorization on the server.

Validate all incoming data.

Prevent unauthorized order modification.

Prevent unauthorized product modification.

Prevent unauthorized archive deletion.

Prevent duplicate order submissions.

Use environment variables for secrets.

## 19. ERROR HANDLING

Every API must return proper success/error responses.

Frontend must handle:

* network failure
* database failure
* invalid input
* unauthorized access
* timeout
* missing records
* archive missing
* archive corruption
* duplicate request

Never show:

"Success"

when the backend actually failed.

Never leave buttons permanently stuck on loading.

## 20. NO FAKE FALLBACK SYSTEM

This is extremely important.

Do NOT solve missing backend data by creating fake data.

Do NOT use:

* random numbers
* static statistics
* hardcoded orders
* fake click counts
* demo customers
* fake revenue
* fake chart data

If real data is unavailable, show:

0

or:

"No data available"

depending on the situation.

## 21. PERFORMANCE

Do not load thousands of records into the browser at once.

Use:

* pagination
* server-side filtering
* date filtering
* indexed database queries
* aggregation pipelines where appropriate

Add appropriate MongoDB indexes for frequently queried fields such as:

* createdAt
* status
* orderId
* customer phone if needed
* productId if needed

Avoid N+1 database queries.

## 22. ADMIN UI

Keep the existing design unless a change is necessary.

Add a clean navigation structure such as:

Dashboard
Orders
Products
Customers
Sales
Analytics
Sales History
Archives
Settings

The dashboard should clearly distinguish:

CURRENT DATA

and

HISTORICAL DATA

Do not mix archived and active records incorrectly.

## 23. AUDIT LOG

Create an admin audit log for important actions:

* order status changed
* product created
* product updated
* product deleted
* archive created
* archive restored
* archive deletion
* important settings changed

Store:

* action
* admin/user identifier
* affected record
* timestamp

## 24. BACKUP

Do not treat monthly archives as the only backup.

Keep a reliable backup strategy.

If the platform supports automated backups/versioning, use it.

Do not delete the only copy of historical data.

## 25. TEST EVERYTHING

After implementation, test the complete flow.

Test:

1. customer opens website
2. customer views product
3. customer clicks WhatsApp
4. WhatsApp click is recorded
5. customer places order
6. order appears in MongoDB
7. admin sees order
8. admin confirms order
9. database status changes
10. dashboard updates
11. admin completes order
12. sales totals update
13. month archive is generated
14. archive count matches source
15. archive totals match source
16. historical month opens correctly
17. date filter works
18. product price changes do not modify old orders
19. failed archive does not delete source data
20. duplicate archive does not duplicate records
21. unauthorized API requests are rejected
22. mobile admin panel works
23. public website still works
24. all important buttons work
25. browser console has no avoidable errors
26. network requests have no avoidable failed API calls

## 26. DO NOT BREAK THE EXISTING WEBSITE

Before making changes, understand the current system.

After changes:

* preserve existing URLs/routes
* preserve existing product data
* preserve existing orders
* preserve existing images
* preserve existing functionality
* preserve existing design where possible

Do not rewrite the entire application unnecessarily.

## 27. FINAL VERIFICATION REPORT

After implementation, give me a clear report containing:

### Fixed

List every problem fixed.

### Added

List every new feature added.

### Database

Explain what collections/tables/indexes were added or changed.

### Archive

Explain exactly how monthly archival works.

### Analytics

Explain exactly which numbers are genuinely tracked and where they come from.

### Security

Explain what authentication/authorization protections were added.

### Testing

List the tests performed and their results.

### Remaining Issues

If anything cannot be made fully real because an external service/API/configuration is missing, clearly say:

* what is missing
* why it is required
* where I need to configure it
* exact environment variable/configuration name

Do NOT hide unresolved issues.

MOST IMPORTANT RULE:

The admin panel must be a REAL CONTROL PANEL for the REAL website.

If I click something in the admin panel, it must actually perform the corresponding operation in the backend/database.

If the dashboard displays a number, that number must come from real data.

If something cannot be made real, do not fake it. Tell me exactly what dependency is missing.

First inspect the existing project completely. Then implement the changes carefully. Do not start by blindly replacing files.
