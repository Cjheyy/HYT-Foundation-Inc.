# 📸 How to Replace Gallery Images - Simple Example

## 🎯 Quick Steps

### Step 1: Prepare Your Photos
1. Get 10 photos from your HYT Foundation events
2. Rename them to simple names:
   - `event1.jpg`
   - `event2.jpg`
   - `event3.jpg`
   - `event4.jpg`
   - `event5.jpg`
   - `event6.jpg`
   - `event7.jpg`
   - `event8.jpg`
   - `event9.jpg`
   - `event10.jpg`

### Step 2: Copy to Folder
Copy all 10 photos to:
```
hyt-foundation/public/images/gallery/
```

### Step 3: Edit galleryData.js
Open: `hyt-foundation/src/data/galleryData.js`

Replace with:

```javascript
export const galleryItems = [
  {
    id: 1,
    title: "Youth Leadership Summit 2026",
    description: "50+ young leaders trained in community development",
    image: "/images/gallery/event1.jpg"
  },
  {
    id: 2,
    title: "OJT Partnership Program",
    description: "200+ students placed in quality internships",
    image: "/images/gallery/event2.jpg"
  },
  {
    id: 3,
    title: "Skills Training Workshop",
    description: "100+ youth upskilled in technology",
    image: "/images/gallery/event3.jpg"
  },
  {
    id: 4,
    title: "Community Outreach Program",
    description: "30+ communities served",
    image: "/images/gallery/event4.jpg"
  },
  {
    id: 5,
    title: "Excellence Awards Ceremony",
    description: "150+ certificates awarded",
    image: "/images/gallery/event5.jpg"
  },
  {
    id: 6,
    title: "Innovation Showcase",
    description: "25+ youth-led projects",
    image: "/images/gallery/event6.jpg"
  },
  {
    id: 7,
    title: "Youth Empowerment Event",
    description: "Building confidence and skills",
    image: "/images/gallery/event7.jpg"
  },
  {
    id: 8,
    title: "Career Development Forum",
    description: "Industry connections",
    image: "/images/gallery/event8.jpg"
  },
  {
    id: 9,
    title: "Student Achievement Awards",
    description: "Recognizing outstanding performance",
    image: "/images/gallery/event9.jpg"
  },
  {
    id: 10,
    title: "Community Partnership Launch",
    description: "New collaborations",
    image: "/images/gallery/event10.jpg"
  }
];
```

### Step 4: Refresh Browser
1. Save the file
2. Refresh your browser (Ctrl + F5)
3. Done! Your photos should appear! 🎉

---

## 📝 Notes

- **Image format:** JPG or PNG
- **Image size:** Keep under 500KB each (optimize if needed)
- **Image dimensions:** Portrait (vertical) photos work best (like 800x1200)
- **Path must start with `/`** - example: `/images/gallery/photo.jpg`

---

## ⚡ Super Quick Test

Want to test with just 1 photo first?

1. Copy 1 photo to `/public/images/gallery/test.jpg`
2. Change just the first item in `galleryData.js`:
   ```javascript
   {
     id: 1,
     title: "Test Photo",
     description: "Testing my photo",
     image: "/images/gallery/test.jpg"
   },
   ```
3. Refresh browser
4. If it works, do the rest!

---

## 🆘 Troubleshooting

### Image not showing?
- ✅ Check file is in `/public/images/gallery/`
- ✅ Check filename matches exactly (case-sensitive!)
- ✅ Check path starts with `/images/gallery/`
- ✅ Try hard refresh (Ctrl + F5)

### Still using Unsplash?
- ✅ Make sure you saved `galleryData.js`
- ✅ Check you edited the right file
- ✅ Restart development server (Ctrl + C, then `npm start`)

---

**That's it! Super simple!** 🎉
