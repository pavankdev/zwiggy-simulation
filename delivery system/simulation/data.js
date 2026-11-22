// simulation/data.js - Seed data for Zwiggy Food Delivery Simulation

export const INITIAL_CITY = {
  name: "Bengaluru Central (Koramangala & Indiranagar)",
  center: { lat: 12.9352, lng: 77.6245 },
  bounds: {
    minLat: 12.9100,
    maxLat: 12.9700,
    minLng: 77.5850,
    maxLng: 77.6650
  }
};

export const INITIAL_RESTAURANTS = [
  {
    id: "rest-1",
    name: "Meghana Foods",
    cuisine: "Biryani, Andhra, South Indian",
    category: "Biryani",
    rating: 4.6,
    ratingCount: "12K+",
    prepTimeMinutes: 15,
    priceForTwo: 500,
    location: { lat: 12.9344, lng: 77.6180, address: "5th Block, Koramangala" },
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=60",
    menu: [
      { id: "m1-1", name: "Meghana Special Chicken Biryani", price: 340, veg: false, bestSeller: true, description: "Authentic spicy Andhra style biryani with succulent chicken pieces and aromatic spiced basmati rice." },
      { id: "m1-2", name: "Paneer Biryani", price: 290, veg: true, bestSeller: false, description: "Tender paneer cubes marinated in Andhra spices layered with dum-cooked rice." },
      { id: "m1-3", name: "Chicken 65 (Dry)", price: 260, veg: false, bestSeller: true, description: "Deep fried chicken morsels tossed in fiery red chili paste and fresh curry leaves." },
      { id: "m1-4", name: "Mutton Biryani", price: 420, veg: false, bestSeller: false, description: "Slow cooked tender mutton with whole spices and fragrant saffron rice." }
    ]
  },
  {
    id: "rest-2",
    name: "Truffles Burgers & Shakes",
    cuisine: "American, Burgers, Fast Food",
    category: "Burgers",
    rating: 4.7,
    ratingCount: "25K+",
    prepTimeMinutes: 12,
    priceForTwo: 450,
    location: { lat: 12.9385, lng: 77.6288, address: "Apex Building, 80ft Road, Koramangala" },
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60",
    menu: [
      { id: "m2-1", name: "All American Cheese Burger", price: 240, veg: false, bestSeller: true, description: "Juicy grilled chicken patty with melted cheddar, gherkins and secret house mayo." },
      { id: "m2-2", name: "Crispy Veg Supreme Burger", price: 190, veg: true, bestSeller: false, description: "Crispy spiced potato & corn patty with creamy coleslaw." },
      { id: "m2-3", name: "Ferrero Rocher Thick Shake", price: 210, veg: true, bestSeller: true, description: "Rich chocolate hazelnut blend topped with crunchy wafer crumble." },
      { id: "m2-4", name: "Peri Peri Loaded Fries", price: 160, veg: true, bestSeller: true, description: "Golden crispy skin-on fries tossed in spicy peri peri spice mix." }
    ]
  },
  {
    id: "rest-3",
    name: "Toit Woodfired Kitchen",
    cuisine: "Italian, Pizzas, Continental",
    category: "Pizza",
    rating: 4.8,
    ratingCount: "18K+",
    prepTimeMinutes: 18,
    priceForTwo: 750,
    location: { lat: 12.9719, lng: 77.6412, address: "100ft Road, Indiranagar" },
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60",
    menu: [
      { id: "m3-1", name: "Classic Margherita Pizza (12 inch)", price: 420, veg: true, bestSeller: true, description: "San Marzano tomato sauce, fresh buffalo mozzarella, basil leaves and olive oil." },
      { id: "m3-2", name: "Pepperoni & Smoked Chicken Pizza", price: 540, veg: false, bestSeller: true, description: "Handcrafted crust loaded with smoky chicken slices, mozzarella and spicy pepperoni." },
      { id: "m3-3", name: "Four Cheese Garlic Bread", price: 220, veg: true, bestSeller: false, description: "Toasted artisan baguette with roasted garlic butter, parmesan, mozzarella & herbs." },
      { id: "m3-4", name: "Tiramisu Italiano", price: 260, veg: true, bestSeller: true, description: "Classic espresso-soaked savoiardi layers with whipped mascarpone cream." }
    ]
  },
  {
    id: "rest-4",
    name: "Empire Restaurant",
    cuisine: "North Indian, Mughlai, Kebabs",
    category: "North Indian",
    rating: 4.4,
    ratingCount: "30K+",
    prepTimeMinutes: 14,
    priceForTwo: 600,
    location: { lat: 12.9288, lng: 77.6202, address: "80 Feet Rd, 6th Block, Koramangala" },
    image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop&q=60",
    menu: [
      { id: "m4-1", name: "Empire Butter Chicken", price: 330, veg: false, bestSeller: true, description: "Tandoor roasted chicken simmered in rich creamy tomato and cashew butter gravy." },
      { id: "m4-2", name: "Paneer Tikka Masala", price: 290, veg: true, bestSeller: true, description: "Smoked cottage cheese cubes in spiced onion-tomato gravy with bell peppers." },
      { id: "m4-3", name: "Butter Garlic Naan (2 pcs)", price: 110, veg: true, bestSeller: false, description: "Crisp clay-oven leavened bread brushed generously with garlic butter." },
      { id: "m4-4", name: "Coin Parotta with Chicken Ghee Roast", price: 380, veg: false, bestSeller: true, description: "Flaky mini parottas served with coastal Mangalorean chicken ghee roast." }
    ]
  },
  {
    id: "rest-5",
    name: "Corner House Ice Cream",
    cuisine: "Desserts, Ice Creams, Sundaes",
    category: "Desserts",
    rating: 4.9,
    ratingCount: "40K+",
    prepTimeMinutes: 8,
    priceForTwo: 350,
    location: { lat: 12.9360, lng: 77.6210, address: "4th Block, Koramangala" },
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=60",
    menu: [
      { id: "m5-1", name: "Death By Chocolate (DBC)", price: 280, veg: true, bestSeller: true, description: "Warm chocolate cake with vanilla ice cream, topped with hot fudge sauce and toasted peanuts." },
      { id: "m5-2", name: "Trilogy Sundae", price: 230, veg: true, bestSeller: false, description: "Vanilla, strawberry, and pista scoops crowned with fresh fruit compote." },
      { id: "m5-3", name: "Brownie Bomb", price: 210, veg: true, bestSeller: true, description: "Warm fudge brownie drowned in thick dark chocolate sauce." }
    ]
  },
  {
    id: "rest-6",
    name: "A2B - Adyar Ananda Bhavan",
    cuisine: "Pure Veg, South Indian, Dosas, Sweets",
    category: "South Indian",
    rating: 4.5,
    ratingCount: "16K+",
    prepTimeMinutes: 10,
    priceForTwo: 300,
    location: { lat: 12.9230, lng: 77.6150, address: "7th Block, Koramangala" },
    image: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=500&auto=format&fit=crop&q=60",
    menu: [
      { id: "m6-1", name: "Ghee Roast Masala Dosa", price: 145, veg: true, bestSeller: true, description: "Crisp golden crepe roasted with pure desi ghee, filled with spiced potato masala." },
      { id: "m6-2", name: "Steamed Idli Vada Combo", price: 110, veg: true, bestSeller: true, description: "Two pillowy soft idlis and one crispy medu vada with sambar & two chutneys." },
      { id: "m6-3", name: "Filter Coffee (Hot)", price: 55, veg: true, bestSeller: false, description: "Traditional South Indian frothy chicory-blended filter kaapi." }
    ]
  }
];

export const INITIAL_RIDERS = [
  {
    id: "rider-1",
    name: "Ravi Kumar",
    phone: "+91 98765-43210",
    vehicle: "Hero Splendor (KA-01-AB-1234)",
    battery: 88,
    rating: 4.9,
    status: "IDLE", // IDLE, ASSIGNED, PICKING_UP, DELIVERING
    location: { lat: 12.9360, lng: 77.6200 },
    currentOrderId: null,
    targetLocation: null,
    earnings: 340,
    tripsCompleted: 7
  },
  {
    id: "rider-2",
    name: "Amit Sharma",
    phone: "+91 98451-23456",
    vehicle: "Honda Activa 6G (KA-03-CD-5678)",
    battery: 72,
    rating: 4.8,
    status: "IDLE",
    location: { lat: 12.9395, lng: 77.6270 },
    currentOrderId: null,
    targetLocation: null,
    earnings: 480,
    tripsCompleted: 10
  },
  {
    id: "rider-3",
    name: "Suresh Patel",
    phone: "+91 99123-87654",
    vehicle: "Ather 450X EV (KA-05-EV-9012)",
    battery: 95,
    rating: 5.0,
    status: "IDLE",
    location: { lat: 12.9310, lng: 77.6160 },
    currentOrderId: null,
    targetLocation: null,
    earnings: 520,
    tripsCompleted: 11
  },
  {
    id: "rider-4",
    name: "Priya Nair",
    phone: "+91 97412-34987",
    vehicle: "Ola S1 Pro (KA-02-EV-4321)",
    battery: 64,
    rating: 4.9,
    status: "IDLE",
    location: { lat: 12.9680, lng: 77.6380 },
    currentOrderId: null,
    targetLocation: null,
    earnings: 410,
    tripsCompleted: 8
  },
  {
    id: "rider-5",
    name: "Rajesh Gowda",
    phone: "+91 96321-45678",
    vehicle: "TVS Jupiter (KA-04-MN-8765)",
    battery: 81,
    rating: 4.7,
    status: "IDLE",
    location: { lat: 12.9270, lng: 77.6210 },
    currentOrderId: null,
    targetLocation: null,
    earnings: 290,
    tripsCompleted: 6
  }
];

export const INITIAL_CUSTOMERS = [
  { id: "cust-1", name: "Ananya Iyer", location: { lat: 12.9420, lng: 77.6310, address: "Flat 402, Green Glen Layout, Bellandur Link" } },
  { id: "cust-2", name: "Rohan Deshmukh", location: { lat: 12.9275, lng: 77.6140, address: "14B, 1st Cross, 5th Block Koramangala" } },
  { id: "cust-3", name: "Sneha Reddy", location: { lat: 12.9550, lng: 77.6390, address: "Sobha Jasmine, Domlur Main Road" } },
  { id: "cust-4", name: "Kavya Menon", location: { lat: 12.9325, lng: 77.6330, address: "House 28, Sony World Signal, 4th Block" } },
  { id: "cust-5", name: "Arjun Verma", location: { lat: 12.9620, lng: 77.6430, address: "Penthouse 12, Indiranagar Defense Colony" } }
];
