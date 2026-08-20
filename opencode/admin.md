Create a complete, professional **Admin Panel for a beverage/water distribution website**. Do not skip any requirement below. The admin panel must be fully functional, responsive, easy to use on mobile and desktop, and all calculations must update automatically.

## 1. Admin Dashboard Overview

Create a main dashboard showing today's business at a glance:

* Today's total sales
* Today's online sales
* Today's cash sales
* Today's total sales = Online + Cash
* Today's total purchase/investment amount
* Today's gross profit
* Today's number of orders
* Today's boxes sold
* Current total stock in boxes
* Total stock value in ₹
* Low-stock products count
* Out-of-stock products count

Also show comparison cards:

* Today
* This Week
* This Month
* All Time / Total

Each card should show the corresponding sales, cash sales, online sales, purchase value and profit.

## 2. Total Business / Capital Entry

Add an admin section where I can manually enter my available merchandise/inventory value.

Example:

* Total maal/inventory purchased: ₹50,000
* Current inventory value: ₹31,000
* Sold inventory value: ₹19,000
* Remaining sale value: ₹31,000

The system must automatically calculate:

**Remaining Stock Value = Total Purchased Stock Value - Cost Value of Sold Stock**

Do not confuse selling price with purchase/cost price.

Allow me to enter:

* Product
* Purchase price per box
* Selling price per box
* Quantity of boxes purchased
* Purchase date
* Supplier name (optional)
* Total purchase amount

Calculate total investment automatically.

## 3. Product Inventory / Stock Management

Create a complete inventory management section.

For every product store:

* Product name
* Brand
* Category
* Bottle size
* Bottle quantity per box
* Purchase price per box
* Selling price per box
* Current stock in boxes
* Current stock in individual bottles
* Minimum stock limit
* Total purchased boxes
* Total sold boxes
* Total remaining boxes
* Total purchase value
* Total sales value
* Total profit
* Product status

Example:

**Dew 1 Litre**

* Purchase: 20 boxes
* Sold: 12 boxes
* Remaining: 8 boxes
* Minimum stock: 10 boxes

Because remaining stock is below 10 boxes, automatically show:

**LOW STOCK — Dew 1 Litre only 8 boxes remaining.**

## 4. Box + Bottle Inventory

Inventory must support both:

### Box stock

Example:

Dew 1L = 8 boxes

### Individual bottle stock

If one box contains 12 bottles:

8 boxes × 12 = 96 bottles

Show:

* Boxes available
* Bottles available
* Total units available

If I sell one full box:

**Stock decreases by 1 box automatically.**

If I sell individual bottles:

**Bottle stock decreases according to quantity sold.**

If bottles are sold individually from a box, correctly calculate remaining bottles and equivalent box stock.

Never allow stock to become negative.

## 5. Online Sales Entry

Create an **Online Sale / Online Order** system.

Every online sale should record:

* Order ID
* Date
* Customer name
* Product
* Quantity
* Boxes sold
* Individual bottles sold
* Selling price
* Total sale amount
* Payment method
* Payment status
* Cost price
* Profit

When an online order is confirmed/completed:

1. Deduct stock automatically.
2. Add amount to online sales.
3. Add order to sales history.
4. Calculate profit.
5. Update today's/weekly/monthly/total analytics.
6. Update product inventory.
7. Check low-stock status.

Cancelled orders should NOT permanently reduce stock.

If an order is cancelled after stock was deducted, restore that stock.

## 6. Cash Sales Entry

Add a separate **Cash Sale Entry** option.

I should be able to manually enter cash sales even if the customer did not order through the website.

Fields:

* Date
* Product
* Quantity
* Boxes
* Bottles
* Selling price
* Total amount
* Cost price
* Profit
* Customer name (optional)
* Notes (optional)

Example:

Today I manually enter:

**Dew 1L — 3 boxes — Cash — ₹1,500**

The system must:

* Deduct 3 boxes from Dew stock.
* Add ₹1,500 to cash sales.
* Calculate the actual cost.
* Calculate profit.
* Update today's sales.
* Update weekly sales.
* Update monthly sales.
* Update total sales.
* Update remaining inventory.

## 7. Online + Cash Combined Sales

The dashboard must clearly separate:

**Online Sales**
₹4,000

**Cash Sales**
₹2,000

**Total Sales**
₹6,000

Formula:

**Total Sales = Online Sales + Cash Sales**

Do not mix the two payment types in the UI.

Allow filtering by:

* Online
* Cash
* All

## 8. Profit Calculation

Profit must be calculated using purchase/cost price, NOT simply total sales.

For every product:

**Profit per box = Selling Price - Purchase/Cost Price**

**Total Product Profit = Profit per Unit × Units Sold**

For example:

Purchase price = ₹800/box
Selling price = ₹1,000/box
Profit = ₹200/box

If 5 boxes are sold:

**Profit = ₹1,000**

Show:

* Today's profit
* Weekly profit
* Monthly profit
* Total profit
* Online profit
* Cash profit
* Product-wise profit

## 9. Example Business Calculation

The system must correctly handle a situation like:

Total merchandise/investment = ₹50,000

Sales made:

* Online sale = ₹2,000
* Online sale = ₹4,000
* Online sale = ₹19,000
* Cash sales = whatever is manually entered

Do NOT simply assume:

₹50,000 - ₹25,000 = profit.

Instead calculate:

* Total sales
* Cost of goods sold
* Remaining inventory cost
* Gross profit

Example:

If goods costing ₹15,000 were sold for ₹25,000:

**Sales = ₹25,000**
**Cost of sold goods = ₹15,000**
**Gross Profit = ₹10,000**

The remaining ₹35,000 cost value should remain as inventory.

## 10. Today's / Weekly / Monthly / Total Reports

Create date filters:

* Today
* Yesterday
* This Week
* This Month
* Last Month
* Custom Date Range
* All Time

For each period show:

* Total sales
* Online sales
* Cash sales
* Total cost of goods sold
* Gross profit
* Orders
* Boxes sold
* Bottles sold
* Products sold

Custom date range should allow selecting any start and end date.

## 11. Stock Low Alerts

Every product must have a configurable minimum stock level.

Default:

**10 boxes**

If stock becomes less than or equal to the minimum threshold, show a prominent alert.

Example:

⚠️ LOW STOCK

**Dew 1 Litre — Only 8 Boxes Left**

If stock reaches 0:

🔴 OUT OF STOCK

**Dew 1 Litre is currently out of stock.**

Show all low-stock products in a dedicated dashboard card and a dedicated inventory alert section.

The alert should update automatically whenever a sale happens.

## 12. Product-Wise Dashboard

Create a product performance section.

For each product show:

* Product name
* Current stock
* Boxes sold
* Bottles sold
* Total sales
* Cost
* Profit
* Profit margin
* Online sales
* Cash sales
* Stock status

Allow sorting by:

* Highest sales
* Highest profit
* Most sold
* Lowest stock
* Highest stock

## 13. Sales History

Create a complete sales table.

Columns:

* Date
* Order ID / Sale ID
* Product
* Quantity
* Boxes
* Bottles
* Payment type
* Sales amount
* Cost
* Profit
* Status

Filters:

* Date
* Product
* Cash / Online
* Completed / Cancelled
* Customer

Allow viewing individual sale details.

## 14. Purchase / Stock-In History

Create a section for adding new stock.

Example:

I purchase:

Dew 1L
10 boxes
Purchase price ₹800/box

The system should:

* Increase stock by 10 boxes.
* Increase inventory value by ₹8,000.
* Record purchase date.
* Record supplier if entered.
* Add the purchase to purchase history.

Purchase history should show:

* Date
* Product
* Boxes purchased
* Cost per box
* Total cost
* Supplier
* Notes

## 15. Inventory Value

Show two separate values:

### Cost Value of Current Inventory

What the remaining stock actually cost me.

### Potential Selling Value

How much money I can receive if the remaining stock is sold at the current selling price.

Example:

Current stock cost = ₹30,000

Potential selling value = ₹40,000

Expected gross profit from remaining stock = ₹10,000

Do NOT confuse inventory cost value with selling value.

## 16. Dashboard Charts

Add professional charts:

### Sales Chart

Show sales over:

* Daily
* Weekly
* Monthly

### Profit Chart

Show profit over time.

### Payment Chart

Compare:

* Cash
* Online

### Product Sales Chart

Show which products are selling the most.

### Inventory Chart

Show:

* Available stock
* Low stock
* Out of stock

Charts should update automatically from actual sales and inventory data.

## 17. Quick Action Buttons

At the top of the admin dashboard add:

* * Add Product
* * Add Stock
* * Cash Sale
* * Online Sale
* View Inventory
* View Orders
* View Reports

These should open the correct form/page instead of accidentally opening unrelated sections.

## 18. Low Stock Notification Center

Create a notification area in the dashboard.

Example:

⚠️ 3 products have low stock

1. Dew 1L — 8 boxes left
2. Pepsi 2.25L — 6 boxes left
3. Water 1L — 4 boxes left

Clicking a notification should open that product's inventory details.

Also show:

* Low stock count
* Out of stock count

## 19. Inventory Search

Add search functionality.

I should be able to search:

* Product name
* Brand
* Bottle size

Example:

Search "Dew"

It should immediately show:

Dew 1L
Dew 500ml
Dew 2.25L

## 20. Stock Adjustment

Create a controlled **Stock Adjustment** feature for cases such as:

* Damaged bottles
* Broken bottles
* Expired stock
* Missing stock
* Manual correction

Fields:

* Product
* Quantity
* Box/bottle
* Adjustment type
* Reason
* Date
* Notes

Every adjustment must be recorded in an audit/history log.

Do not silently change inventory.

## 21. Data Accuracy Rules

This is extremely important.

All numbers must come from the same underlying transaction/inventory data.

Do NOT maintain separate fake/manual totals for:

* Sales
* Profit
* Stock
* Online sales
* Cash sales

Instead calculate dashboard values from actual recorded transactions.

When a transaction changes, all related totals must update automatically.

Use proper decimal/₹ calculations and prevent negative stock.

## 22. Dashboard Example

The dashboard should visually look similar to:

**TODAY**

Total Sales: ₹6,000
Online: ₹4,000
Cash: ₹2,000
Profit: ₹1,500
Orders: 12
Boxes Sold: 18

**INVENTORY**

Total Boxes: 145
Inventory Cost Value: ₹1,20,000
Potential Selling Value: ₹1,55,000

**STOCK ALERTS**

⚠️ Dew 1L — 8 boxes left
⚠️ Water 1L — 7 boxes left
🔴 Pepsi 2.25L — Out of stock

**PERFORMANCE**

Today | This Week | This Month | Total

Each section should be clickable and open its detailed report.

## 23. Responsive Design

The admin panel must work perfectly on:

* Mobile
* Tablet
* Laptop
* Desktop

On mobile, use cards and horizontally scrollable tables where required.

Do not make the dashboard overcrowded.

Use a premium, clean admin UI with:

* Sidebar navigation
* Top header
* Dashboard cards
* Charts
* Tables
* Status badges
* Alert cards
* Search
* Filters
* Modal forms

## 24. Required Admin Navigation

Create these sections:

1. Dashboard
2. Products
3. Inventory
4. Add Stock
5. Cash Sales
6. Online Orders
7. Sales History
8. Purchases
9. Profit & Reports
10. Stock Alerts
11. Customers
12. Settings

## 25. Final Requirement

The entire system must work as a real inventory and sales management system, not just a visual UI.

If I add stock → inventory increases.

If I make an online sale → online sales increase + stock decreases + profit updates.

If I enter a cash sale → cash sales increase + stock decreases + profit updates.

If stock goes below 10 boxes → low-stock warning appears.

If stock becomes 0 → out-of-stock warning appears.

If I cancel an order → previously deducted stock is restored.

If I add new stock → inventory value and stock count increase.

If I change product cost/selling price → future calculations use the updated price while historical transactions retain their original transaction values.

All dashboard numbers, charts, reports, stock counts and profit calculations must remain synchronized automatically.

Build this with proper reusable components, clean data structure, validation, error handling and persistent data storage. Do not use hardcoded fake dashboard numbers after implementation.
