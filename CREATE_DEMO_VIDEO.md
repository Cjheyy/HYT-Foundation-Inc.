# Creating Demo Videos for Gallery

Since we cannot automatically download videos, here are quick ways to add demo videos:

## Option 1: Use Free Stock Videos (RECOMMENDED)

### From Pexels (No login required)
1. Go to https://www.pexels.com/search/videos/students/
2. Download any relevant video
3. Rename to match gallery items:
   - `youth-leadership.mp4`
   - `ojt-partnership.mp4`
   - `skills-training.mp4`
   - `community-outreach.mp4`
   - `excellence-awards.mp4`
   - `innovation-showcase.mp4`
4. Place in `/public/videos/`

### From Pixabay (No login required)
1. Go to https://pixabay.com/videos/search/education/
2. Download free videos
3. Rename and place in `/public/videos/`

### From Mixkit (No login required)
1. Go to https://mixkit.co/free-stock-video/
2. Search for: "students", "office", "teamwork", "graduation"
3. Download and rename

## Option 2: Record Screen Demo
1. Use Windows Game Bar (Win + G)
2. Record a quick 10-second screen demo
3. Save as MP4
4. Copy to all 6 filenames in `/public/videos/`

## Option 3: Use Phone Camera
1. Record a short video on your phone
2. Transfer to computer
3. Convert to MP4 if needed
4. Copy to `/public/videos/`

## Option 4: Leave Videos Empty (CURRENT STATE)

The gallery is designed to handle missing videos gracefully:
- Cards will display with SVG placeholder images ✓
- Hover effects work ✓
- Click opens modal ✓
- Shows "Video Coming Soon" message ✓
- No errors ✓

**This demonstrates the error handling feature!**

---

## Current Status

✅ **Working Now:**
- Gallery displays with colorful SVG placeholders
- Hover effects (scale, lift, zoom)
- Hover sound (generated with Web Audio API)
- Click opens modal
- "Video Coming Soon" message
- Close modal (X, ESC, backdrop)
- Keyboard navigation
- Mobile responsive

⚠️ **To Complete:**
- Add actual video files (optional, for full demo)

---

## Quick Test URLs

Copy-paste these in browser to download:

**Students/Education:**
- https://www.pexels.com/video/students-studying-3959350/
- https://www.pexels.com/video/team-of-students-3044146/

**Office/Teamwork:**
- https://www.pexels.com/video/people-working-in-office-4057689/
- https://www.pexels.com/video/business-team-meeting-3194474/

**Technology:**
- https://www.pexels.com/video/coding-on-computer-3129957/
- https://www.pexels.com/video/person-using-laptop-3130187/

Right-click video → "Save video as..." → rename to match gallery item names.
