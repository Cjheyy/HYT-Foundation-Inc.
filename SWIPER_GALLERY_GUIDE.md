# 🎠 Swiper Image Gallery Guide

## ✨ What's New

The "Our Accomplishments" section now uses **Swiper.js** - an automatic sliding image carousel!

### Features:
- ✅ **Auto-playing slider** - moves automatically every 3 seconds
- ✅ **3D Coverflow effect** - beautiful rotating carousel
- ✅ **10 image slides** - shows your accomplishments
- ✅ **Smooth animations** - professional transitions
- ✅ **Pagination dots** - click to navigate
- ✅ **Swipe/drag** - touch-friendly on mobile
- ✅ **Responsive** - works on all screen sizes
- ✅ **Active slide highlight** - center slide stands out

---

## 🎨 Current Setup

### 10 Gallery Items with Images:

1. **Youth Leadership Summit 2026** - 50+ young leaders trained
2. **OJT Partnership Program** - 200+ students placed
3. **Skills Training Workshop** - 100+ youth upskilled
4. **Community Outreach Program** - 30+ communities served
5. **Excellence Awards Ceremony** - 150+ certificates awarded
6. **Innovation Showcase** - 25+ youth-led projects
7. **Youth Empowerment Event** - Building confidence
8. **Career Development Forum** - Industry connections
9. **Student Achievement Awards** - Recognition
10. **Community Partnership Launch** - New collaborations

---

## 📸 How to Add Your Own Images

### Option 1: Use Your Own Photos (Local Files)

1. **Prepare your images:**
   - Format: JPG or PNG
   - Size: Optimize to under 500KB each
   - Dimensions: 700x1000 pixels (portrait) works best

2. **Copy images to project:**
   ```
   hyt-foundation/public/images/gallery/
   ```

3. **Update `galleryData.js`:**
   ```javascript
   export const galleryItems = [
     {
       id: 1,
       title: "Your Event Title",
       description: "Your event description",
       image: "/images/gallery/your-photo-1.jpg"
     },
     // ... more items
   ];
   ```

### Option 2: Use Online Image URLs (Current Setup)

Currently using **Unsplash** free stock photos. You can:

1. Go to https://unsplash.com/
2. Search for photos you want
3. Right-click → "Copy image address"
4. Paste URL in `galleryData.js`

**Edit:** `src/data/galleryData.js`
```javascript
{
  id: 1,
  title: "Your Title",
  description: "Your description",
  image: "https://your-image-url.jpg"
}
```

---

## 🎯 How to Change Images

### Quick Method (Replace All):

Open: `src/data/galleryData.js`

Replace the entire array with your own:

```javascript
export const galleryItems = [
  {
    id: 1,
    title: "HYT Summit 2026",
    description: "Our biggest event of the year",
    image: "/images/gallery/summit-2026.jpg"
  },
  {
    id: 2,
    title: "OJT Graduation",
    description: "Celebrating our graduates",
    image: "/images/gallery/graduation.jpg"
  },
  // Add more items...
];
```

### Individual Method (Change One):

Find the item by ID and update:

```javascript
{
  id: 3, // ← Find this ID
  title: "New Title Here", // ← Change title
  description: "New description", // ← Change description
  image: "new-image-url.jpg" // ← Change image
}
```

---

## 🎛️ Customize Slider Settings

### Change Auto-play Speed

Edit: `src/pages/public/Home.jsx`

Find this part:
```javascript
autoplay={{
  delay: 3000, // ← Change this (milliseconds)
  disableOnInteraction: false,
}}
```

**Examples:**
- `2000` = 2 seconds (faster)
- `5000` = 5 seconds (slower)
- Remove entire `autoplay` block = manual only

### Change 3D Effect

Find:
```javascript
coverflowEffect={{
  rotate: 50,  // ← Rotation angle (0-360)
  stretch: 0,  // ← Spacing between slides
  depth: 100,  // ← Depth of 3D effect (0-1000)
  modifier: 1, // ← Effect multiplier
  slideShadows: true,
}}
```

**Try these:**
- **More dramatic:** `rotate: 80, depth: 200`
- **Subtle:** `rotate: 20, depth: 50`
- **Flat:** `rotate: 0, depth: 0`

### Change Slide Size

Edit: `src/pages/public/Home.css`

Find:
```css
.accomplishments-swiper .swiper-slide {
  width: 350px;  /* ← Change width */
  height: 500px; /* ← Change height */
}
```

---

## 🎨 Customize Colors

### Change Pagination Dots Color

Edit: `src/pages/public/Home.css`

```css
.accomplishments-swiper .swiper-pagination-bullet-active {
  background: linear-gradient(90deg, #D57156, #279EB6);
  /* ↑ Change these colors */
}
```

### Change Caption Background

```css
.accomplishments-swiper .swiper-slide-caption {
  background: linear-gradient(to top, 
    rgba(0, 0, 0, 0.9) 0%, 
    rgba(0, 0, 0, 0.7) 50%, 
    transparent 100%);
  /* ↑ Change rgba values for different darkness */
}
```

---

## 🔢 Add More or Fewer Slides

### Add More (No Limit!):

In `galleryData.js`, just add more objects:

```javascript
export const galleryItems = [
  // ... existing 10 items
  {
    id: 11, // ← Continue numbering
    title: "New Event",
    description: "New description",
    image: "new-image.jpg"
  },
  {
    id: 12,
    title: "Another Event",
    description: "Another description",
    image: "another-image.jpg"
  },
  // Add as many as you want!
];
```

### Remove Items:

Just delete the object from the array:

```javascript
export const galleryItems = [
  { id: 1, title: "Keep this", ... },
  { id: 2, title: "Keep this", ... },
  // { id: 3, title: "Delete this", ... }, ← Remove or comment out
  { id: 4, title: "Keep this", ... },
];
```

---

## 📱 Mobile Behavior

The slider automatically:
- ✅ Reduces slide size on mobile
- ✅ Enables touch swipe
- ✅ Adjusts text size
- ✅ Maintains smooth animations
- ✅ Shows pagination dots

No extra work needed! 🎉

---

## 🎯 Current Features

### Automatic:
- Slides every 3 seconds
- Infinite loop
- Pauses on hover (desktop)
- Resumes after hover

### Manual:
- Click/tap slides to navigate
- Drag/swipe to move
- Click pagination dots
- Keyboard arrows (if supported)

### Visual:
- 3D coverflow effect
- Active slide highlights
- Caption fade-in
- Smooth transitions
- Shadow effects

---

## 🎬 What You'll See

### On Load:
- Slider starts automatically
- Center slide is highlighted
- Captions appear on active slide
- Pagination dots at bottom

### On Hover:
- Auto-play pauses (desktop)
- Can drag to navigate
- Click slides to jump

### On Mobile:
- Touch to swipe
- Tap slides to navigate
- Smooth touch response
- Smaller slide size

---

## 💡 Tips & Best Practices

### Image Quality:
- Use high-quality photos (not blurry)
- Keep consistent dimensions (all portrait or all landscape)
- Optimize file size (under 500KB each)
- Use similar color tones for cohesive look

### Content:
- Keep titles short (under 50 characters)
- Keep descriptions brief (under 100 characters)
- Use clear, meaningful names
- Match content to your actual events

### Number of Slides:
- **5-15 slides** = Ideal
- **3-5 slides** = Feels short
- **15+ slides** = Might be too long
- Current: **10 slides** = Perfect!

---

## 🆘 Troubleshooting

### Slider not moving?
- Check if `autoplay` is enabled in Home.jsx
- Verify Swiper modules are imported
- Check browser console for errors

### Images not showing?
- Verify image URLs are correct
- Check image files exist in `/public/images/gallery/`
- Try using full URLs (https://...)

### 3D effect not working?
- Check `EffectCoverflow` module is imported
- Verify `effect={'coverflow'}` is set
- Try adjusting `depth` and `rotate` values

### Layout broken on mobile?
- Check responsive CSS is included
- Clear browser cache
- Test in different browsers

---

## ✅ Current Build Status

```
✅ Compiled successfully
149.21 KB JavaScript (+27.5 KB for Swiper)
12.82 KB CSS (+874 B)
No errors, no warnings
Production ready!
```

---

## 🎉 Quick Test

1. Open http://localhost:3000
2. Scroll to "Our Accomplishments"
3. Watch the slider auto-play! 🎠
4. Try dragging slides
5. Click pagination dots
6. Try on mobile (resize browser)

---

## 📝 File Locations

**To change images/content:**
- `src/data/galleryData.js`

**To customize slider settings:**
- `src/pages/public/Home.jsx`

**To customize styles:**
- `src/pages/public/Home.css`

**To add local images:**
- `public/images/gallery/`

---

**That's it! Enjoy your beautiful automatic slider!** 🎉🎠

**Remember:** The slider is using free Unsplash images right now. Replace them with your actual HYT Foundation event photos when ready!

---

**Last Updated:** September 15, 2026  
**Status:** ✅ Working & Auto-playing!
