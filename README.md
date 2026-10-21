# Wanderlust Co. — India travel website

Open `index.html` in a browser (or upload the folder to any static host). No build step.

Files
- index.html — page structure (search widget, sections, overlays)
- style.css — all styles, light + dark theme
- data.js — cities, airports, stations, destinations, packages, offers, festivals, FAQs (edit content here)
- script.js — core: language, currency, theme, homepage sections, wishlist, chat
- booking.js — search + results for flights, hotels, trains, buses, cabs, holidays, visa, forex, insurance
- checkout.js — checkout, coupons, simulated payments, login (OTP demo), My Trips, cancellation & refunds, PNR lookup

Demo notes
- Inventory and prices are generated; replace with real supplier APIs (GDS/airline NDC, IRCTC partner, bus/hotel APIs).
- Payments are simulated. Plug in a PCI-DSS gateway (e.g. Razorpay, PayU, Cashfree) for production.
- Login OTP is shown on screen; connect an SMS provider for real OTPs.
- Data (user, bookings, wishlist) is stored in the browser's localStorage only.
- Sample reviews are marked as samples; replace with real ones.

Hero photo
- hero.jpg: Taj Mahal photo from Unsplash (free to use under the Unsplash License). Replace it with any landscape photo of the same name to change the background.
- img/*.webp: destination photos from Wikimedia Commons (CC BY / CC BY-SA / GFDL). Credits are listed on the site under Footer → Photo credits. Keep the credits if you reuse them.
