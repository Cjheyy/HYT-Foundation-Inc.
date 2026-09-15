# Account Type System - Trainee vs OJT Student

## Overview
Added account type selection to differentiate between Trainees (skills training) and OJT Students (on-the-job training/internship).

---

## Changes Made

### 1. **Updated Schools Data** (`src/data/qcSchools.js`)
- **Added 21 Quezon City schools** with complete information:
  - QCU, OLFU-QC, STI Cubao, UE, UP Diliman, Ateneo
  - TUA, SPUQC, NU, NEU, TIP-QC, Miriam College
  - AMA, CCP, WCC, PUP-QC, FEU-NRMF, EARIST
  - PTI, PATTS, ICCT

- **Each school includes:**
  - `id`: School identifier
  - `name`: Full school name
  - `shortName`: Abbreviated name
  - `city`: Location
  - `idFormat`: Student ID format (e.g., "YYYY-XXXXX")
  - `idExample`: Example ID (e.g., "2026-12345")
  - `idPattern`: Regex for validation
  - `validation`: Validation type

---

### 2. **Register Page** (`src/pages/public/Register.jsx`)

#### Account Type Selection
- **Two options with visual cards:**
  - 🎓 **Trainee** - Skills training and workshops
  - 💼 **OJT Student** - On-the-job training / Internship

#### Trainee Form Fields:
- Full Name
- Birthday (with auto-calculated age)
- Address
- Email (Gmail only)
- Password
- Terms & Conditions

#### OJT Student Form Fields:
- Full Name
- **School** (dropdown with 21 QC schools)
- **Student ID** (with format validation)
- **Required OJT Hours** (new field - 1-2000 hours)
- Birthday (with auto-calculated age)
- Address
- Email (Gmail only)
- Password
- Terms & Conditions

#### Key Features:
- **Conditional rendering**: School/Student ID fields only show for OJT Students
- **Required Hours field**: Students input their own required hours
- **Dynamic ID validation**: Format changes based on selected school
- **Visual feedback**: Selected account type is highlighted

---

### 3. **Login Page** (`src/pages/public/Login.jsx`)

#### Account Type Selection
- **Two options:**
  - 🎓 **Trainee**
  - 💼 **OJT Student**

#### Features:
- Must select account type before logging in
- Validation ensures account type is selected
- Same visual card design as Register page

---

### 4. **CSS Enhancements**

#### Account Type Cards (`Register.css` & `Login.css`)
```css
- Grid layout (2 columns)
- Interactive hover effects
- Selected state with gradient background
- Icon scale animations
- Border and shadow transitions
- Mobile responsive (stacks to 1 column)
```

---

## User Data Structure

### Trainee Account:
```javascript
{
  accountType: 'trainee',
  fullName: 'John Doe',
  email: 'john@gmail.com',
  birthday: '2005-06-15',
  age: '21',
  address: 'Quezon City',
  school: null,
  studentId: null,
  requiredHours: null
}
```

### OJT Student Account:
```javascript
{
  accountType: 'ojt-student',
  fullName: 'Jane Smith',
  email: 'jane@gmail.com',
  birthday: '2004-03-20',
  age: '22',
  address: 'Quezon City',
  school: 'Quezon City University',
  studentId: '2026-12345',
  requiredHours: 486
}
```

---

## Validation Rules

### Trainee:
- ✅ Full Name required
- ✅ Birthday required (minimum 15 years old)
- ✅ Address required
- ✅ Email required (Gmail only)
- ✅ Password required (8+ chars, 1 uppercase, 1 number, 1 special)
- ✅ Terms acceptance required
- ❌ No school/student ID validation

### OJT Student:
- ✅ All Trainee validations
- ✅ School selection required
- ✅ Student ID required (format validated against school)
- ✅ Required hours required (1-2000)

---

## School ID Formats

| School | Format | Example |
|--------|--------|---------|
| QCU | YYYY-XXXXX | 2026-12345 |
| OLFU-QC | 02YY-XXXX-XXX | 0226-1234-123 |
| STI Cubao | YYYY-XXXXXX | 2026-123456 |
| UP Diliman | YYYY-XXXXXX | 2026-123456 |
| Ateneo | YYYY-XXXXXX | 2026-123456 |
| *...and 16 more* | | |

---

## UI/UX Features

### Account Type Cards:
- **Visual Design**: Icon + Label + Description
- **Hover Effect**: Lift animation + shadow
- **Selected State**: 
  - Gradient background
  - Thicker border (3px)
  - Enhanced shadow
  - Icon scale animation

### Form Behavior:
- **Dynamic Fields**: School/ID fields appear only for OJT Students
- **Smart Validation**: ID format validation based on selected school
- **Help Text**: Format examples shown under Student ID field
- **Auto-calculation**: Age calculated from birthday

---

## Build Status
✅ **Compiled Successfully**
- JS Size: 119.79 KB (+411 B)
- CSS Size: 10.97 KB (+191 B)
- No errors or warnings

---

## Testing Checklist

### Register Page:
- [ ] Trainee account creation (without school/ID)
- [ ] OJT Student account creation (with school/ID/hours)
- [ ] School dropdown populated with 21 schools
- [ ] Student ID format validation works
- [ ] Required hours field (1-2000)
- [ ] Account type selection required
- [ ] Conditional field display

### Login Page:
- [ ] Account type selection works
- [ ] Trainee login
- [ ] OJT Student login
- [ ] Validation enforces account type selection

---

## Notes
- **Not pushed to GitHub yet** (as requested)
- All existing functionality preserved
- Backward compatible with existing demo accounts
- Ready for further testing

---

**Updated by: Kiro AI**  
**Date: September 15, 2026**
