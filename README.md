# Zenventora

Single-page responsive website template for **Zenventora**, a product-focused partnership agency for SaaS startups, software product companies, and digital solution providers.

## What is included

- Responsive one-page main website (`index.html`)
- Dedicated website solutions landing page (`website/index.html`) with its own responsive styles (`website/website.css`)
- Mobile-first styling (`styles.css`)
- Mobile menu behavior (`script.js`)
- SEO metadata, canonical URL, Open Graph, Twitter Card, Organization schema, ContactPoint schema, and FAQ schema
- Partner company placeholder cards for logo, company name, category, and description
- Zoho Forms contact page (`contact.html`) embedded through a responsive iframe
- Contact page: `contact.html`
- Legal pages: `privacy-policy.html` and `terms-and-conditions.html`
- Relative interlinking for same-folder hosting, including the dedicated Website and E-menu product pages
- `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest`
- Zenventora logo, SVG favicon, Apple touch icon, partner logo assets, social links, and social sharing OG image

## Placeholder areas to replace

1. Logo / brand assets in `assets/zenventora-logo.svg`, `assets/favicon.svg`, and `assets/og-image.svg`
2. Partner company logos, names, categories, and descriptions in the `#partners` section
3. Phone / WhatsApp number `9360782707`
4. Email addresses `support@zenventora.in` and `sales@zenventora.in`
5. Zoho Forms iframe URL in `contact.html` if the form changes
6. Privacy Policy and Terms & Conditions content/details if your legal team provides final wording
7. Social links in the footer and organization schema if handles change
8. `assets/og-image.svg` if a branded social image is available
9. The Website page uses the same shared `styles.css` and `script.js` foundation so navigation, responsive handling, logo usage, footer patterns, and IP-based campaign currency display stay unified.

## Dedicated Website Page

`website/` is the dedicated website-development campaign hub linked from the main navigation and footer. It intentionally keeps the **₹3,999 starting point** prominent while explaining that the final scope is requirement-based.

The page is structured around:
- Startup solutions as a major focus for founders with an idea but no clear digital execution path
- Five priority verticals: real estate, retail, mobile shops, cafés, and restaurants
- Business and service websites, landing pages, product/SaaS websites, web applications, mobile-first experiences, and maintenance
- SEO, AEO, AI-search discovery foundations, FAQs, structured data, internal linking, canonical URLs, and crawlable content
- A shared Zenventora contact form via `../contact.html`
- No testimonials yet; testimonial content can be added after confirmed customer deliveries and permission
- India visitors see the ₹3,999 starting amount; international visitors see the rounded USD equivalent through the shared IP-based pricing logic in `script.js`.

The page is designed to extend the current Zenventora theme rather than introduce a separate visual system.

## Local preview

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` in a browser.
