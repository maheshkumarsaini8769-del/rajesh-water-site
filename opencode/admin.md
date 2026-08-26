I have a Rajesh Water Supply website with an admin panel at:

/admin.html

I want you to completely audit, fix, and improve the ADMIN PANEL without breaking any existing website functionality.

IMPORTANT:
Do NOT just modify the UI. Check the complete frontend + JavaScript + API/backend/database integration and make the admin panel actually functional.

==================================================
1. FIRST: COMPLETE AUDIT
==================================================

Before changing anything:

- Inspect the complete project structure.
- Find all files related to:
  - admin panel
  - products
  - orders
  - customers
  - inventory/stock
  - sales
  - purchases
  - reports
  - website content
  - settings
  - authentication
  - API/database
  - WhatsApp integration
- Check all JavaScript errors.
- Check all API calls.
- Check all database operations.
- Check localStorage/sessionStorage usage.
- Check authentication/security.
- Check responsive design.
- Check broken links/buttons/forms.
- Check console errors.
- Check network/API errors.

Do not assume that existing functionality works.

Fix the actual root cause instead of hiding errors.

==================================================
2. ADMIN LOGIN / SECURITY
==================================================

Fix the admin authentication system.

Requirements:

- Admin panel must not be publicly usable without authentication.
- Do NOT keep a real admin password/passcode directly inside frontend JavaScript.
- Do NOT expose secret API keys, database credentials, tokens, or WhatsApp credentials in frontend code.
- Use secure server-side authentication if backend is available.
- Store authentication securely.
- Add session expiration.
- Add Logout functionality.
- Prevent accessing admin pages after logout using browser back button.
- Protect admin APIs/server routes as well, not just admin.html.
- Never expose database credentials in client-side code.

If the current project architecture cannot support proper authentication, implement the safest practical architecture using the existing stack.

==================================================
3. FIX CHARACTER / ENCODING ISSUES
==================================================

Fix all text encoding problems.

For example:

"Rajesh Water â€” Admin Panel"

must display correctly as:

"Rajesh Water — Admin Panel"

Make sure:

- HTML uses UTF-8.
- All files are saved as UTF-8.
- Hindi/English text displays correctly.
- No mojibake characters such as:
  â€™
  â€œ
  â€”
  Ã
  etc.

==================================================
4. DASHBOARD
==================================================

Make the dashboard fully functional.

Dashboard should show real database values:

- Today's Sales
- Today's Orders
- Total Customers
- Total Products
- Low Stock Products
- Out of Stock Products
- Pending Orders
- Completed Orders
- Cancelled Orders
- Total Revenue
- Total Profit if data is available

Do NOT show fake hardcoded numbers.

If database is empty, show proper empty-state messages.

Add:

- Today's summary
- Sales trend
- Order trend
- Top selling products
- Low stock alerts
- Recent orders
- Recent activity

Dashboard data should refresh correctly.

==================================================
5. PRODUCTS
==================================================

Completely fix product management.

Admin must be able to:

- Add product
- Edit product
- Delete product
- Enable/disable product
- Change product name
- Change price
- Change description
- Change image
- Change category
- Change stock
- Change unit
- Change product visibility

Product changes must actually persist to the database.

Do NOT rely only on localStorage if the project has a backend/database.

When a product is deleted:

- Ask for confirmation.
- Prevent accidental deletion.
- Remove it from the website correctly.
- Do not leave broken product references.

When editing a product:

- Existing data must load correctly.
- Image preview must work.
- Save button must actually save.
- Show success/error message.

==================================================
6. INVENTORY / STOCK
==================================================

Fix inventory management.

Stock must remain synchronized with:

- Purchases
- Sales
- Orders
- Manual stock adjustments

Implement:

- Current stock
- Add stock
- Reduce stock
- Stock adjustment
- Low stock threshold
- Out-of-stock status
- Stock history

Prevent stock from becoming negative unless explicitly allowed.

Every stock adjustment should record:

- Product
- Quantity
- Previous stock
- New stock
- Reason
- Date/time

==================================================
7. ORDERS
==================================================

Make Online Orders fully functional.

Admin should be able to:

- View orders
- Search orders
- Filter orders
- Open order details
- Update order status
- Cancel order
- Delete only where appropriate
- View customer information
- View products in order
- View quantity
- View price
- View total
- View order date/time

Order statuses should be clearly handled, for example:

Pending
Confirmed
Processing
Out for Delivery
Delivered
Cancelled

When order status changes:

- Save it permanently.
- Update dashboard statistics.
- Update relevant stock logic.
- Do not deduct stock multiple times because of repeated status changes.

==================================================
8. CASH SALES
==================================================

Fix Cash Sales.

Admin should be able to record:

- Product
- Quantity
- Price
- Customer (optional)
- Discount
- Payment method
- Total
- Date/time

Cash sales should update:

- Sales history
- Dashboard sales
- Revenue
- Profit calculation if cost price exists
- Inventory

==================================================
9. SALES HISTORY
==================================================

Make Sales History functional.

Add:

- Search
- Date filter
- Product filter
- Customer filter
- Payment method filter
- Order type filter
- Sorting

Show:

- Invoice/order ID
- Date
- Customer
- Product
- Quantity
- Amount
- Payment method
- Profit if available

Add pagination if there are many records.

==================================================
10. PURCHASES
==================================================

Make Purchases functional.

Admin should be able to:

- Add purchase
- Select supplier
- Add products
- Enter quantity
- Enter purchase price
- Enter total
- Save purchase

When purchase is saved:

- Inventory should increase correctly.
- Purchase history should update.
- Profit calculation should use the correct cost price.

==================================================
11. PROFIT & REPORTS
==================================================

Fix all calculations.

Do NOT calculate profit using selling price alone.

If cost price exists:

Profit =
Selling Revenue - Cost of Goods Sold - applicable expenses

Clearly separate:

- Revenue
- Cost
- Gross Profit
- Expenses
- Net Profit

Add date filters:

- Today
- Yesterday
- Last 7 days
- Last 30 days
- This Month
- Custom Range

Reports must use actual database data.

Do not use hardcoded values.

==================================================
12. STOCK ALERTS
==================================================

Fix Stock Alerts.

Show:

- Low stock
- Out of stock
- Product name
- Current quantity
- Minimum stock threshold

Clicking an alert should open the relevant product.

Do not show false alerts.

==================================================
13. CUSTOMERS
==================================================

Fix customer management.

Show:

- Customer name
- Phone
- Address
- Total orders
- Total spending
- Last order
- Customer status

Add:

- Search
- Filter
- Customer details
- Order history

Do not expose unnecessary private customer information.

==================================================
14. WEBSITE CONTENT
==================================================

Make Website Content controls actually connected to the live website.

If admin changes:

- Banner
- Text
- Images
- Offers
- Product visibility
- Contact information
- Business information

then pressing SAVE must persist the change and the main website must use the updated data.

Do not create a fake "saved successfully" message if the backend save failed.

==================================================
15. BUSINESS SETTINGS
==================================================

Fix Business Settings.

Allow admin to manage appropriate business information such as:

- Business name
- Phone
- WhatsApp number
- Address
- Delivery settings
- Minimum order
- Business hours
- Other existing website settings

Validate all fields before saving.

==================================================
16. WHATSAPP / API SECURITY
==================================================

If WhatsApp Cloud API or any external API is used:

IMPORTANT:

- Never expose permanent API access tokens in frontend JavaScript.
- Never expose secrets in admin.html.
- Never put secrets inside public Vercel frontend environment variables.
- Move sensitive API calls to secure server-side/API routes.
- Validate requests server-side.

If an API token or phone ID is currently hardcoded anywhere in frontend code, identify it and move it to secure environment variables/server-side logic.

==================================================
17. DATABASE
==================================================

Check the complete database integration.

For every CRUD operation verify:

CREATE
READ
UPDATE
DELETE

Make sure:

- Data actually persists.
- Refreshing the page does not lose data.
- Multiple users/tabs do not create obvious data corruption.
- Errors are handled.
- Empty database works.
- Missing records do not crash the panel.

Do not silently fall back to fake/demo data.

==================================================
18. ERROR HANDLING
==================================================

Every important operation must have proper error handling.

For example:

- Product save failed
- Product delete failed
- Order update failed
- Database unavailable
- API unavailable
- Invalid form data
- Network error

Show the admin a clear message.

Never show:

"Saved successfully"

when the backend request actually failed.

==================================================
19. LOADING STATES
==================================================

Add proper loading states.

Examples:

- Loading dashboard...
- Saving product...
- Deleting product...
- Updating order...
- Loading orders...

Disable buttons during important requests to prevent duplicate submissions.

==================================================
20. CONFIRMATION / SAFETY
==================================================

For destructive actions:

- Delete product
- Delete customer
- Delete order
- Reset settings
- Clear data

show a confirmation dialog.

For important actions, clearly explain what will happen.

==================================================
21. RESPONSIVE DESIGN
==================================================

Fix admin panel for:

- Desktop
- Laptop
- Tablet
- Mobile

Check:

- Sidebar
- Header
- Cards
- Tables
- Forms
- Modals
- Buttons
- Charts
- Product images

On mobile:

- Sidebar should work properly.
- Tables should not destroy the layout.
- Buttons should remain usable.
- Forms should fit the screen.

==================================================
22. SIDEBAR / NAVIGATION
==================================================

Fix sidebar completely.

Every menu item must:

- Open the correct section/page.
- Highlight the active section.
- Work after refresh.
- Work on mobile.
- Not disappear unexpectedly.

Fix any issue where sidebar is not showing.

==================================================
23. SEARCH / FILTERS
==================================================

All search/filter controls must actually work.

Do not create UI controls that have no functionality.

Test:

- Product search
- Order search
- Customer search
- Date filters
- Stock filters
- Sales filters

==================================================
24. UI / UX
==================================================

Keep the existing premium Rajesh Water branding.

Improve:

- Spacing
- Typography
- Buttons
- Cards
- Tables
- Modal design
- Empty states
- Error states
- Success states
- Loading states

Do NOT unnecessarily redesign the entire website.

Keep the current visual identity unless something is clearly broken.

==================================================
25. PERFORMANCE
==================================================

Optimize:

- API calls
- Database queries
- Images
- JavaScript
- Rendering
- Large tables

Avoid unnecessary repeated API calls.

Use pagination for large datasets.

==================================================
26. VERCEL DEPLOYMENT
==================================================

The project is deployed on Vercel.

Make sure the final implementation works correctly on Vercel production.

Check:

- API routes
- Environment variables
- Serverless functions if used
- CORS
- Routing
- Static assets
- Database connection
- Production URLs

Do not use localhost URLs in production code.

==================================================
27. IMPORTANT: DO NOT BREAK EXISTING WEBSITE
==================================================

Before modifying shared files, understand how the public website works.

Do not break:

- Homepage
- Product display
- Product images
- Cart
- Checkout
- Orders
- WhatsApp integration
- Existing animations
- Existing responsive design

Admin changes should improve the system without destroying existing functionality.

==================================================
28. FINAL TEST
==================================================

After making changes, test the complete flow:

ADMIN LOGIN
↓
DASHBOARD
↓
ADD PRODUCT
↓
EDIT PRODUCT
↓
DELETE PRODUCT
↓
ADD STOCK
↓
CREATE PURCHASE
↓
CREATE CASH SALE
↓
CREATE ONLINE ORDER
↓
UPDATE ORDER STATUS
↓
CHECK INVENTORY
↓
CHECK SALES HISTORY
↓
CHECK PROFIT
↓
CHECK CUSTOMER
↓
EDIT WEBSITE CONTENT
↓
SAVE SETTINGS
↓
LOGOUT
↓
TRY ACCESSING ADMIN AGAIN

Fix every error found during testing.

==================================================
29. VERY IMPORTANT CODING RULE
==================================================

Do NOT simply tell me what is wrong.

Actually modify the project files and implement the fixes.

Do not leave TODO comments instead of implementing functionality.

Do not create fake/mock functionality.

Do not hardcode dashboard numbers.

Do not hardcode database records.

Do not hide errors with try/catch without fixing the underlying problem.

Do not remove existing functionality just because it is difficult to fix.

Reuse the existing project architecture where practical.

If a feature is impossible with the current architecture, explain the exact limitation and implement the safest practical solution.

==================================================
30. FINAL RESPONSE
==================================================

After fixing everything, give me:

1. List of problems found
2. Files changed
3. What was fixed
4. Database/API changes
5. Security improvements
6. Any environment variables I need to add
7. Any deployment steps required
8. Any remaining issues that cannot be fixed without additional credentials/services

Most importantly:

DO NOT CLAIM SOMETHING IS FIXED UNLESS YOU ACTUALLY VERIFIED IT.