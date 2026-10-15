---
name: Gehna
description: A bright, everyday jewellery storefront with an editorial Gen Z voice.
colors:
  paper: "#fffdfb"
  white: "#ffffff"
  ink: "#211a1e"
  muted: "#665e62"
  berry: "#91344b"
  berry-dark: "#6c2438"
  blush: "#f6dfdb"
  blush-light: "#f9eeeb"
  line: "#e9e1df"
  gold: "#bd9154"
  gold-dark: "#80582d"
typography:
  display:
    fontFamily: "Nunito Sans, Arial, sans-serif"
    fontSize: "clamp(58px, 6vw, 82px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Nunito Sans, Arial, sans-serif"
    fontSize: "clamp(32px, 3.3vw, 46px)"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Nunito Sans, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Nunito Sans, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Nunito Sans, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  pill: "100px"
  category-card: "18px"
  product-photo: "16px"
  field: "10px"
spacing:
  desktop-gutter: "44px"
  mobile-gutter: "18px"
  category-gap: "22px"
  product-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "14px 25px"
    height: "54px"
  button-primary-hover:
    backgroundColor: "{colors.berry}"
  button-accent:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "14px 25px"
    height: "54px"
  button-accent-hover:
    backgroundColor: "{colors.berry-dark}"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
    height: "50px"
---

# Design System: Gehna

## Overview

**Creative North Star: "Everyday Editorial"**

Gehna is a clean, bright jewellery storefront for young women styling pieces into ordinary days. White space, soft blush and peach photography, restrained Nunito Sans headlines, and berry accents give it the pace of a contemporary fashion editorial. The original supplied gold logo remains an image asset and the binding identity mark.

The home page moves from a lifestyle hero to two visual categories, compact product cards, a split image-and-story band, and a final shop prompt. This is the implemented visual direction, not a claim that the photographed pieces are verified merchandise.

**Key Characteristics:**
- Light, conversational type and roomy sections.
- Rounded image cards, pill actions, and a mostly flat page.
- Lifestyle imagery for mood; Medusa product data for merchandise truth.

## Colors

### Primary

- **Near-black ink** is the main text, primary button, announcement, and footer anchor.
- **Berry** emphasizes selected words, links, saved state, and accent buttons. Its darker variant is the accent-button hover.

### Secondary

- **Blush** supports the hero copy area; **light blush** backs category cards, search, and order summaries.
- **Gold** survives in the supplied logo and small identity accents. The modern interface does not rely on gold for normal text.

### Neutral

- **Paper** is the page background; **white** supports the sticky header and form fields.
- **Muted** supports descriptions and supporting labels; **line** supplies quiet separation.

**The Logo Rule.** Keep the supplied gold logo as an image; do not redraw it in display type.
**The Berry Rule.** Use berry for small accents and interaction; headings and longer reading stay in ink.

## Typography

Nunito Sans is the sole loaded family: local Fontsource weights 400, 500, 600, and 700, with Arial and sans-serif fallbacks. Headings use semibold (600), modest tracking, and sentence case. They remain one ink color instead of highlighting individual words. Body copy stays direct and readable.

The hero uses the display token, with a smaller mobile clamp (48px–60px). Section headlines use the headline token and become 32px on mobile. Product-card titles are compact (18px desktop, 15px mobile), with category labels (12px desktop, 11px mobile) and fixed-price numerals (16px desktop, 14px mobile). Other pages share the same type family but adjust size by context.

**The One-Voice Rule.** New storefront headings use Nunito Sans, not the older Cormorant serif declarations still present below the override stylesheet.

## Layout

The centered content wrapper caps at 1320px with total horizontal inset of 88px on desktop, 64px under 1100px, and 36px under 760px. The desktop hero is an image with a peach-to-transparent copy gradient; on mobile it becomes a 365px photograph above a separate peach copy panel. This keeps text legible without placing it over the mobile photo.

Two category cards form a paired row. Featured products form two columns with a 24px gap; the shop grid is three columns on desktop and two on mobile. The story band is two equal image/text columns on desktop and stacks image before text on mobile. Category photos crop to 370px desktop, 310px below 1100px, and 185px mobile. Product photos use a .9 aspect ratio desktop and .8 mobile.

**The Mobile Flow Rule.** Preserve the sequence image, message, category choice, products, and story; avoid shrinking the desktop hero composition onto a phone.

## Elevation & Depth

The page is mostly flat. White and blush surfaces, image crops, and thin rules establish layers. A soft shadow supports the sticky header (0 4px 22px #29161c0d), while wishlist and quick-add controls float lightly over product photographs. The mobile menu and bag drawer use stronger transient depth.

Buttons shift color and rise 2px over .2s; product images scale subtly on hover over .6s. The global reduced-motion rule removes animation, transition, and smooth scrolling when requested.

## Shapes

Pill buttons, filters, sort controls, quick-add, and toast use a 100px radius. Category cards and detail photos use 18px corners; product images use 16px desktop and 11px mobile. Fields use 10px corners. Circular wishlist controls sit on product images. Borders stay light and functional.

## Components

### Buttons and links

The primary action is ink on white, semibold (600), and pill-shaped; hover turns berry and lifts slightly. The accent variant begins berry and darkens on hover. Underlined text links use the same semibold sans voice. Visible focus outlines use berry (2px) with a 4px offset.

### Category and product cards

Category cards place an illustrative lifestyle crop above a small eyebrow and bold category name. Product cards place a rounded product photo above category, title, and fixed price, with a white circular wishlist control and a full-width pill quick-add over the image. On mobile, two compact product cards remain side by side. Out-of-stock and saved states must remain explicit.

### Fields, navigation, and feedback

Inputs use white fill, a soft border, and 10px corners; focus shifts the border to berry. Desktop navigation sits under the sticky header and marks hover with a berry underline. Mobile navigation opens below the 72px header. Feedback keeps visible text, and the bag remains a native modal dialog. Keep accessible names, keyboard focus, and the existing reduced-motion behavior.

### Photography and catalog truth

The hero, category, and story images are illustrative campaign imagery; they are not verified photos of the products for sale. Product cards render each product record's image and price. Those records are sourced from Medusa when configured, or from the explicitly disclosed illustrative sample catalog in preview mode. The current sample catalog still contains an ornate jhumka image, which remains because the product card must show the actual image tied to that sample SKU. Do not replace a product photo with a visually convenient campaign image or imply the sample products, prices, materials, or stock are verified.

## Do's and Don'ts

- **Do** keep the supplied logo and its gold identity intact.
- **Do** use Nunito Sans, near-black, berry, blush, rounded cards, and pill controls for new storefront UI.
- **Do** keep the mobile hero image and text in separate stacked regions.
- **Do** preserve sample disclosures and product-record photos and fixed prices.
- **Don't** revive the old serif, olive, square-control visual direction.
- **Don't** present lifestyle category or campaign photos as verified product imagery.
