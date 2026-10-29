import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Product } from './models/Product.js';
import { Service } from './models/Service.js';
import { Course } from './models/Course.js';
import { Link } from './models/Link.js';
import { ProductCategory, ServiceCategory, CourseCategory } from './models/ListingCategory.js';
import { MARKETPLACE_CATEGORIES_BY_TYPE } from '../../shared/marketplaceCategories.js';

const categories = MARKETPLACE_CATEGORIES_BY_TYPE;

const products = [
  ['BrewMate Ceramic Pour-Over Set', 'Home & Kitchen', 28500, 'new', 'A glazed ceramic dripper, server and two reusable filters for a calmer morning coffee ritual.'],
  ['Kora 20W USB-C Wall Charger', 'Electronics', 14900, 'new', 'Compact fast charger with a braided USB-C cable for phones, tablets and travel bags.'],
  ['Everyday Crossbody Utility Bag', 'Fashion & Accessories', 22500, 'new', 'Lightweight locally sewn crossbody with adjustable strap, inner pocket and water-resistant lining.'],
  ['PalmWeave Market Tote', 'Fashion & Accessories', 18500, 'new', 'Handwoven palm-fibre tote with reinforced handles, made by a small craft studio in Ibadan.'],
  ['SoftStart Skincare Duo', 'Beauty & Personal Care', 24750, 'new', 'Gentle cleanser and fragrance-free moisturiser for a simple daily routine.'],
  ['Linen Blend Table Runner', 'Home & Kitchen', 16500, 'new', 'Textured table runner in natural cotton-linen, cut and hemmed in Lagos.'],
  ['Field Notes Weekly Planner', 'Books & Stationery', 9800, 'new', 'Undated 12-week planner with habit grids, weekly priorities and thick fountain-pen-friendly pages.'],
  ['SoundNest Bluetooth Speaker', 'Electronics', 43500, 'new', 'Portable splash-resistant speaker with USB-C charging and a warm, balanced sound profile.'],
  ['Adire Everyday Headwrap', 'Fashion & Accessories', 12500, 'new', 'Indigo-resist-dyed cotton headwrap with a soft finish and generous length for versatile styling.'],
  ['Kitchen Garden Herb Starter Kit', 'Home & Kitchen', 13800, 'new', 'Starter pots, coco coir and seeds for scent leaf, basil and parsley on a sunny windowsill.'],
  ['TrailReady Stainless Flask', 'Sports & Outdoors', 21000, 'new', 'Double-wall insulated bottle with a leak-resistant lid for commutes, hikes and gym sessions.'],
  ['DeskLight Adjustable LED Lamp', 'Electronics', 31900, 'new', 'Dimmable task lamp with warm and cool modes, touch controls and a stable weighted base.'],
  ['Rooted Shea Body Butter', 'Beauty & Personal Care', 11200, 'new', 'Small-batch whipped shea butter blended with cocoa butter and a mild citrus scent.'],
  ['Weekend Jollof Spice Box', 'Food & Groceries', 8900, 'new', 'A measured spice blend with dried herbs and smoked pepper for two family-sized jollof batches.'],
  ['Pocket Sketchbook Set', 'Arts & Crafts', 10400, 'new', 'Three pocket-sized mixed-media notebooks with heavy paper for graphite, ink and light washes.'],
  ['LittleSteps Cotton Sleepsuit', 'Baby & Kids', 15800, 'new', 'Soft breathable cotton sleepsuit with smooth seams and easy-change snaps.'],
  ['ClearCall USB Condenser Microphone', 'Electronics', 68500, 'new', 'Plug-and-play USB microphone with desk stand and pop screen for calls, lessons and podcasts.'],
  ['Aso-Oke Card Wallet', 'Fashion & Accessories', 14500, 'new', 'Slim card wallet combining woven Aso-Oke offcuts with durable cotton canvas.'],
  ['Sunday Pantry Granola Trio', 'Food & Groceries', 17200, 'new', 'Three small-batch granola flavours with toasted oats, nuts and dried fruit.'],
  ['BalanceBoard Resistance Band Kit', 'Sports & Outdoors', 19500, 'new', 'Four resistance levels, door anchor and a fabric carry bag for home workouts.'],
  ['QuietHours Over-Ear Headphones', 'Electronics', 79500, 'new', 'Comfort-fit wireless headphones with fold-flat hinges and a clear built-in microphone.'],
  ['Hand-thrown Breakfast Bowl Pair', 'Home & Kitchen', 26000, 'new', 'Pair of wheel-thrown stoneware bowls finished with a food-safe speckled glaze.'],
  ['Daily Hydration Face Mist', 'Beauty & Personal Care', 9800, 'new', 'A light aloe and glycerin mist for a quick refresh between routines.'],
  ['Loom & Line Cushion Cover', 'Home & Kitchen', 18200, 'new', 'Textured woven cushion cover with a hidden zip, sized for a standard 45cm insert.'],
  ['Makers Market Screenprint', 'Arts & Crafts', 32000, 'new', 'Numbered two-colour screenprint on archival paper, printed in a small Lagos studio.'],
  ['Focus Blocks Study Cards', 'Books & Stationery', 7500, 'new', 'Reusable prompt cards for breaking study sessions into focused, achievable blocks.'],
  ['KiddieCare Washable Bib Set', 'Baby & Kids', 9600, 'new', 'Set of three absorbent cotton bibs with adjustable snaps and washable backing.'],
  ['CityRide Reflective Backpack', 'Sports & Outdoors', 36800, 'new', 'Commuter backpack with padded laptop sleeve, reflective trim and a rain cover.'],
  ['GlowPath Rechargeable Lantern', 'Electronics', 24800, 'new', 'Rechargeable lantern with a hanging loop, warm light and emergency low-power mode.'],
  ['Bamboo Serving Board', 'Home & Kitchen', 15500, 'new', 'Food-safe bamboo serving board with rounded edges for fruit, bread and small bites.'],
  ['Sunday Best Ankara Shirt', 'Fashion & Accessories', 29500, 'new', 'Relaxed-fit cotton Ankara shirt with corozo buttons, cut and sewn in Abeokuta.'],
  ['Neem & Oat Gentle Soap Set', 'Beauty & Personal Care', 8300, 'new', 'Three cold-process bars with neem, oats and shea oil for everyday hand and body washing.'],
  ['Home Baker Measuring Set', 'Home & Kitchen', 12100, 'new', 'Nested stainless measuring cups and spoons with etched metric and cup markings.'],
  ['Pocket Power 10K Battery', 'Phones & Accessories', 32900, 'new', '10,000mAh power bank with USB-C input/output and a clear four-stage charge indicator.'],
  ['Analog Film Camera Strap', 'Photography & Video', 17200, 'new', 'Adjustable woven camera strap with soft shoulder padding and reinforced attachment loops.'],
  ['Weekend Football Training Cones', 'Sports & Outdoors', 11200, 'new', 'Twenty flexible marker cones with a mesh bag for drills and small-sided games.'],
  ['Woven Laptop Sleeve 14-inch', 'Fashion & Accessories', 23800, 'new', 'Padded laptop sleeve covered in handwoven cotton with a secure flap closure.'],
  ['Plantain Flour Pantry Pack', 'Food & Groceries', 14500, 'new', 'Three sealed packs of finely milled plantain flour from a small food producer in Osun.'],
  ['PaperBloom Gift Wrap Bundle', 'Arts & Crafts', 9100, 'new', 'Recycled paper wrap, twine and greeting cards printed with botanical illustrations.'],
  ['WarmTone Bedside Reading Light', 'Home & Kitchen', 18900, 'new', 'Compact rechargeable reading light with adjustable neck and three warm brightness levels.'],
  ['StudioBasics Drawing Pencil Roll', 'Arts & Crafts', 13200, 'new', 'A curated graphite pencil range with sharpener, kneaded eraser and canvas roll.'],
  ['TinyTide Hooded Towel', 'Baby & Kids', 20500, 'new', 'Soft cotton hooded towel with bound edges, sized for toddlers and easy machine washing.'],
  ['SmartPlug Energy Monitor', 'Electronics', 28900, 'new', 'Wi-Fi smart plug with scheduling and an energy-use view in its companion app.'],
  ['Everyday Gold-tone Hoop Pair', 'Fashion & Accessories', 11500, 'new', 'Lightweight stainless hoops with a warm gold-tone finish and secure hinged clasps.'],
  ['Cocoa & Coffee Scrub', 'Beauty & Personal Care', 10500, 'new', 'Small-batch body scrub with coffee grounds, cocoa butter and a simple rinse-clean formula.'],
  ['Stackable Lunch Bowl Set', 'Home & Kitchen', 19300, 'new', 'Two leak-resistant lunch bowls with snap lids and a removable dressing cup.'],
  ['Stories from the Lagoon', 'Books & Stationery', 13800, 'new', 'A contemporary collection of short fiction from emerging West African writers.'],
  ['Refillable Brush Pen Set', 'Books & Stationery', 8600, 'new', 'Flexible brush pens and refill cartridges for lettering, sketching and quick notes.'],
  ['FieldDay Compact Picnic Mat', 'Sports & Outdoors', 27500, 'new', 'Foldable water-resistant picnic mat with carry strap for parks, beaches and outdoor events.'],
  ['Silicone Feeding Spoon Pair', 'Baby & Kids', 7200, 'new', 'Soft-tip feeding spoons with easy-grip handles for early self-feeding practice.'],
];

const services = [
  ['Home plumbing inspection and repairs', 'Home Services', 28000, 'visit', '2-4 hours', 'Lagos'],
  ['Residential electrical safety check', 'Home Services', 35000, 'visit', 'Half day', 'Abuja'],
  ['Deep cleaning for a two-bedroom flat', 'Home Services', 55000, 'session', '4-6 hours', 'Lagos'],
  ['Furniture assembly and mounting', 'Home Services', 24000, 'visit', '2-3 hours', 'Ibadan'],
  ['Split AC servicing and filter clean', 'Home Services', 32000, 'unit', '2 hours', 'Port Harcourt'],
  ['Home painting consultation and room refresh', 'Home Services', 88000, 'project', '2-3 days', 'Lagos'],
  ['Portrait photography session', 'Photography & Video', 65000, 'session', '90 minutes', 'Abuja'],
  ['Small event photo coverage', 'Photography & Video', 145000, 'event', '4 hours', 'Lagos'],
  ['Product photography for online shops', 'Photography & Video', 78000, 'batch', '20 edited images', 'Enugu'],
  ['Family outdoor photo session', 'Photography & Video', 72000, 'session', '90 minutes', 'Ibadan'],
  ['JAMB mathematics tutoring', 'Education & Tutoring', 18000, 'hour', '60 minutes', 'Remote'],
  ['WAEC chemistry revision coaching', 'Education & Tutoring', 22000, 'hour', '60 minutes', 'Remote'],
  ['Primary school reading support', 'Education & Tutoring', 16000, 'hour', '60 minutes', 'Lagos'],
  ['Excel for small-business bookkeeping', 'Business Consulting', 48000, 'workshop', '3 sessions', 'Remote'],
  ['SME bookkeeping setup and monthly review', 'Business Consulting', 95000, 'project', '1 week', 'Abuja'],
  ['CAC business registration guidance', 'Business Consulting', 65000, 'package', '3-5 days', 'Remote'],
  ['CV and LinkedIn profile review', 'Writing & Translation', 32000, 'package', '2 days', 'Remote'],
  ['Small wedding coordination', 'Events', 225000, 'event', 'Event day', 'Lagos'],
  ['Birthday event planning consultation', 'Events', 42000, 'session', '2 hours', 'Owerri'],
  ['Live event sound setup', 'Events', 135000, 'event', 'Up to 5 hours', 'Uyo'],
  ['Natural hair wash and protective styling', 'Beauty & Wellness', 36000, 'session', '2-3 hours', 'Lagos'],
  ['Makeup for a special occasion', 'Beauty & Wellness', 58000, 'session', '2 hours', 'Abuja'],
  ['Barber home visit', 'Beauty & Wellness', 24000, 'visit', '60 minutes', 'Enugu'],
  ['Laptop diagnostics and software tune-up', 'Software & IT Support', 28500, 'device', '1-2 days', 'Lagos'],
  ['Small office Wi-Fi setup', 'Software & IT Support', 75000, 'visit', 'Half day', 'Abuja'],
  ['WordPress business website refresh', 'Web Development', 195000, 'project', '2 weeks', 'Remote'],
  ['Product design portfolio review', 'Graphic Design & Branding', 40000, 'session', '90 minutes', 'Remote'],
  ['Brand identity starter package', 'Graphic Design & Branding', 185000, 'project', '10 business days', 'Remote'],
  ['Social media content calendar', 'Digital Marketing', 68000, 'month', '12 post ideas', 'Remote'],
  ['Podcast recording and editing session', 'Photography & Video', 85000, 'session', '2 hours', 'Lagos'],
  ['Beginner strength-training coaching', 'Beauty & Wellness', 28000, 'session', '60 minutes', 'Abuja'],
  ['Meal planning consultation', 'Beauty & Wellness', 35000, 'session', '75 minutes', 'Remote'],
  ['Airport pickup and city transfer', 'Transport & Logistics', 42000, 'trip', 'One way', 'Lagos'],
  ['Furniture delivery coordination', 'Transport & Logistics', 30000, 'trip', 'Same day', 'Ibadan'],
  ['Professional document proofreading', 'Writing & Translation', 18000, '1000 words', '2 business days', 'Remote'],
];

const courses = [
  ['Product Photography with a Phone', 'Photography & Video', 24500, 'self-paced', 'Create clean, consistent product photos using natural light and a smartphone.'],
  ['Small Business Bookkeeping Basics', 'Business & Entrepreneurship', 32000, 'self-paced', 'Track daily sales, expenses and cash flow with a simple bookkeeping routine.'],
  ['Canva Design for Local Brands', 'Design & Creative', 28000, 'self-paced', 'Build reusable social graphics and practical brand templates in Canva.'],
  ['Excel Essentials for Office Work', 'Technology Skills', 36000, 'self-paced', 'Use formulas, sorting and clean spreadsheet layouts for everyday office tasks.'],
  ['Food Safety for Home Bakers', 'Food & Hospitality', 19500, 'self-paced', 'Apply practical hygiene, storage and allergen-labeling habits in a home bakery.'],
  ['Personal Finance Foundations', 'Personal Finance', 22500, 'self-paced', 'Create a workable budget, set savings goals and understand basic borrowing costs.'],
  ['Social Media Marketing Starter', 'Digital Marketing', 29000, 'self-paced', 'Plan a month of useful content and measure simple audience and sales signals.'],
  ['Customer Service for Small Teams', 'Business & Entrepreneurship', 18500, 'self-paced', 'Set response standards, handle complaints and keep customer communication clear.'],
  ['Intro to Web Design with HTML and CSS', 'Web Development', 42000, 'self-paced', 'Build a responsive multi-section page with semantic HTML and modern CSS.'],
  ['Teaching Online: Lesson Planning Basics', 'Education & Teaching', 26000, 'self-paced', 'Structure short online lessons with clear objectives, practice and feedback.'],
];

const sellers = Array.from({ length: 5 }, (_, index) => ({
  email: `seed-seller-${index + 1}@demo.escrit.local`,
  googleId: `escrit-demo-seed-${index + 1}`,
  businessName: ['Northstar Demo Market', 'Loom & Light Demo Shop', 'Everyday Goods Demo Store', 'BrightPath Demo Studio', 'Harbor House Demo'][index],
  fullName: `Escrit Demo Seller ${index + 1}`,
}));

const categoryModels = { product: ProductCategory, service: ServiceCategory, course: CourseCategory };
const listingModels = { product: Product, service: Service, course: Course };
const media = {
  product: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=80',
  ],
  service: [
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=80',
  ],
  course: [
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
  ],
};

async function seedCategories() {
  for (const [type, names] of Object.entries(categories)) {
    const Model = categoryModels[type];
    for (const name of names) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await Model.updateOne({ slug }, { $set: { name, isActive: true, approvalStatus: 'approved' }, $setOnInsert: { slug } }, { upsert: true });
    }
  }
}

async function seedSellerProfiles() {
  const result = [];
  for (const seller of sellers) {
    result.push(await User.findOneAndUpdate(
      { email: seller.email },
      { $set: { ...seller, role: 'user', isDemoSeed: true, emailVerified: true, kycStatus: 'pending', bankAccount: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ));
  }
  return result;
}

function distribute(items, sellerDocs) {
  return items.map((item, index) => ({ ...item, seller: sellerDocs[index % sellerDocs.length]._id }));
}

async function upsertListing(type, data, index) {
  const Model = listingModels[type];
  const approvedCount = Math.ceil(({ product: 50, service: 35, course: 10 })[type] / 2);
  const seller = data.seller;
  const title = data.title;
  const common = {
    seller,
    title,
    description: data.description,
    images: [media[type][index % media[type].length]],
    category: data.category,
    categoryReviewStatus: 'approved',
    isActive: true,
    isVerified: index < approvedCount,
    isFeatured: index < Math.min(3, approvedCount),
  };
  const fields = type === 'product'
    ? { ...common, price: data.price, stock: data.stock, condition: data.condition, negotiable: data.negotiable, refundable: data.refundable }
    : type === 'service'
      ? { ...common, basePrice: data.price, pricingUnit: data.pricingUnit, estimatedTime: data.estimatedTime, location: data.location, deliveryMode: data.deliveryMode, durationMinutes: 60, bookingLeadTimeHours: 24, maxBookingsPerDay: 3, timeZone: 'Africa/Lagos', availability: [{ day: 'saturday', startTime: '09:00', endTime: '17:00' }], cancellationPolicy: 'moderate', cancellationTerms: 'Contact the provider as early as possible if you need to reschedule.' }
      : { ...common, price: data.price, deliveryFormat: data.deliveryFormat, refundable: false, curriculum: [{ title: 'Course preview', description: 'An introductory sample of this practical course.', videoUrl: '' }] };

  const listing = await Model.findOneAndUpdate(
    { seller, title },
    { $set: fields },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const fulfillmentType = type === 'product' ? 'product' : type === 'course' ? 'course' : 'service';
  await Link.findOneAndUpdate(
    { listingType: type, listingId: listing._id },
    { $set: {
      sellerId: seller,
      itemName: listing.title,
      itemDescription: listing.description,
      fulfillmentType,
      listingType: type,
      listingId: listing._id,
      refundable: Boolean(listing.refundable),
      itemPhotoUrl: listing.images[0],
      priceKobo: Math.round(data.price * 100),
      checkoutPriceKobo: null,
      checkoutBasePriceKobo: null,
      active: true,
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (!listing.escrowLinkId) {
    const link = await Link.findOne({ listingType: type, listingId: listing._id });
    listing.escrowLinkId = link._id;
    await listing.save();
  }
  return listing;
}

async function main() {
  await connectDB();
  try {
    await seedCategories();
    const sellerDocs = await seedSellerProfiles();
    let counts = {};
    for (const [type, data] of Object.entries({ product: products, service: services, course: courses })) {
      const Model = listingModels[type];
      const normalized = type === 'product'
        ? data.map(([title, category, price, condition, description]) => ({ title, category, price, condition, description, stock: 5, negotiable: true, refundable: false }))
        : type === 'service'
          ? data.map(([title, category, price, pricingUnit, estimatedTime, location]) => ({ title, category, price, pricingUnit, estimatedTime, location, deliveryMode: location === 'Remote' ? 'remote' : 'in-person' }))
          : data.map(([title, category, price, deliveryFormat, description]) => ({ title, category, price, deliveryFormat, description }));
      const assigned = distribute(normalized, sellerDocs);
      for (let index = 0; index < assigned.length; index++) await upsertListing(type, assigned[index], index);
      const demoSellerIds = sellerDocs.map((seller) => seller._id);
      counts[type] = {
        total: await Model.countDocuments({ seller: { $in: demoSellerIds } }),
        approved: await Model.countDocuments({ seller: { $in: demoSellerIds }, isVerified: true }),
      };
    }
    console.log(JSON.stringify({ seeded: counts, demoOnlyCheckout: true }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[seed] failed:', error.message);
  process.exitCode = 1;
});