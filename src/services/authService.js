export function login(email, password, users) {
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
}

export function register(userData, users) {
  // Check if email already exists
  const existingUser = users.find(u => u.email === userData.email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Check if student ID already exists
  if (userData.studentId) {
    const existingStudentId = users.find(u => u.studentId === userData.studentId);
    if (existingStudentId) {
      throw new Error('Student ID already registered');
    }
  }

  const newUser = {
    id: `user-${Date.now()}`,
    role: 'STUDENT',
    ...userData,
    createdAt: new Date().toISOString()
  };

  return newUser;
}

export function updateProfile(userId, updates, users) {
  const user = users.find(u => u.id === userId);
  if (!user) {
    throw new Error('User not found');
  }

  return {
    ...user,
    ...updates,
    updatedAt: new Date().toISOString()
  };
}

export function isAuthenticated(currentUser) {
  return currentUser !== null;
}

export function hasRole(currentUser, role) {
  return currentUser?.role === role;
}

export function isStudent(currentUser) {
  return hasRole(currentUser, 'STUDENT');
}

export function isAdmin(currentUser) {
  return hasRole(currentUser, 'ADMIN');
}
