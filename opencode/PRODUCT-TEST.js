// DEBUG SCRIPT - Add this to check if products are loading

console.log("=== PRODUCT DEBUG ===");

// Check if products array exists
var products = [
    { id:"w200", name:"200ml Water Box", category:"Water", brand:"Aqualine", type:"bottle", size:"200ml", box:"48 Bottles", price:450, desc:"Ideal for large gatherings", img:"images/bottle-new-1.png", cat:"water", avail:true, best:false },
    { id:"w500", name:"500ml Water Box", category:"Water", brand:"Aqualine", type:"bottle", size:"500ml", box:"24 Bottles", price:380, desc:"Perfect for daily office use", img:"images/bottle-v2-2.png", cat:"water", avail:true, best:true },
    { id:"w1l", name:"1L Water Box", category:"Water", brand:"Aqualine", type:"bottle", size:"1L", box:"12 Bottles", price:320, desc:"Premium dining companion", img:"images/delivery-3.png", cat:"water", avail:true, best:false },
    { id:"w2l", name:"2L Water Box", category:"Water", brand:"Aqualine", type:"bottle", size:"2L", box:"6 Bottles", price:280, desc:"Built for heavy residential use", img:"images/bottle-new-4.png", cat:"water", avail:true, best:false },
    { id:"c250", name:"Cola 250ml Bottle Box", category:"Cola", brand:"Cola", type:"bottle", size:"250ml", box:"24 Bottles", price:560, desc:"Classic cola refreshment", img:"images/coke.png", cat:"cold", avail:true, best:true },
    { id:"c500", name:"Cola 500ml Bottle Box", category:"Cola", brand:"Cola", type:"bottle", size:"500ml", box:"12 Bottles", price:620, desc:"Family-size chilled cola", img:"images/coke.png", cat:"cold", avail:true, best:false },
    { id:"ll250", name:"Lemon-Lime 250ml Bottle Box", category:"Lemon-Lime", brand:"Lemon-Lime", type:"bottle", size:"250ml", box:"24 Bottles", price:540, desc:"Crisp citrus fizz", img:"images/sprite.png", cat:"cold", avail:true, best:false },
    { id:"o250", name:"Orange 250ml Bottle Box", category:"Orange", brand:"Orange", type:"bottle", size:"250ml", box:"24 Bottles", price:540, desc:"Sunny orange soda", img:"images/fanta.png", cat:"cold", avail:true, best:false },
    { id:"d250", name:"Citrus 250ml Bottle Box", category:"Citrus", brand:"Citrus", type:"bottle", size:"250ml", box:"24 Bottles", price:550, desc:"Bold citrus energy", img:"images/dew.png", cat:"cold", avail:false, best:false },
    { id:"cc300", name:"Cola 300ml Can Box", category:"Cola", brand:"Cola", type:"can", size:"300ml", box:"24 Cans", price:640, desc:"Sleek can, chilled cola", img:"images/coke.png", cat:"cold", avail:true, best:false },
    { id:"llc300", name:"Lemon-Lime Can Box", category:"Lemon-Lime", brand:"Lemon-Lime", type:"can", size:"300ml", box:"24 Cans", price:610, desc:"Sparkling lime in a can", img:"images/sprite.png", cat:"cold", avail:true, best:false },
    { id:"oc300", name:"Orange Can Box", category:"Orange", brand:"Orange", type:"can", size:"300ml", box:"24 Cans", price:610, desc:"Orange soda can", img:"images/fanta.png", cat:"cold", avail:false, best:false },
    { id:"combo1", name:"Water + Cola Combo", category:"Combo", brand:"Aqualine", type:"combo", size:"Mixed", box:"12 Water + 12 Cola", price:980, desc:"Everyday hydration plus fizz", img:"images/bottle-new-1.png", cat:"combo", avail:true, best:true },
    { id:"combo2", name:"Water + Mixed Cold Drink Combo", category:"Combo", brand:"Aqualine", type:"combo", size:"Mixed", box:"12 Water + 12 Mixed", price:1040, desc:"Water with a mix of sodas", img:"images/bottle-v2-2.png", cat:"combo", avail:true, best:false },
    { id:"combo3", name:"Party Beverage Combo", category:"Combo", brand:"Aqualine", type:"combo", size:"Mixed", box:"24 Water + 24 Sodas", price:1490, desc:"Bulk party pack", img:"images/delivery-2.png", cat:"combo", avail:true, best:false },
    { id:"combo4", name:"Event Beverage Combo", category:"Combo", brand:"Aqualine", type:"combo", size:"Mixed", box:"18 Water + 18 Sodas", price:1350, desc:"Event-ready bundle", img:"images/bottle-new-3.png", cat:"combo", avail:true, best:false },
    { id:"combo5", name:"Office Beverage Combo", category:"Combo", brand:"Aqualine", type:"combo", size:"Mixed", box:"12 Water + 12 Sodas", price:1190, desc:"Office supply pack", img:"images/bottle-v2-4.png", cat:"combo", avail:true, best:false }
];

console.log("Total products:", products.length);

// Check grid element
var grid = document.getElementById("shopGrid");
console.log("Grid element exists:", !!grid);

if (grid) {
    console.log("Grid current HTML:", grid.innerHTML.substring(0, 100) + "...");
} else {
    console.log("ERROR: Grid element not found!");
}

// Test filter function
var state = { search:"", category:"all", sizes:Object.create(null), qtys:Object.create(null), avail:"all", priceMax:1500 };

function passes(p) {
    if (state.category === "water" && p.cat !== "water") return false;
    if (state.category === "cold" && p.cat !== "cold") return false;
    if (state.category === "cans" && p.type !== "can") return false;
    if (state.category === "combos" && p.cat !== "combo") return false;
    if (state.search) {
        var q = state.search.toLowerCase();
        var hay = (p.name + " " + p.category + " " + p.brand + " " + p.size + " " + p.box + " " + p.desc).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
    }
    var sn = parseInt(p.size, 10);
    if (!isNaN(sn) && !state.sizes[sn]) return false;
    var qn = parseInt(p.box, 10);
    if (!isNaN(qn) && !state.qtys[qn]) return false;
    if (state.avail === "in" && p.avail !== true) return false;
    if (state.avail === "out" && p.avail !== false) return false;
    if (state.priceMax && p.price > state.priceMax) return false;
    return true;
}

var shown = products.filter(passes);
console.log("Products after filter:", shown.length);

if (shown.length > 0) {
    console.log("First product:", shown[0]);
    console.log("First product HTML:", shown[0].name);
}

console.log("=== DEBUG END ===");
